import { useState } from 'react';
import { FocusPeriods, type FocusPeriod } from '@artist/shared';
import { useFocus, usePermissions, useSetFocus, type FocusPinDto } from '@artist/api-client';
import { TextField } from '@/components/text-field';
import { FormGate } from './form-gate';
import { FormScreen } from './form-screen';

/**
 * All three horizons on one form, as the spoke shows them. Saving an empty
 * field clears that period's pin — the API's own convention for "unset".
 */
export function FocusForm({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const focus = useFocus(boardId);

  return (
    <FormGate
      allowed={can('focus.manage')}
      pending={focus.isPending}
      missing={!focus.data}
      what="focus"
    >
      <FocusFields boardId={boardId} pins={focus.data ?? []} />
    </FormGate>
  );
}

function FocusFields({ boardId, pins }: { boardId: string; pins: FocusPinDto[] }) {
  const setFocus = useSetFocus(boardId);
  const initial = Object.fromEntries(
    FocusPeriods.map((p) => [p, pins.find((pin) => pin.period === p)?.text ?? '']),
  ) as Record<FocusPeriod, string>;
  const [text, setText] = useState(initial);

  const changed = FocusPeriods.filter((p) => text[p].trim() !== initial[p].trim());

  const save = async () => {
    // One PUT per period that changed; the rest are left alone.
    for (const period of changed) {
      await setFocus.mutateAsync({ period, text: text[period].trim() });
    }
  };

  return (
    <FormScreen
      title="Focus"
      dirty={changed.length > 0}
      canSave={changed.length > 0}
      saving={setFocus.isPending}
      onSave={save}
    >
      {FocusPeriods.map((period) => (
        <TextField
          key={period}
          label={`This ${period.toLowerCase()}`}
          value={text[period]}
          onChangeText={(value) => setText((prev) => ({ ...prev, [period]: value }))}
          placeholder="What matters most?"
          maxLength={500}
          multiline
        />
      ))}
    </FormScreen>
  );
}
