import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody } from '@artist/shared';
import type { AuthedRequest } from './authed-request';
import { reportError } from './error-reporter';

/**
 * Every error leaves the API in one shape (`ApiErrorBody`) with a user-safe
 * message and the request id, so clients can show something useful and a
 * user's report can be matched to the log line.
 *
 * Nest's default handler turned anything that wasn't an HttpException into a
 * bare 500, including Prisma's "unique constraint" and "record not found",
 * which are ordinary races (two people adding the same member, a row deleted
 * between the check and the update). Those now map to 409 and 404.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<AuthedRequest>();
    const response = http.getResponse<Response>();

    const body = toErrorBody(exception);
    const requestId = request.headers['x-request-id'];
    if (typeof requestId === 'string') body.requestId = requestId;

    const context = {
      requestId: body.requestId,
      userId: request.user?.userId,
      route: `${request.method} ${request.originalUrl ?? request.url}`,
      status: body.statusCode,
    };
    if (body.statusCode >= 500) {
      this.logger.error(
        { msg: describe(exception), ...context },
        exception instanceof Error ? exception.stack : undefined,
      );
      reportError(exception, context);
    } else {
      this.logger.debug({ msg: body.message, ...context });
    }

    if (!response.headersSent) {
      response.status(body.statusCode).json(body);
    }
  }
}

export function toErrorBody(exception: unknown): ApiErrorBody {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    if (typeof res === 'string') return { statusCode: status, message: res };
    const { message, code, issues } = res as Partial<ApiErrorBody> & {
      message?: string | string[];
    };
    return {
      statusCode: status,
      message: Array.isArray(message)
        ? message.join(', ')
        : (message ?? exception.message),
      ...(code ? { code } : {}),
      ...(issues ? { issues } : {}),
    };
  }

  // Better Auth's APIError from a server-side call (e.g. setting a password):
  // its status and code are meant for the caller, not a 500.
  const authError = betterAuthError(exception);
  if (authError) return authError;

  const prismaCode = prismaErrorCode(exception);
  if (prismaCode === 'P2002') {
    return {
      statusCode: HttpStatus.CONFLICT,
      code: 'CONFLICT',
      message: 'That already exists.',
    };
  }
  if (prismaCode === 'P2025') {
    return {
      statusCode: HttpStatus.NOT_FOUND,
      code: 'NOT_FOUND',
      message: 'That item no longer exists. It may have been deleted.',
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL',
    message: 'Internal server error',
  };
}

/**
 * Duck-typed rather than `instanceof Prisma.PrismaClientKnownRequestError` so
 * the filter doesn't import the generated client (and specs needn't build one).
 */
function prismaErrorCode(exception: unknown): string | undefined {
  if (
    !(exception instanceof Error) ||
    exception.name !== 'PrismaClientKnownRequestError'
  ) {
    return undefined;
  }
  const { code } = exception as Error & { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

function describe(exception: unknown): string {
  if (exception instanceof Error)
    return `${exception.name}: ${exception.message}`;
  return String(exception);
}

/** Duck-typed for the same reason as Prisma's: no runtime import of better-auth. */
function betterAuthError(exception: unknown): ApiErrorBody | undefined {
  if (!(exception instanceof Error) || exception.name !== 'APIError') {
    return undefined;
  }
  const { statusCode, body } = exception as Error & {
    statusCode?: number;
    body?: { code?: string; message?: string };
  };
  if (typeof statusCode !== 'number' || statusCode >= 500) return undefined;
  return {
    statusCode,
    code: 'AUTH_REJECTED',
    message:
      AUTH_REJECTIONS[body?.code ?? ''] ?? 'That didn’t work. Try again.',
  };
}

/** Better Auth's codes for the account changes the API makes on a user's behalf. */
const AUTH_REJECTIONS: Record<string, string> = {
  PASSWORD_ALREADY_SET: 'You already have a password. Sign in with it.',
  PASSWORD_TOO_SHORT: 'Choose a stronger password: at least 8 characters.',
  PASSWORD_TOO_LONG: 'That password is too long. Use 128 characters or fewer.',
};
