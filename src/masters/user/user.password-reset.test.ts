import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userController } from './user.controller';
import { usersService } from './user.service';
import { resetPasswordService } from '../../user/resetPassword/resetPassword.service';

vi.mock('./user.service', () => ({
  usersService: {
    getAllUsers: vi.fn(),
    updateUserPassword: vi.fn()
  }
}));

vi.mock('../../user/resetPassword/resetPassword.service', () => ({
  resetPasswordService: {
    consumePasswordResetAuthorization: vi.fn()
  }
}));

describe('public password-reset completion boundary', () => {
  const email = 'operator@example.com';
  const makeResponse = () => {
    const response: any = {
      status: vi.fn(),
      json: vi.fn()
    };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      body: {},
      message: 'Email, new password and confirm password are required'
    },
    {
      body: {
        email,
        newPassword: 'StrongPassword1!',
        confirmNewPassword: 'DifferentPassword1!'
      },
      message: 'Passwords do not match'
    }
  ])('rejects an invalid completion payload', async ({ body, message }) => {
    const response = makeResponse();
    const next = vi.fn();

    await userController.changeUserPassword({ body } as any, response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message }));
    expect(
      resetPasswordService.consumePasswordResetAuthorization
    ).not.toHaveBeenCalled();
    expect(usersService.updateUserPassword).not.toHaveBeenCalled();
  });

  it('requires a verified one-time reset authorization', async () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      email,
      user_status: 'active'
    };
    vi.mocked(usersService.getAllUsers).mockResolvedValue([user] as never);
    vi.mocked(
      resetPasswordService.consumePasswordResetAuthorization
    ).mockResolvedValue(null);
    const response = makeResponse();
    const next = vi.fn();

    await userController.changeUserPassword({
      body: {
        email,
        newPassword: 'StrongPassword1!',
        confirmNewPassword: 'StrongPassword1!'
      }
    } as any, response, next);

    expect(
      resetPasswordService.consumePasswordResetAuthorization
    ).toHaveBeenCalledOnce();
    expect(
      resetPasswordService.consumePasswordResetAuthorization
    ).toHaveBeenCalledWith(email);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 403,
      message: 'OTP verification is required. Please request a new one.'
    }));
    expect(usersService.updateUserPassword).not.toHaveBeenCalled();
  });

  it('consumes authorization before updating the password', async () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      email,
      user_status: 'active',
      password: 'old-password'
    };
    vi.mocked(usersService.getAllUsers).mockResolvedValue([user] as never);
    vi.mocked(
      resetPasswordService.consumePasswordResetAuthorization
    ).mockResolvedValue({ email, verificationPurpose: 'password_reset' } as never);
    vi.mocked(usersService.updateUserPassword).mockResolvedValue(user as never);
    const response = makeResponse();
    const next = vi.fn();

    await userController.changeUserPassword({
      body: {
        email,
        newPassword: 'StrongPassword1!',
        confirmNewPassword: 'StrongPassword1!'
      }
    } as any, response, next);

    expect(
      vi.mocked(
        resetPasswordService.consumePasswordResetAuthorization
      ).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(usersService.updateUserPassword).mock.invocationCallOrder[0]!
    );
    expect(usersService.updateUserPassword).toHaveBeenCalledWith(
      String(user._id),
      expect.objectContaining({
        password: 'StrongPassword1!',
        passwordExpiredAt: expect.any(Date)
      })
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'User password updated successfully'
    });
    expect(next).not.toHaveBeenCalled();
  });
});
