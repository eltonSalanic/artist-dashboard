/**
 * The one error body the API sends and both clients read. Nest's own
 * HttpExceptions already produce `statusCode` + `message`; the exception
 * filter adds `code` for errors it maps itself, and the validation pipe adds
 * `issues` so a form can say which field is wrong instead of just
 * "Validation failed".
 */
export interface ApiErrorIssue {
  /** Dotted field path, e.g. "title" or "items.0.amount". Empty for the whole body. */
  path: string;
  message: string;
}

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'INVITE_EMAIL_FAILED'
  /** Better Auth refused a server-side account change; the message says why. */
  | 'AUTH_REJECTED'
  /** 402: the board needs Band Pro before this route will answer. */
  | 'BOARD_SUBSCRIPTION_REQUIRED'
  | 'INTERNAL';

export interface ApiErrorBody {
  statusCode: number;
  /** User-safe sentence. Never a raw Prisma/Supabase message or stack. */
  message: string;
  code?: ApiErrorCode;
  issues?: ApiErrorIssue[];
  /** Echoes the request's x-request-id so a user report can be found in the logs. */
  requestId?: string;
}

/** Deployment tier. Distinct from NODE_ENV, which staging also sets to "production". */
export type AppEnv = 'development' | 'staging' | 'production';

export function parseAppEnv(value: string | undefined): AppEnv {
  if (value === 'staging' || value === 'production') return value;
  return 'development';
}
