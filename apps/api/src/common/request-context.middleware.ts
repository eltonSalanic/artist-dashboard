import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from './authed-request';

/**
 * Gives every request an id and one summary log line when it finishes.
 *
 * The id comes from the caller's `x-request-id` when a proxy already set one
 * (Railway does), otherwise it's minted here. It is echoed back as a header
 * and in every error body, so "it broke at 3pm" can be matched to the exact
 * log lines.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: AuthedRequest, response: Response, next: NextFunction): void {
    const incoming = request.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && /^[\w-]{1,128}$/.test(incoming)
        ? incoming
        : randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);

    const started = performance.now();
    response.on('finish', () => {
      // Health checks hit every few seconds and would drown everything else.
      if (request.originalUrl === '/health') return;
      const entry = {
        msg: `${request.method} ${request.originalUrl} ${response.statusCode}`,
        requestId,
        userId: request.user?.userId,
        status: response.statusCode,
        ms: Math.round(performance.now() - started),
      };
      // 5xx are already logged with their stack by the exception filter.
      if (response.statusCode >= 400 && response.statusCode < 500) {
        this.logger.warn(entry);
      } else {
        this.logger.log(entry);
      }
    });
    next();
  }
}
