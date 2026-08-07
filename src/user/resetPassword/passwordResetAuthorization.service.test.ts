import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerificationCodeModel } from '../../models/userVerification.model';
import { passwordResetAuthorizationService } from './passwordResetAuthorization.service';

vi.mock('../../models/userVerification.model', () => ({
  VerificationCodeModel: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn()
  }
}));

describe('password-reset authorization state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates prior codes before issuing a replacement', async () => {
    const record = {
      email: 'operator@example.com',
      firstName: 'Pat',
      lastName: 'Operator',
      code: '123456'
    };
    vi.mocked(VerificationCodeModel.deleteMany).mockResolvedValue({
      acknowledged: true,
      deletedCount: 1
    } as never);
    vi.mocked(VerificationCodeModel.create).mockResolvedValue(record as never);

    await expect(
      passwordResetAuthorizationService.issueVerificationCode(record)
    ).resolves.toEqual(record);

    expect(VerificationCodeModel.deleteMany).toHaveBeenCalledOnce();
    expect(VerificationCodeModel.deleteMany).toHaveBeenCalledWith({
      email: record.email
    });
    expect(VerificationCodeModel.create).toHaveBeenCalledOnce();
    expect(VerificationCodeModel.create).toHaveBeenCalledWith(record);
    expect(
      vi.mocked(VerificationCodeModel.deleteMany).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(VerificationCodeModel.create).mock.invocationCallOrder[0]!
    );
  });

  it('marks only the exact email and OTP as password-reset verified', async () => {
    vi.mocked(VerificationCodeModel.findOneAndUpdate).mockResolvedValue({
      email: 'operator@example.com',
      code: '123456',
      verificationPurpose: 'password_reset'
    } as never);

    await passwordResetAuthorizationService.markPasswordResetVerified(
      'operator@example.com',
      '123456'
    );

    expect(VerificationCodeModel.findOneAndUpdate).toHaveBeenCalledOnce();
    expect(VerificationCodeModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        email: 'operator@example.com',
        code: '123456'
      },
      {
        $set: {
          verificationPurpose: 'password_reset',
          verifiedAt: expect.any(Date)
        }
      },
      { new: true }
    );
  });

  it('atomically consumes only a verified password-reset authorization', async () => {
    vi.mocked(VerificationCodeModel.findOneAndDelete).mockResolvedValue({
      email: 'operator@example.com',
      verificationPurpose: 'password_reset'
    } as never);

    await passwordResetAuthorizationService.consumePasswordResetAuthorization(
      'operator@example.com'
    );

    expect(VerificationCodeModel.findOneAndDelete).toHaveBeenCalledOnce();
    expect(VerificationCodeModel.findOneAndDelete).toHaveBeenCalledWith({
      email: 'operator@example.com',
      verificationPurpose: 'password_reset',
      verifiedAt: { $exists: true }
    });
  });
});
