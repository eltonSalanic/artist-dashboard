/**
 * Platform-agnostic data layer, shared by `apps/web` and `apps/mobile`.
 *
 * Call `configureApiClient()` once at app startup before anything here runs —
 * it supplies the base URL, the access-token source, and the notifier, none of
 * which can be resolved the same way on both platforms.
 */

export {
  ApiError,
  NetworkError,
  apiFetch,
  configureApiClient,
  notify,
  resetApiClient,
  type ApiClientConfig,
  type ApiFetchInit,
  type Notifier,
} from './client';

export {
  INLINE_ERROR,
  MESSAGES,
  authErrorMessage,
  type AuthErrorLike,
  isNotFound,
  isUnexpectedError,
  showsInlineError,
  toUserMessage,
} from './messages';

export { PermissionsProvider, usePermissions } from './auth/permissions';

export * from './activity/types';
export * from './activity/use-activity';
export * from './appearance/use-board-theme';
export * from './archive/types';
export * from './archive/use-archive';
export * from './attachments/use-attachments';
export * from './auth/auth-client';
export * from './auth/supabase-auth-client';
export * from './auth/types';
export * from './auth/use-board';
export * from './auth/use-me';
export * from './auth/use-session';
export * from './comments/types';
export * from './comments/use-comments';
export * from './custom-widget/use-custom-widget';
export * from './dashboard/use-layout';
export * from './dashboard/use-mobile-layout';
export * from './finances/use-finances';
export * from './mentions/types';
export * from './mentions/use-inbox';
export * from './mentions/use-mentions';
export * from './notes/use-notes';
export * from './links/use-item-links';
export * from './notifications/devices';
export * from './planning/types';
export * from './planning/use-calendar';
export * from './planning/use-cross-board-calendar';
export * from './planning/use-events';
export * from './planning/use-focus';
export * from './planning/use-goals';
export * from './planning/use-reminders';
export * from './settings/use-invites';
export * from './settings/use-members';
export * from './settings/use-notification-preferences';
export * from './settings/use-statuses';
export * from './settings/use-show-statuses';
export * from './tasks/types';
export * from './tasks/use-can-change-status';
export * from './tasks/use-tasks';
