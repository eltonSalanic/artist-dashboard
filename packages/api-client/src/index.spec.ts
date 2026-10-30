/**
 * Guards the barrel itself. `index.ts` re-exports a `.tsx` module
 * (auth/permissions), so this fails outright if jest's resolver loses tsx
 * support — which it had, silently, until the package's jest config gained it.
 */
import * as api from './index';

describe('package barrel', () => {
  it('resolves every re-export, including the .tsx provider', () => {
    expect(typeof api.configureApiClient).toBe('function');
    expect(typeof api.apiFetch).toBe('function');
    expect(typeof api.ApiError).toBe('function');
    expect(typeof api.PermissionsProvider).toBe('function');
    expect(typeof api.usePermissions).toBe('function');
  });

  it('exports the 15 extracted hooks', () => {
    const hooks = [
      'useActivityFeed', 'useBoardTheme', 'useSaveBoardTheme', 'useArchive',
      'useArchiveItem', 'useRestoreItem', 'useMe', 'useComments',
      'useCreateComment', 'useCustomWidget', 'useLayout', 'useSaveLayout',
      'useMentions', 'useCalendar', 'useEvents', 'useFocus', 'useGoals',
      'useReminders', 'useTasks', 'useCanChangeStatus',
      // The cross-board pair the mobile Calendar and Inbox tabs read.
      'useInbox', 'useDismissInboxItem', 'useClearInbox',
      'useAllBoardsCalendar',
      // Lifted from apps/web when the phone gained uploads.
      'useAttachments', 'useUploadAttachment', 'useDeleteAttachment',
      // Lifted from web's settings page when the phone gained one.
      'useRemoveMember', 'useInvites', 'useSendInvite', 'useRevokeInvite',
      'useStatuses', 'useCreateStatus', 'useUpdateStatus', 'useDeleteStatus',
      'useNotificationPreferences', 'useSaveNotificationPreference',
      // The phone's own arrangement (P12b).
      'useMobileLayout', 'useSaveMobileLayout', 'useResetMobileLayout',
      // Subscriptions.
      'useBoardSubscription', 'useMySubscription', 'useRefreshSubscription',
      'useDeleteBoard', 'useTransferBoard',
      'isSubscriptionRequired',
    ];
    for (const name of hooks) {
      expect(typeof (api as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
