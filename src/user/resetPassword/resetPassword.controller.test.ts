import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPasswordController } from './resetPassword.controller';
import { resetPasswordService } from './resetPassword.service';
import { usersService } from '../../masters/user/user.service';

vi.mock('./resetPassword.service', () => ({
  resetPasswordService: {
    sendVerificationEmailCode: vi.fn(),
    verifyOTPExists: vi.fn(),
    verifyUserOTP: vi.fn()
  }
}));

vi.mock('../../masters/user/user.service', () => ({
  usersService: {
    getAllUsers: vi.fn()
  }
}));

describe('public password-reset verification controller', () => {
  const email = 'operator@example.com';
  const activeUser = {
    _id: '507f1f77bcf86cd799439011',
    email,
    firstName: 'Pat',
    lastName: 'Operator',
    user_status: 'active'
  };

  const makeResponse = () => {
    const response: any = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersService.getAllUsers).mockResolvedValue([activeUser] as never);
    vi.mocked(resetPasswordService.sendVerificationEmailCode).mockResolvedValue(true as never);
    vi.mocked(resetPasswordService.verifyOTPExists).mockResolvedValue({ email } as never);
    vi.mocked(resetPasswordService.verifyUserOTP).mockResolvedValue({ email } as never);
  });

  it('requires an email before requesting a reset code', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await resetPasswordController.sendVerificationEmail(
      { body: {} } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    expect(usersService.getAllUsers).not.toHaveBeenCalled();
  });

  it.each([
    {
      users: [],
      message: 'User not registered. Please register first.'
    },
    {
      users: [{ ...activeUser, user_status: 'inactive' }],
      message: 'User is not active, Please contact admin.'
    }
  ])('rejects an unavailable reset account', async ({ users, message }) => {
    vi.mocked(usersService.getAllUsers).mockResolvedValue(users as never);
    const response = makeResponse();
    const next = vi.fn();

    await resetPasswordController.sendVerificationEmail(
      { body: { email } } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message }));
    expect(resetPasswordService.sendVerificationEmailCode).not.toHaveBeenCalled();
  });

  it('sends the reset code using the canonical stored user identity', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await resetPasswordController.sendVerificationEmail(
      { body: { email } } as any,
      response,
      next
    );

    expect(resetPasswordService.sendVerificationEmailCode).toHaveBeenCalledWith({
      email,
      firstName: activeUser.firstName,
      lastName: activeUser.lastName
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    {
      body: { email },
      message: 'Email and OTP are required'
    },
    {
      body: { email, verificationCode: '123' },
      message: 'invalid OTP (One Time Password)'
    }
  ])('rejects invalid reset OTP input', async ({ body, message }) => {
    const response = makeResponse();
    const next = vi.fn();

    await resetPasswordController.userOTPVerification(
      { body } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message }));
    expect(resetPasswordService.verifyUserOTP).not.toHaveBeenCalled();
  });

  it('distinguishes expired and incorrect reset codes', async () => {
    vi.mocked(resetPasswordService.verifyOTPExists).mockResolvedValue(null);
    const expiredResponse = makeResponse();
    const expiredNext = vi.fn();

    await resetPasswordController.userOTPVerification(
      { body: { email, verificationCode: '123456' } } as any,
      expiredResponse,
      expiredNext
    );

    expect(expiredNext).toHaveBeenCalledWith(expect.objectContaining({ status: 410 }));

    vi.mocked(resetPasswordService.verifyOTPExists).mockResolvedValue({ email } as never);
    vi.mocked(resetPasswordService.verifyUserOTP).mockResolvedValue(null);
    const invalidResponse = makeResponse();
    const invalidNext = vi.fn();

    await resetPasswordController.userOTPVerification(
      { body: { email, verificationCode: '123456' } } as any,
      invalidResponse,
      invalidNext
    );

    expect(invalidNext).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  it('marks the exact OTP as verified before returning success', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await resetPasswordController.userOTPVerification(
      { body: { email, verificationCode: '123456' } } as any,
      response,
      next
    );

    expect(resetPasswordService.verifyUserOTP).toHaveBeenCalledOnce();
    expect(resetPasswordService.verifyUserOTP).toHaveBeenCalledWith({
      email,
      code: '123456'
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'User OTP verified successfully'
    });
    expect(next).not.toHaveBeenCalled();
  });
});
