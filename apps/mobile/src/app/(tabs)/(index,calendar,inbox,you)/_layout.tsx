import { Stack } from 'expo-router/stack';
import { useThemeColors } from '@/theme';

/**
 * One stack definition, instantiated once per tab.
 *
 * The folder name lists all four segments, which gives each tab its own stack
 * over the same route files — so a screen that several tabs can reach (a task
 * opened from the board, the calendar or the inbox) is written once and pushes
 * onto whichever stack the person is actually in, instead of yanking them to
 * another tab.
 */
export default function TabStackLayout({ segment }: { segment: string }) {
  const colors = useThemeColors();
  const root = segment.match(/\((.*)\)/)?.[1] ?? 'index';
  const titles: Record<string, string> = {
    index: 'Board',
    calendar: 'Calendar',
    inbox: 'Inbox',
    you: 'You',
  };

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.foreground },
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name={root} options={{ title: titles[root] }} />
      <Stack.Screen
        name="boards"
        options={{
          // The board switcher: a native sheet, not a drawn-on modal.
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
          title: 'Your bands',
        }}
      />
      {/* Spokes and task detail: pushed, titled by the screen itself. They are
          declared here only so the stack knows they are not sheets. */}
      <Stack.Screen name="board/[boardId]/w/[widgetType]" />
      <Stack.Screen
        name="board/[boardId]/task/[taskId]"
        options={{ title: 'Task' }}
      />
      <Stack.Screen
        name="board/[boardId]/status/[taskId]"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
          title: 'Status',
        }}
      />
      <Stack.Screen
        name="board/[boardId]/form/[kind]"
        options={{
          // A page sheet on iOS, full screen on Android. The form sets its
          // own title and Cancel/Save, and locks the swipe while dirty.
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="board-menu"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
          title: 'Board',
        }}
      />
    </Stack>
  );
}
