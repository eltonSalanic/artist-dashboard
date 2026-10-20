import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import {
  BOARD_PALETTES,
  DEFAULT_TASK_STATUSES,
  NOTIFICATION_CATEGORY_COPY,
  NotificationCategories,
  resolveBoardTheme,
  type BoardRole,
} from '@artist/shared';
import {
  useBoard,
  useCreateStatus,
  useDeleteStatus,
  useInvites,
  useMe,
  useNotificationPreferences,
  usePermissions,
  useRemoveMember,
  useRevokeInvite,
  useSaveBoardTheme,
  useSaveNotificationPreference,
  useSendInvite,
  useStatuses,
  useUpdateStatus,
  type TaskStatusDto,
} from '@artist/api-client';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { Icon } from '@/components/icon';
import { Dot, Row } from '@/components/row';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import {
  paletteSwatches,
  posterRadius,
  radius,
  spacing,
  useScheme,
  useShadows,
  useThemeColors,
} from '@/theme';

/**
 * Board settings — web's settings page, one section per card, each gated by
 * the shared map exactly as web gates it. Notifications are personal, so every
 * member reaches this screen; the admin half is what is gated.
 *
 * Not here, on purpose: per-widget card colours (web's colour menus; the
 * palette is the decision that matters, and it is here) and the default layout,
 * which is P12's layout editor.
 */
export function BoardSettingsScreen({ boardId }: { boardId: string }) {
  const colors = useThemeColors();
  const { can } = usePermissions();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xl }}
    >
      <NotificationsSection boardId={boardId} />
      {can('member.invite') && <MembersSection boardId={boardId} />}
      {can('member.invite') && <InviteSection boardId={boardId} />}
      {can('status.manage') && <StatusesSection boardId={boardId} />}
      {can('board.appearance') && <PaletteSection boardId={boardId} />}
    </ScrollView>
  );
}

function NotificationsSection({ boardId }: { boardId: string }) {
  const colors = useThemeColors();
  const preferences = useNotificationPreferences(boardId);
  const save = useSaveNotificationPreference(boardId);

  return (
    <Section title="NOTIFICATIONS">
      <ThemedText variant="footnote" tone="muted">
        What this band may tell you about, by email and on your phone. Everything else stays in the activity feed.
      </ThemedText>
      {!preferences.data ? (
        <Skeleton width="100%" height={120} />
      ) : (
        NotificationCategories.map((category, index) => {
          const copy = NOTIFICATION_CATEGORY_COPY[category];
          return (
            <Row
              key={category}
              first={index === 0}
              title={copy.label}
              meta={copy.description}
              trailing={
                <Switch
                  accessibilityLabel={copy.label}
                  value={preferences.data[category]}
                  // Painted first and rolled back on failure, in the hook.
                  onValueChange={(enabled) => save.mutate({ category, enabled })}
                  trackColor={{ true: colors.primary }}
                  // The track is the page ink, near-white in the dark, where the
                  // system's white thumb vanished into it: the thumb is the ink's
                  // opposite, as a primary button's label is.
                  thumbColor={preferences.data[category] ? colors.primaryForeground : undefined}
                />
              }
            />
          );
        })
      )}
    </Section>
  );
}

