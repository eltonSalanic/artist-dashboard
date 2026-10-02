import { Alert, View } from 'react-native';
import type { ArchiveKind } from '@artist/shared';
import { useArchiveItem, usePermissions, useRestoreItem } from '@artist/api-client';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/theme';
import { useLeaveForm } from './form-screen';

/**
 * The Archive/Delete pair at the foot of an edit form — web's `ItemActions`,
 * with web's copy, as alerts.
 *
 * Linked tasks (goals and events) are offered as a *separate* button, never
 * the default one, matching web's unticked checkbox: taking twelve tasks along
 * has to be a deliberate choice. An alert holds three buttons on Android, which
 * is exactly cancel, the plain action and the cascading one.
 */
export function ItemActions({
  boardId,
  kind,
  id,
  itemLabel,
  archivedAt,
  liveTaskCount = 0,
  archivedTaskCount = 0,
  linkedTaskCount = 0,
  canDelete,
  onDelete,
  onDone,
}: {
  boardId: string;
  kind: ArchiveKind;
  id: string;
  /** What the item is called in the copy — "goal", "show", "reminder". */
  itemLabel: string;
  archivedAt: string | null;
  liveTaskCount?: number;
  archivedTaskCount?: number;
  linkedTaskCount?: number;
  canDelete: boolean;
  /** Resolves once deleted; each entity has its own delete hook. */
  onDelete: (cascadeTasks: boolean) => Promise<unknown>;
  /** Where to go once the item has left the view behind the form. */
  onDone: () => void;
}) {
  const { can } = usePermissions();
  const leave = useLeaveForm();
  // Unsaved edits are moot once the item is archived or gone.
  const finish = () => leave(onDone);
  const runDelete = (cascadeTasks: boolean) =>
    onDelete(cascadeTasks).then(finish, () => undefined);
  const archive = useArchiveItem(boardId);
  const restore = useRestoreItem(boardId);
  const archived = archivedAt !== null;
  const canArchive = can('item.archive');

  if (!canArchive && !canDelete) return null;

  const tasks = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

  const confirmArchive = () => {
    const run = (cascadeTasks: boolean) =>
      (archived ? restore : archive).mutate(
        { kind, id, cascadeTasks },
        { onSuccess: finish },
      );
    const count = archived ? archivedTaskCount : liveTaskCount;
    Alert.alert(
      archived ? `Put this ${itemLabel} back?` : `Archive this ${itemLabel}?`,
      archived
        ? 'It returns to your dashboard and leaves the archive.'
        : "It comes off your dashboard, but it isn't gone — you'll find it in the Archive, and you can put it back any time.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: archived ? 'Restore' : 'Archive', onPress: () => run(false) },
        ...(count > 0
          ? [
              {
                text: archived
                  ? `Restore with ${tasks(count)}`
                  : `Archive with ${tasks(count)}`,
                onPress: () => run(true),
              },
            ]
          : []),
      ],
    );
  };

  const confirmDelete = () =>
    Alert.alert(
      `Permanently delete this ${itemLabel}?`,
      'This cannot be undone. It disappears from your dashboard and the archive alike. If you only want it out of the way, archive it instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: () => void runDelete(false) },
        ...(linkedTaskCount > 0
          ? [
              {
                text: `Delete with ${tasks(linkedTaskCount)}`,
                style: 'destructive' as const,
                onPress: () => void runDelete(true),
              },
            ]
          : []),
      ],
    );

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      {archived && (
        <ThemedText variant="footnote" tone="muted">
          This {itemLabel} is archived.
        </ThemedText>
      )}
      {canArchive && (
        <Button
          title={archived ? 'Unarchive' : 'Archive'}
          variant="secondary"
          loading={archive.isPending || restore.isPending}
          onPress={confirmArchive}
        />
      )}
      {canDelete && <Button title="Delete" variant="destructive" onPress={confirmDelete} />}
    </View>
  );
}
