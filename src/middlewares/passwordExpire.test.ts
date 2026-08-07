import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usersService } from '../masters/user/user.service';
import { checkPasswordExpire } from './passwordExpire';

vi.mock('../masters/user/user.service', () => ({
  usersService: { getUserDetails: vi.fn() }
}));

describe('password-expiry middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('looks up only an active username and continues for a current password', async () => {
    vi.mocked(usersService.getUserDetails).mockResolvedValue({
      passwordExpiredAt: new Date()
    } as never);
    const next = vi.fn();

    await checkPasswordExpire({ body: { username: 'user@example.test' } }, {} as any, next);

    expect(usersService.getUserDetails).toHaveBeenCalledWith({
      username: 'user@example.test',
      user_status: 'active'
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('continues when the account has no password timestamp', async () => {
    vi.mocked(usersService.getUserDetails).mockResolvedValue(null as never);
    const next = vi.fn();
    await checkPasswordExpire({ body: { username: 'user@example.test' } }, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes an expired-password denial to the central error handler', async () => {
    const expired = new Date();
    expired.setMonth(expired.getMonth() - 4);
    vi.mocked(usersService.getUserDetails).mockResolvedValue({ passwordExpiredAt: expired } as never);
    const next = vi.fn();

    await checkPasswordExpire({ body: { username: 'user@example.test' } }, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Your password has expired. Please reset your password to continue.',
      status: 403
    }));
  });

  it('passes lookup failures to the central error handler', async () => {
    const error = new Error('database unavailable');
    vi.mocked(usersService.getUserDetails).mockRejectedValue(error);
    const next = vi.fn();
    await checkPasswordExpire({ body: { username: 'user@example.test' } }, {} as any, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
