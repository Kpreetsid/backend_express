import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verificationController } from './verification.controller';
import { verificationService } from './verification.service';
import { usersService } from '../../masters/user/user.service';

vi.mock('./verification.service', () => ({
  verificationService: {
    sendVerificationEmailCode: vi.fn(),
    verifyOTPExists: vi.fn(),
    verifyUserOTP: vi.fn()
  }
}));

vi.mock('../../masters/user/user.service', () => ({
  usersService: {
    getAllUsers: vi.fn(),
    userVerified: vi.fn()
  }
}));

describe('public user-verification controller', () => {
  const email = 'operator@example.com';
  const user = {
    _id: '507f1f77bcf86cd799439011',
    email,
    firstName: 'Pat',
    lastName: 'Operator'
  };

  const makeResponse = () => {
    const response: any = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersService.getAllUsers).mockResolvedValue([user] as never);
    vi.mocked(verificationService.sendVerificationEmailCode).mockResolvedValue(true as never);
    vi.mocked(verificationService.verifyOTPExists).mockResolvedValue({ email } as never);
    vi.mocked(verificationService.verifyUserOTP).mockResolvedValue({ email } as never);
    vi.mocked(usersService.userVerified).mockResolvedValue(user as never);
  });

  it('requires an email and an existing active user before sending a code', async () => {
    const missingResponse = makeResponse();
    const missingNext = vi.fn();
    await verificationController.sendVerificationCode(
      { body: {} } as any,
      missingResponse,
      missingNext
    );
    expect(missingNext).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));

    vi.mocked(usersService.getAllUsers).mockResolvedValue([]);
    const absentResponse = makeResponse();
    const absentNext = vi.fn();
    await verificationController.sendVerificationCode(
      { body: { email } } as any,
      absentResponse,
      absentNext
    );
    expect(absentNext).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
  });

  it('sends a verification code for the canonical stored address', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await verificationController.sendVerificationCode(
      { body: { email } } as any,
      response,
      next
    );

    expect(verificationService.sendVerificationEmailCode).toHaveBeenCalledWith({
      email,
      firstName: user.firstName,
      lastName: user.lastName
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    { body: { email }, status: 400 },
    { body: { email, verificationCode: '123' }, status: 400 }
  ])('rejects invalid verification OTP input', async ({ body, status }) => {
    const response = makeResponse();
    const next = vi.fn();

    await verificationController.userOTPVerification(
      { body } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status }));
    expect(verificationService.verifyUserOTP).not.toHaveBeenCalled();
  });

  it('rejects expired and incorrect verification codes', async () => {
    vi.mocked(verificationService.verifyOTPExists).mockResolvedValue(null);
    const expiredNext = vi.fn();
    await verificationController.userOTPVerification(
      { body: { email, verificationCode: '123456' } } as any,
      makeResponse(),
      expiredNext
    );
    expect(expiredNext).toHaveBeenCalledWith(expect.objectContaining({ status: 410 }));

    vi.mocked(verificationService.verifyOTPExists).mockResolvedValue({ email } as never);
    vi.mocked(verificationService.verifyUserOTP).mockResolvedValue(null);
    const invalidNext = vi.fn();
    await verificationController.userOTPVerification(
      { body: { email, verificationCode: '123456' } } as any,
      makeResponse(),
      invalidNext
    );
    expect(invalidNext).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  it('marks the user verified only after matching the exact code', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await verificationController.userOTPVerification(
      { body: { email, verificationCode: '123456' } } as any,
      response,
      next
    );

    expect(verificationService.verifyUserOTP).toHaveBeenCalledWith({
      email,
      code: '123456'
    });
    expect(usersService.userVerified).toHaveBeenCalledOnce();
    expect(usersService.userVerified).toHaveBeenCalledWith(String(user._id));
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'User verified successfully'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed when user verification persistence fails', async () => {
    vi.mocked(usersService.userVerified).mockResolvedValue(null as never);
    const response = makeResponse();
    const next = vi.fn();

    await verificationController.userOTPVerification(
      { body: { email, verificationCode: '123456' } } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
    expect(response.status).not.toHaveBeenCalled();
  });
});
