import {
  IVerificationCode,
  VerificationCodeModel
} from '../../models/userVerification.model';

interface VerificationCodeIssue {
  email: string;
  firstName: string;
  lastName?: string;
  code: string;
}

class PasswordResetAuthorizationService {
  async issueVerificationCode(
    record: VerificationCodeIssue
  ): Promise<IVerificationCode> {
    await VerificationCodeModel.deleteMany({ email: record.email });
    return await VerificationCodeModel.create(record);
  }

  async markPasswordResetVerified(
    email: string,
    code: string
  ): Promise<IVerificationCode | null> {
    return await VerificationCodeModel.findOneAndUpdate(
      { email, code },
      {
        $set: {
          verificationPurpose: 'password_reset',
          verifiedAt: new Date()
        }
      },
      { new: true }
    );
  }

  async consumePasswordResetAuthorization(
    email: string
  ): Promise<IVerificationCode | null> {
    return await VerificationCodeModel.findOneAndDelete({
      email,
      verificationPurpose: 'password_reset',
      verifiedAt: { $exists: true }
    });
  }
}

export const passwordResetAuthorizationService =
  new PasswordResetAuthorizationService();
