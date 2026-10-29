import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Auth } from './auth.tokens';
import { SessionAuthGuard, toHeaders } from './session-auth.guard';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SessionAuthGuard', () => {
  const getSession = jest.fn<Promise<unknown>, [{ headers: Headers }]>();
  const auth = { api: { getSession } } as unknown as Auth;
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new SessionAuthGuard(reflector as unknown as Reflector, auth);

  beforeEach(() => jest.clearAllMocks());

  it('lets @Public() routes through without a session lookup', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(getSession).not.toHaveBeenCalled();
  });

  it('sets request.user from the session', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@band.com' } });
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer t.sig' },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'u1', email: 'a@band.com' });
    const { headers } = getSession.mock.calls[0][0];
    expect(headers.get('authorization')).toBe('Bearer t.sig');
  });

  it('rejects a request with no live session', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    getSession.mockResolvedValue(null);
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('toHeaders', () => {
  it('keeps every value of a repeated header', () => {
    const headers = toHeaders({
      'x-a': ['1', '2'],
      'x-b': '3',
      'x-c': undefined,
    });
    expect(headers.get('x-a')).toBe('1, 2');
    expect(headers.get('x-b')).toBe('3');
    expect(headers.has('x-c')).toBe(false);
  });
});
