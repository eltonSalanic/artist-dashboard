/**
 * Platform-agnostic data layer, shared by `apps/web` and `apps/mobile`.
 *
 * Call `configureApiClient()` once at app startup before anything here runs —
 * it supplies the base URL, the access-token source, and the notifier, none of
 * which can be resolved the same way on both platforms.
 */

export {
  ApiError,
  apiFetch,
  configureApiClient,
  notify,
  resetApiClient,
  type ApiClientConfig,
  type ApiFetchInit,
  type Notifier,
} from './client';

export { PermissionsProvider, usePermissions } from './auth/permissions';

export * from './activity/types';
export * from './activity/use-activity';
export * from './appearance/use-board-theme';
export * from './archive/types';
export * from './archive/use-archive';
export * from './auth/types';
export * from './auth/use-me';
export * from './auth/use-session';
export * from './comments/types';
export * from './comments/use-comments';
export * from './custom-widget/use-custom-widget';
export * from './dashboard/use-layout';
export * from './mentions/types';
export * from './mentions/use-mentions';
export * from './planning/types';
export * from './planning/use-calendar';
export * from './planning/use-events';
export * from './planning/use-focus';
export * from './planning/use-goals';
export * from './planning/use-reminders';
export * from './tasks/types';
export * from './tasks/use-can-change-status';
export * from './tasks/use-tasks';
