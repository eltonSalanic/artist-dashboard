import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter, toErrorBody } from './all-exceptions.filter';
import { setErrorReporter } from './error-reporter';

const prismaError = (code: string) =>
  Object.assign(new Error('raw prisma text'), {
    name: 'PrismaClientKnownRequestError',
    code,
  });

describe('toErrorBody', () => {
  it('keeps an HttpException message and status', () => {
    expect(
      toErrorBody(
        new ConflictException('That person is already a board member'),
      ),
    ).toEqual({
      statusCode: 409,
      message: 'That person is already a board member',
    });
  });

  it('keeps validation issues and code from an object response', () => {
    const body = toErrorBody(
      new BadRequestException({
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        issues: [{ path: 'title', message: 'Required' }],
      }),
    );
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      issues: [{ path: 'title', message: 'Required' }],
    });
  });

  it('maps Prisma unique and not-found errors without leaking their text', () => {
    expect(toErrorBody(prismaError('P2002'))).toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
    expect(toErrorBody(prismaError('P2025'))).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    expect(JSON.stringify(toErrorBody(prismaError('P2002')))).not.toContain(
      'raw prisma',
    );
  });

  it('hides anything else behind a generic 500', () => {
    expect(toErrorBody(new Error('db password is hunter2'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL',
      message: 'Internal server error',
    });
  });
});

describe('AllExceptionsFilter', () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const reporter = jest.fn();
  const filter = new AllExceptionsFilter();

  const hostFor = (): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/boards/b1/tasks',
          headers: { 'x-request-id': 'req-9' },
          user: { userId: 'u1' },
        }),
        getResponse: () => ({ status, headersSent: false }),
      }),
    }) as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    setErrorReporter(reporter);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  it('echoes the request id and reports 500s with context', () => {
    const boom = new Error('boom');
    filter.catch(boom, hostFor());
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-9', code: 'INTERNAL' }),
    );
    expect(reporter).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({ requestId: 'req-9', userId: 'u1' }),
    );
  });

  it('does not report expected 4xx errors', () => {
    filter.catch(new ForbiddenException(), hostFor());
    expect(status).toHaveBeenCalledWith(403);
    expect(reporter).not.toHaveBeenCalled();
  });
});
