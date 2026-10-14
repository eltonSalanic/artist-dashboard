import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, View } from 'react-native';
import { PermissionsProvider, useBoard, useInbox, useMe } from '@artist/api-client';
import { resolveBoardTheme } from '@artist/shared';
import { ThemedText } from '@/components/themed-text';
import {
  SelectedBoardProvider,
  useSelectedBoard,
} from '@/features/board/selected-board';
import { PushNotifications } from '@/features/push/use-push';
import { BoardPaletteProvider, spacing, useThemeColors } from '@/theme';

/**
 * Board · Calendar · Inbox · You.
 *
 * `NativeTabs` rather than a drawn tab bar: on iOS 26 it picks up the liquid
 * glass treatment and on Android it is Material 3 bottom navigation, neither of
 * which is worth reimplementing. Triggers name the route *groups*, so each tab
 * keeps its own navigation stack over the shared routes next door.
 *
 * Everything authed hangs below here, which makes this the right place to
 * resolve the board once: which one is selected, what the caller may do on it,
 * and which palette it paints with.
 */
export default function TabsLayout() {
  const me = useMe(true);

  if (me.isPending) return <Centered><ActivityIndicator /></Centered>;

  if (me.isError) {
    return (
      <Centered>
        <ThemedText variant="headline" tone="destructive">
          Could not load your bands
        </ThemedText>
        <ThemedText variant="subhead" tone="muted">
          {me.error.message}
        </ThemedText>
      </Centered>
    );
  }

  return (
    <SelectedBoardProvider boards={me.data.boards}>
      <BoardChrome>
        <TabBar />
      </BoardChrome>
      {/* After the tab bar, so a tap that launched the app navigates into
          stacks that already exist. */}
      <PushNotifications />
    </SelectedBoardProvider>
  );
}

/**
 * How many mentions are waiting.
 *
 * A mention is a row that exists until the person dismisses it, so the count
 * is a fact rather than a guess about what they have already read. Unfiltered
 * on purpose — a badge is about the app, not about whichever band the Inbox
 * happens to be filtered to, and it reads the same cached query that tab's
 * unfiltered list does.
 *
 * NativeTabs only recognises `Trigger.Badge` as a *direct* child of the
 * Trigger. A wrapper that returns the Badge (or `null` at zero) is dropped,
 * which is why this hook lives here and the Badge is always mounted — `hidden`
 * at zero, rather than a `0`, because an empty inbox is not news.
 */
function TabBar() {
  const inbox = useInbox();
  const waiting = inbox.data?.length ?? 0;

  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(index)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
          md="dashboard"
        />
        <NativeTabs.Trigger.Label>Board</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(calendar)">
        {/* NativeTabs `md` takes Material *Symbols* names (snake_case);
            the in-screen `Icon` takes Material *Icons* names (kebab-case).
            Two different sets, one letter apart here. */}
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(inbox)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'tray', selected: 'tray.fill' }}
          md="inbox"
        />
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={waiting === 0}>
          {waiting > 9 ? '9+' : waiting > 0 ? String(waiting) : undefined}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(you)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person', selected: 'person.fill' }}
          md="person"
        />
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

/**
 * Role and palette both belong to the selected board, not to the user. Someone
 * can be admin of their own project and an ordinary member of someone else's,
 * so there is no role to cache globally — only a role *here*.
 */
function BoardChrome({ children }: { children: React.ReactNode }) {
  const { board, role } = useSelectedBoard();
  const detail = useBoard(board?.id);
  const palette = resolveBoardTheme(detail.data?.theme).palette;

  return (
    <BoardPaletteProvider palette={palette}>
      {role ? (
        <PermissionsProvider role={role}>{children}</PermissionsProvider>
      ) : (
        // No membership anywhere: the screens below render their own empty
        // states, and a permission map would have nothing to answer about.
        children
      )}
    </BoardPaletteProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      {children}
    </View>
  );
}
