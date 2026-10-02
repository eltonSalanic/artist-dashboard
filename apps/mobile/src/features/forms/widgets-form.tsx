import { useCallback, useMemo, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Gesture } from 'react-native-gesture-handler';
import ReorderableList, { useReorderableDrag } from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';
import { packInOrder, readingOrder, WIDGET_META, type LayoutItem } from '@artist/shared';
import {
  useLayout,
  usePermissions,
  useResetLayout,
  useSaveDefaultLayout,
  useSaveLayout,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Row } from '@/components/row';
import { ThemedText } from '@/components/themed-text';
import { planMove } from '@/features/board/reorder';
import { WIDGET_ICONS } from '@/features/board/widget-icons';
import { spacing, useThemeColors } from '@/theme';
import { FormGate } from './form-gate';
import { FormScreen, useLeaveForm } from './form-screen';

/**
 * Your own arrangement of this band's widgets: order and which are shown.
 * It is the same personal layout web edits, so a change here moves your web
 * dashboard too — positions only. Widths stay what web chose (`packInOrder`):
 * the phone sizes cards by what they hold, not by layout width, so a width
 * control here would only ever change web.
 *
 * Anyone may arrange their own; making it the band's default for people who
 * have not arranged theirs is an admin's call (`widget.manage`).
 */
export function WidgetsForm({ boardId }: { boardId: string }) {
  const layout = useLayout(boardId);
  return (
    <FormGate allowed pending={layout.isPending} missing={!layout.data} what="layout">
      {layout.data && <WidgetsFields boardId={boardId} layout={layout.data.layout} />}
    </FormGate>
  );
}

/** A tab, not a widget: kept in the saved layout, never offered here. */
const offered = (item: LayoutItem) => item.widgetType !== 'CALENDAR';

const pickUp = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

function WidgetsFields({ boardId, layout }: { boardId: string; layout: LayoutItem[] }) {
  const { can } = usePermissions();
  const save = useSaveLayout(boardId);
  const initial = useMemo(() => readingOrder(layout).filter(offered), [layout]);
  const [items, setItems] = useState(initial);

  const signature = (list: LayoutItem[]) =>
    list.map((i) => `${i.widgetType}:${i.hidden ? 0 : 1}`).join();
  const dirty = signature(items) !== signature(initial);
  const shown = items.filter((i) => !i.hidden).length;

  const move = (from: number, to: number) => {
    const plan = planMove(
      items.map((i) => i.widgetType),
      from,
      to,
    );
    if (!plan) return;
    setItems(plan.ids.map((type) => items.find((i) => i.widgetType === type)!));
  };

  const toggle = (index: number, visible: boolean) =>
    setItems((list) => list.map((item, i) => (i === index ? { ...item, hidden: !visible } : item)));

  /** What gets written: the phone's order, web's sizes, the tab kept as-is. */
  const arranged = () => [...packInOrder(items), ...layout.filter((i) => !offered(i))];

  const panGesture = useMemo(() => Gesture.Pan().activateAfterLongPress(520), []);
  const onDragStart = useCallback(() => {
    'worklet';
    scheduleOnRN(pickUp);
  }, []);

  return (
    <FormScreen
      title="Widgets"
      dirty={dirty}
      // A board with nothing on it is a broken-looking board, not a choice.
      canSave={dirty && shown > 0}
      saving={save.isPending}
      onSave={() => save.mutateAsync(arranged())}
      scrollable={false}
    >
      <ReorderableList
        data={items}
        keyExtractor={(item) => item.widgetType}
        onReorder={({ from, to }) => move(from, to)}
        panGesture={panGesture}
        onDragStart={onDragStart}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.md }}
        ListHeaderComponent={
          <ThemedText
            variant="footnote"
            tone="muted"
            style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}
          >
            Hold a widget to move it. This is your own arrangement — it changes
            your web dashboard too, but no one else&apos;s.
          </ThemedText>
        }
        renderItem={({ item, index }) => (
          <WidgetRow
            item={item}
            index={index}
            count={items.length}
            onMove={move}
            onToggle={(visible) => toggle(index, visible)}
            // The last one shown cannot be switched off.
            lockOn={!item.hidden && shown === 1}
          />
        )}
        ListFooterComponent={
          <Footer
            boardId={boardId}
            canSetDefault={can('widget.manage')}
            arranged={arranged}
          />
        }
      />
    </FormScreen>
  );
}

function WidgetRow({
  item,
  index,
  count,
  onMove,
  onToggle,
  lockOn,
}: {
  item: LayoutItem;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onToggle: (visible: boolean) => void;
  lockOn: boolean;
}) {
  const colors = useThemeColors();
  const drag = useReorderableDrag();
  const title = WIDGET_META[item.widgetType].title;

  return (
    <Row
      first={index === 0}
      title={title}
      meta={item.hidden ? 'Hidden' : null}
      dim={item.hidden}
      lead={<Icon name={WIDGET_ICONS[item.widgetType]} size={17} />}
      onLongPress={drag}
      // A screen reader cannot drag; it gets the same move one step at a time.
      accessibilityActions={[
        ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
        ...(index < count - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
      ]}
      onAccessibilityAction={(action) => {
        if (action === 'moveUp') onMove(index, index - 1);
        if (action === 'moveDown') onMove(index, index + 1);
      }}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Switch
            accessibilityLabel={`Show ${title}`}
            value={!item.hidden}
            disabled={lockOn}
            onValueChange={onToggle}
            trackColor={{ true: colors.primary }}
          />
          <Icon
            name={{ sf: 'line.3.horizontal', md: 'drag-handle' }}
            size={16}
            color={colors.mutedForeground}
          />
        </View>
      }
    />
  );
}

function Footer({
  boardId,
  canSetDefault,
  arranged,
}: {
  boardId: string;
  canSetDefault: boolean;
  arranged: () => LayoutItem[];
}) {
  const leave = useLeaveForm();
  const reset = useResetLayout(boardId);
  const saveDefault = useSaveDefaultLayout(boardId);

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
      <Button
        title="Reset to the band's default"
        variant="secondary"
        loading={reset.isPending}
        onPress={() =>
          Alert.alert(
            'Reset your layout?',
            "You'll see the band's default arrangement again, here and on web.",
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset',
                style: 'destructive',
                onPress: () => reset.mutate(undefined, { onSuccess: () => leave(() => router.back()) }),
              },
            ],
          )
        }
      />
      {canSetDefault && (
        <Button
          title="Make this the band's default"
          variant="ghost"
          loading={saveDefault.isPending}
          onPress={() =>
            Alert.alert(
              "Make this the band's default?",
              "Members who haven't arranged their own will see it, and new members start with it. Anyone's own arrangement is left alone.",
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Make default', onPress: () => saveDefault.mutate(arranged()) },
              ],
            )
          }
        />
      )}
    </View>
  );
}
