import { useState } from 'react';
import { View } from 'react-native';
import {
  BPS_WHOLE,
  equalSplit,
  isValidSplit,
  type FinanceMemberRef,
  type SplitShare,
} from '@artist/shared';
import {
  useFinanceSplit,
  useFinanceSummary,
  usePermissions,
  useUpdateFinanceSplit,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { TextField } from '@/components/text-field';
import { spacing, useThemeColors } from '@/theme';
import { FormGate } from './form-gate';
import { FormScreen } from './form-screen';

const FUND = 'fund';
const pct = (bps: number) => String(bps / 100);
const toBps = (text: string) => Math.round(Number(text.replace(',', '.')) * 100);

/**
 * The band's default split, as on web's Finances page. Admins only. A change
 * applies to money logged from now on; each entry keeps the split it was
 * written with.
 */
export function SplitForm({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const split = useFinanceSplit(boardId);
  const summary = useFinanceSummary(boardId, {}, can('finance.manage'));
  return (
    <FormGate
      allowed={can('finance.manage')}
      pending={split.isPending || summary.isPending}
      missing={!split.data || !summary.data}
      what="split"
    >
      {split.data && summary.data && (
        <SplitFields
          boardId={boardId}
          shares={split.data.shares}
          isDefault={split.data.isDefault}
          members={summary.data.members}
        />
      )}
    </FormGate>
  );
}

function SplitFields({
  boardId,
  shares,
  isDefault,
  members,
}: {
  boardId: string;
  shares: SplitShare[];
  isDefault: boolean;
  members: FinanceMemberRef[];
}) {
  const colors = useThemeColors();
  const save = useUpdateFinanceSplit(boardId);
  const initial = () => {
    const byId = new Map(shares.map((s) => [s.userId ?? FUND, s.shareBps]));
    const values: Record<string, string> = { [FUND]: pct(byId.get(FUND) ?? 0) };
    for (const m of members) values[m.id] = pct(byId.get(m.id) ?? 0);
    return values;
  };
  const [start] = useState(initial);
  const [values, setValues] = useState(start);

  const draft: SplitShare[] = Object.entries(values)
    .map(([key, text]) => ({ userId: key === FUND ? null : key, shareBps: toBps(text || '0') }))
    .filter((s) => s.shareBps !== 0 || s.userId === null);
  const total = draft.reduce((sum, s) => sum + (Number.isFinite(s.shareBps) ? s.shareBps : 0), 0);
  const valid = isValidSplit(draft);
  const dirty = Object.keys(values).some((k) => values[k] !== start[k]);

  const evenWithFund = () => {
    const fund = toBps(values[FUND] || '0');
    const even = equalSplit(
      members.map((m) => m.id),
      Number.isFinite(fund) ? fund : 0,
    );
    const next: Record<string, string> = { [FUND]: '0' };
    for (const m of members) next[m.id] = '0';
    for (const s of even) next[s.userId ?? FUND] = pct(s.shareBps);
    setValues(next);
  };

  return (
    <FormScreen
      title="How money is split"
      dirty={dirty}
      canSave={valid && (dirty || isDefault)}
      saving={save.isPending}
      onSave={() => save.mutateAsync({ shares: draft.filter((s) => s.shareBps > 0) })}
    >
      <View style={{ gap: spacing.md }}>
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          {isDefault
            ? 'Nobody has set a split yet, so everyone gets an equal share.'
            : 'Applies to money logged from now on. Past entries keep their split.'}
        </PosterText>
        {[FUND, ...members.map((m) => m.id)].map((key) => {
          const label =
            key === FUND ? 'Band fund' : (members.find((m) => m.id === key)?.displayName ?? '');
          return (
            <TextField
              key={key}
              label={`${label} (%)`}
              value={values[key] ?? '0'}
              onChangeText={(text) => setValues((prev) => ({ ...prev, [key]: text }))}
              keyboardType="decimal-pad"
            />
          );
        })}
        <PosterText
          variant="cardMeta"
          color={valid ? colors.mutedForeground : colors.destructive}
          accessibilityRole={valid ? undefined : 'alert'}
        >
          {`Total ${(total / 100).toFixed(2).replace(/\.00$/, '')}%${
            valid ? '' : ` — needs to be exactly ${BPS_WHOLE / 100}%`
          }`}
        </PosterText>
        <Button title="Split the rest evenly" variant="secondary" size="sm" onPress={evenWithFund} />
      </View>
    </FormScreen>
  );
}
