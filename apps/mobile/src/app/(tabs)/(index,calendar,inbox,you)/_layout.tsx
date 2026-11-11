import { Stack } from 'expo-router/stack';
import { ThemedText } from '@/components/themed-text';
import { LIQUID_GLASS } from '@/lib/liquid-glass';
import { face, useThemeColors } from '@/theme';

/**
 * A sheet's title, drawn by React rather than as the bar's own title.
 *
 * In dark mode iOS dims the title label of a sheet's bar whatever colour it is
 * given (the page ink came out mid grey, pure red a dark red), while the light
 * mode's near-black hid it. A title view of our own is drawn as it is asked.
 */
function sheetTitle(title: string) {
  return {
    title,
    ...glassSheet,
    headerTitle: () => (
      <ThemedText variant="headline" accessibilityRole="header">
        {title}
      </ThemedText>
    ),
  };
}

/**
 * On iOS 26 a sheet is a pane of Liquid Glass, inset from the screen's edges,
 * that clears as it grows. An opaque content or bar colour paints over that
 * glass, so the sheets leave both see-through there and their screens do the
 * same (`sheetBackground`). Before iOS 26 they keep the cream page.
 */
const glassSheet = LIQUID_GLASS
  ? {
      contentStyle: { backgroundColor: 'transparent' },
      headerStyle: { backgroundColor: 'transparent' },
    }
  : {};

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
        // Figtree is loaded before the first screen draws (the root layout
        // waits on it), so the native bar can name it from the start.
        headerTitleStyle: { color: colors.foreground, fontFamily: face.bold },
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
          ...sheetTitle('Your bands'),
        }}
      />
      {/* Spokes and task detail: pushed, titled by the screen itself. They are
          declared here only so the stack knows they are not sheets. */}
      <Stack.Screen name="board/[boardId]/w/[widgetType]" />
      <Stack.Screen
        name="board/[boardId]/task/[taskId]"
        // Untitled: the screen's block names the kind, set large. Blank here
        // too, not only once loaded, or the bar would flash "Task" and empty.
        options={{ title: '' }}
      />
      <Stack.Screen name="board/[boardId]/event/[eventId]" options={{ title: '' }} />
      <Stack.Screen name="board/[boardId]/goal/[goalId]" options={{ title: '' }} />
      <Stack.Screen name="board/[boardId]/reminder/[reminderId]" options={{ title: '' }} />
      <Stack.Screen name="board/[boardId]/attach" options={{ title: 'Attach a task' }} />
      <Stack.Screen name="board/[boardId]/archive" options={{ title: 'Archive' }} />
      <Stack.Screen name="board/[boardId]/finances/entries" options={{ title: 'All entries' }} />
      {/* Titled by the screen with the member's name, once it has loaded. */}
      <Stack.Screen name="board/[boardId]/finances/member/[userId]" options={{ title: '' }} />
      <Stack.Screen name="board/[boardId]/settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="board/[boardId]/subscribe" options={{ title: 'Subscription' }} />
      <Stack.Screen name="subscribe" options={{ title: 'Subscription' }} />
      {/* First-run moments, each painted in the band's colour: no bar, and
          full screen so the tab bar doesn't sit over them. */}
      <Stack.Screen
        name="band-live"
        options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="welcome-in"
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
      <Stack.Screen
        name="board/[boardId]/status/[taskId]"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
          ...sheetTitle('Status'),
        }}
      />
      <Stack.Screen
        name="board/[boardId]/show-status/[eventId]"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
          ...sheetTitle('Show status'),
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
      <Stack.Screen name="help/index" options={{ title: 'How Band Wall works' }} />
      <Stack.Screen
        name="help/[topic]"
        options={{
          // One help topic over whatever asked for it. It opens two thirds
          // up and pulls to full height, since some topics run long.
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.66, 1],
          // The one sheet that scrolls, so it draws its own title above the
          // scroll view (HelpSheet says why) instead of a bar over it.
          ...glassSheet,
          title: 'How it works',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="board-menu"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
          ...sheetTitle('Board'),
        }}
      />
    </Stack>
  );
}
