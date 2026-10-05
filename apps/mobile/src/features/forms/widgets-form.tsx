import { useCallback, useMemo, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Gesture } from 'react-native-gesture-handler';
import ReorderableList, { useReorderableDrag } from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';
import {
  MobileCardSizes,
  WIDGET_META,
  type MobileCardSize,
  type MobileLayoutItem,
  type MobileLayoutSource,
} from '@artist/shared';
import {
  useMobileLayout,
  useResetMobileLayout,
  useSaveMobileLayout,
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
 * Your phone's own arrangement of this band's widgets: order, width (full or
 * half) and which are shown (P12b). It never moves your web dashboard, and
 * web never moves it.
 *
 * Until it is saved here it follows your web arrangement, and the screen says
 * so; the first save gives the phone its own. Resetting goes back to following
 * web. There is no band default for phones: a member who has not arranged
 * theirs follows their web layout, which falls back to the band's.
 */
export function WidgetsForm({ boardId }: { boardId: string }) {
  const layout = useMobileLayout(boardId);
  return (
    <FormGate allowed pending={layout.isPending} missing={!layout.data} what="layout">
      {layout.data && (
        <WidgetsFields
          boardId={boardId}
          layout={layout.data.items}
          source={layout.data.source}
        />
      )}
    </FormGate>
  );
}

const SIZE_LABELS: Record<MobileCardSize, string> = { full: 'Full', half: 'Half' };

const pickUp = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

function WidgetsFields({
  boardId,
  layout,
  source,
}: {
  boardId: string;
  layout: MobileLayoutItem[];
  source: MobileLayoutSource;
}) {
  const save = useSaveMobileLayout(boardId);
  const [items, setItems] = useState(layout);

  const signature = (list: MobileLayoutItem[]) =>
    list.map((i) => `${i.widgetType}:${i.size}:${i.hidden ? 0 : 1}`).join();
  const dirty = signature(items) !== signature(layout);
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

  const update = (index: number, change: Partial<MobileLayoutItem>) =>
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...change } : item)));

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
      onSave={() => save.mutateAsync(items)}
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
            {source === 'web'
              ? "Your phone follows your web dashboard for now. Hold a widget to move it, and pick each one's width. Saving gives your phone its own arrangement, and web stays as it is."
              : "Your phone's own arrangement. Hold a widget to move it, and pick each one's width. It doesn't change your web dashboard."}
          </ThemedText>
        }
        renderItem={({ item, index }) => (
          <WidgetRow
            item={item}
            index={index}
            count={items.length}
            onMove={move}
            onSize={(size) => update(index, { size })}
            onToggle={(visible) => update(index, { hidden: !visible })}
            // The last one shown cannot be switched off.
            lockOn={!item.hidden && shown === 1}
          />
        )}
        ListFooterComponent={
          source === 'phone' ? <Footer boardId={boardId} /> : null
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
  onSize,
  onToggle,
  lockOn,
}: {
  item: MobileLayoutItem;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onSize: (size: MobileCardSize) => void;
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
          {/* A hidden card has no width to choose. */}
          {!item.hidden && (
            <SegmentedControl
              accessibilityLabel={`${title} width`}
              style={{ width: 96 }}
              values={MobileCardSizes.map((size) => SIZE_LABELS[size])}
              selectedIndex={MobileCardSizes.indexOf(item.size)}
              onChange={(event) =>
                onSize(MobileCardSizes[event.nativeEvent.selectedSegmentIndex])
              }
            />
          )}
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

/** Only once the phone has its own arrangement is there anything to reset. */
function Footer({ boardId }: { boardId: string }) {
  const leave = useLeaveForm();
  const reset = useResetMobileLayout(boardId);

  return (
    <View style={{ marginTop: spacing.lg }}>
      <Button
        title="Follow my web dashboard"
        variant="secondary"
        loading={reset.isPending}
        onPress={() =>
          Alert.alert(
            'Follow your web dashboard?',
            "Your phone's own arrangement is removed, and it shows your widgets in your web dashboard's order again. Web isn't changed.",
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Follow web',
                style: 'destructive',
                onPress: () => reset.mutate(undefined, { onSuccess: () => leave(() => router.back()) }),
              },
            ],
          )
        }
      />
    </View>
  );
}
