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
