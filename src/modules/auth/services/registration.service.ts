import { MailerService } from "../../../core/mailer/mailer.service";
import { companyService } from "../../company/services/company.service";
import { usersService } from "../../users/services/user.service";
import { IAccount } from "../../company/models/account.model";
import { verificationChallenges, verificationEmail, validateNewPassword } from './verification-challenge.service';
import { withTransaction } from "../../../common/utils/transaction.helper";
import { analysisFeatureService } from "../../settings/services/analysisFeature.service";
import { DEFAULT_ANALYSIS_FEATURES } from "../../settings/constants/default-analysis-features.constant";
import { normalizeExperienceProfile } from "../../../common/constants/experience-profile.constant";

class RegistrationService {
  private mailerService: MailerService;
  
  constructor() {
    this.mailerService = new MailerService();
  }
  async verifyOTPCode(body: any) {
    body.email = verificationEmail(body.email);
    validateNewPassword(body.password);
    await verificationChallenges.consumeOtp(body.email, body.verificationCode, 'registration');

    let createdAccountId: any = null;
    try {
      return await withTransaction(async (session) => {
        const accountBody = {
          account_name: body.account_name,
          type: body.type,
          experience_profile: normalizeExperienceProfile(body.experience_profile),
          description: body.description
        };
        const account: IAccount = await companyService.createCompany(accountBody, session);
        if (!account) {
          throw Object.assign(new Error("Account creation failed"), { status: 500 });
        }
        createdAccountId = account._id;
        
        body.isFirstUser = true;
        body.user_role = "admin";
        body.isVerified = true;
        
        const userDetails = await usersService.createNewUser(body, account._id, session);
        if (!userDetails) {
          throw Object.assign(new Error("User creation failed"), { status: 500 });
        }
        await analysisFeatureService.createFeatureData({
          account_id: String(account._id),
          featuresJson: DEFAULT_ANALYSIS_FEATURES,
          createdBy: userDetails.userDetails?._id
        }, session);
        
        await this.mailerService.sendRegistrationConfirmation(userDetails.userDetails, account);
        return userDetails;
      });
    } catch (error) {
      // Manual cleanup for standalone instances where transactions are not supported
      if (createdAccountId) {
        try {
          console.log(`Cleaning up account ${createdAccountId} due to registration failure...`);
          await companyService.removeById(createdAccountId, null);
        } catch (cleanupError) {
          console.error("Manual cleanup failed:", cleanupError);
        }
      }
      throw error;
    }
  }

  async emailVerificationCode(match: any) {
    return await this.mailerService.sendVerificationCode(match, 'registration');
  }
}

export const registrationService = new RegistrationService();