function MembersSection({ boardId }: { boardId: string }) {
  const colors = useThemeColors();
  const me = useMe(true);
  const board = useBoard(boardId);
  const remove = useRemoveMember(boardId);
  const members = board.data?.members ?? [];

  const confirmRemove = (userId: string, name: string) =>
    Alert.alert(
      `Remove ${name}?`,
      "They'll lose access to this band and be unassigned from all its tasks.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(userId) },
      ],
    );

  return (
    <Section title={members.length > 0 ? `MEMBERS · ${members.length}` : 'MEMBERS'}>
      {board.isPending && <Skeleton width="100%" height={96} />}
      {members.map((member, index) => (
        <Row
          key={member.membershipId}
          first={index === 0}
          title={member.displayName}
          meta={member.email}
          trailing={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Badge label={member.role === 'ADMIN' ? 'Admin' : 'Member'} />
              {/* You cannot remove yourself here — that is leaving, not admin. */}
              {member.userId !== me.data?.user.id && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${member.displayName}`}
                  hitSlop={12}
                  disabled={remove.isPending}
                  onPress={() => confirmRemove(member.userId, member.displayName)}
                >
                  <Icon
                    name={{ sf: 'person.badge.minus', md: 'person-remove' }}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              )}
            </View>
          }
        />
      ))}
    </Section>
  );
}

const ROLE_CHOICES: { value: BoardRole; label: string }[] = [
  { value: 'USER', label: 'Member' },
  { value: 'ADMIN', label: 'Admin' },
];

function InviteSection({ boardId }: { boardId: string }) {
  const colors = useThemeColors();
  const invites = useInvites(boardId);
  const send = useSendInvite(boardId);
  const revoke = useRevokeInvite(boardId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardRole>('USER');

  // The API validates properly; this only keeps an obviously unfinished
  // address from being sent.
  const plausible = /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = () =>
    send.mutate(
      { email: email.trim(), role },
      {
        onSuccess: (invite) => {
          setEmail('');
          // The phone's notifier shows no success toasts, and whether an email
          // went out is worth knowing.
          Alert.alert(
            invite.delivery === 'already_registered' ? 'Invite saved' : 'Invite sent',
            invite.delivery === 'already_registered'
              ? `${invite.email} already has an account, so they'll join next time they sign in.`
              : `${invite.email} has been emailed a link to join.`,
          );
        },
      },
    );

  const pending = (invites.data ?? []).filter((i) => i.status === 'PENDING');

  return (
    <Section title="INVITE SOMEONE">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="bandmate@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={() => plausible && submit()}
      />
      <ChoiceChips label="Role" choices={ROLE_CHOICES} value={role} onChange={setRole} />
      <Button
        title="Send invite"
        loading={send.isPending}
        disabled={!plausible}
        onPress={submit}
        style={{ marginTop: spacing.xs }}
      />

      {pending.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <ThemedText variant="caption" tone="muted">
            PENDING
          </ThemedText>
          {pending.map((invite, index) => (
            <Row
              key={invite.id}
              first={index === 0}
              title={invite.email}
              meta={invite.role === 'ADMIN' ? 'Admin' : 'Member'}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Revoke invite for ${invite.email}`}
                  hitSlop={12}
                  onPress={() =>
                    Alert.alert(`Revoke the invite for ${invite.email}?`, undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Revoke',
                        style: 'destructive',
                        onPress: () => revoke.mutate(invite.id),
                      },
                    ])
                  }
                >
                  <Icon
                    name={{ sf: 'xmark.circle', md: 'cancel' }}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              }
            />
          ))}
        </View>
      )}
    </Section>
  );
}

/**
 * Web picks status colours with a full colour input; a phone gets a fixed set
 * — the four the board started with plus four more — because a hue wheel is a
 * poor control for a thumb and nobody needs the 16 millionth shade of blue.
 * A status's existing colour is always offered, so nothing is lost by editing.
 */
const STATUS_SWATCHES = [
  ...DEFAULT_TASK_STATUSES.map((s) => s.color),
  '#e5484d',
  '#8e4ec6',
  '#12a594',
  '#d6409f',
];

function StatusesSection({ boardId }: { boardId: string }) {
  const statuses = useStatuses(boardId);
  const create = useCreateStatus(boardId);
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(STATUS_SWATCHES[1]);

  const add = () =>
    create.mutate({ name: name.trim(), color }, { onSuccess: () => setName('') });

  return (
    <Section title="TASK STATUSES">
      <ThemedText variant="footnote" tone="muted">
        The steps tasks move through. Tap one to rename, recolour or remove it.
      </ThemedText>
      {statuses.isPending && <Skeleton width="100%" height={96} />}
      {(statuses.data ?? []).map((status, index) =>
        open === status.id ? (
          <StatusEditor
            key={status.id}
            boardId={boardId}
            status={status}
            onClose={() => setOpen(null)}
          />
        ) : (
          <Row
            key={status.id}
            first={index === 0}
            title={status.name}
            meta={status.isDone ? 'Counts as done' : null}
            lead={<Dot color={status.color} size={12} />}
            onPress={() => setOpen(status.id)}
          />
        ),
      )}

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <TextField
          label="New status"
          value={name}
          onChangeText={setName}
          placeholder="e.g. In review"
          maxLength={40}
        />
        <Swatches value={color} onChange={setColor} />
        <Button
          title="Add status"
          variant="secondary"
          loading={create.isPending}
          disabled={!name.trim()}
          onPress={add}
        />
      </View>
    </Section>
  );
}

function StatusEditor({
  boardId,
  status,
  onClose,
}: {
  boardId: string;
  status: TaskStatusDto;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const update = useUpdateStatus(boardId);
  const remove = useDeleteStatus(boardId);
  const [name, setName] = useState(status.name);

  const rename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== status.name) {
      update.mutate({ statusId: status.id, dto: { name: trimmed } });
    }
  };

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        marginVertical: spacing.xs,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
      }}
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        onBlur={rename}
        onSubmitEditing={rename}
        maxLength={40}
        returnKeyType="done"
      />
      <Swatches
        value={status.color}
        onChange={(next) => update.mutate({ statusId: status.id, dto: { color: next } })}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <ThemedText variant="body" style={{ flex: 1 }}>
          Counts as done
        </ThemedText>
        <Switch
          accessibilityLabel="Counts as done"
          value={status.isDone}
          onValueChange={(isDone) => update.mutate({ statusId: status.id, dto: { isDone } })}
          trackColor={{ true: colors.primary }}
          thumbColor={status.isDone ? colors.primaryForeground : undefined}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title="Delete"
          variant="destructive"
          size="sm"
          style={{ flex: 1 }}
          onPress={() =>
            Alert.alert(
              `Delete "${status.name}"?`,
              // The API refuses while tasks use it, and says how many.
              'Tasks still in this status have to be moved first.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => remove.mutate(status.id, { onSuccess: onClose }),
                },
              ],
            )
          }
        />
        <Button
          title="Done"
          variant="secondary"
          size="sm"
          style={{ flex: 1 }}
          onPress={() => {
            rename();
            onClose();
          }}
        />
      </View>
    </View>
  );
}

function Swatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const colors = useThemeColors();
  const options = STATUS_SWATCHES.includes(value.toLowerCase())
    ? STATUS_SWATCHES
    : [value, ...STATUS_SWATCHES];

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Colour"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {options.map((swatch) => {
        const selected = swatch.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={swatch}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={swatch}
            hitSlop={4}
            onPress={() => onChange(swatch)}
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.full,
              backgroundColor: swatch,
              // A ring, not just a tick, so the choice reads at a glance.
              borderWidth: selected ? 3 : 0,
              borderColor: colors.foreground,
            }}
          />
        );
      })}
    </View>
  );
}

function PaletteSection({ boardId }: { boardId: string }) {
  const colors = useThemeColors();
  const scheme = useScheme();
  const shadows = useShadows();
  const board = useBoard(boardId);
  const save = useSaveBoardTheme(boardId);
  const theme = resolveBoardTheme(board.data?.theme);
  // While a save is in flight, show where it is going.
  const current = save.isPending ? (save.variables?.palette ?? theme.palette) : theme.palette;

  return (
    <Section title="PALETTE">
      <ThemedText variant="footnote" tone="muted">
        The card colours everyone in this band sees, on web and on phones.
      </ThemedText>
      {board.isPending && <Skeleton width="100%" height={160} />}
      {board.data &&
        BOARD_PALETTES.map((palette, index) => (
          <Row
            key={palette.id}
            first={index === 0}
            title={palette.label}
            meta={palette.description}
            trailing={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flexDirection: 'row' }}>
                  {paletteSwatches(palette.id, scheme).map((hex, i) => (
                    <View
                      key={i}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: radius.full,
                        backgroundColor: hex,
                        marginLeft: i === 0 ? 0 : -4,
                        borderWidth: 1.5,
                        borderColor: colors.background,
                        // Each palette's deepest colour is darker than the dark page.
                        boxShadow: shadows.edge,
                      }}
                    />
                  ))}
                </View>
                <View style={{ width: 18 }}>
                  {current === palette.id && (
                    <Icon name={{ sf: 'checkmark', md: 'check' }} size={16} color={colors.primary} />
                  )}
                </View>
              </View>
            }
            // Keeps any per-widget colours chosen on web; only the palette moves.
            onPress={
              current === palette.id ? undefined : () => save.mutate({ ...theme, palette: palette.id })
            }
          />
        ))}
    </Section>
  );
}
