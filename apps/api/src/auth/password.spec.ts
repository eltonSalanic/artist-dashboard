import bcrypt from 'bcryptjs';
import { verifyAnyPassword } from './password';

// better-auth ships ES modules only, which Jest can't load; its scrypt check
// is stood in for here. bcryptjs is the real thing.
const verifyPassword = jest.fn<
  Promise<boolean>,
  [{ hash: string; password: string }]
>();
jest.mock(
  'better-auth/crypto',
  () => ({
    verifyPassword: (data: { hash: string; password: string }) =>
      verifyPassword(data),
  }),
  { virtual: true },
);

describe('verifyAnyPassword', () => {
  beforeEach(() => verifyPassword.mockReset());

  it('checks a bcrypt hash imported from Supabase with bcrypt', async () => {
    const hash = await bcrypt.hash('old-password', 4);
    await expect(
      verifyAnyPassword({ hash, password: 'old-password' }),
    ).resolves.toBe(true);
    await expect(verifyAnyPassword({ hash, password: 'wrong' })).resolves.toBe(
      false,
    );
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("hands Better Auth's own hashes to Better Auth", async () => {
    verifyPassword.mockResolvedValue(true);
    await expect(
      verifyAnyPassword({ hash: 'salt:key', password: 'pw' }),
    ).resolves.toBe(true);
    expect(verifyPassword).toHaveBeenCalledWith({
      hash: 'salt:key',
      password: 'pw',
    });
  });
});
