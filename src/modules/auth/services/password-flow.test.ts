import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { VerificationCodeModel } from '../models/userVerification.model';
import { UserModel } from '../../users/models/user.model';
import { verificationChallenges } from './verification-challenge.service';
import { resetPasswordController } from '../controllers/resetPassword.controller';
import { userController } from '../../users/controllers/user.controller';
import { usersService } from '../../users/services/user.service';
import { userResetPassword } from './authentication.service';
import { registrationService } from './registration.service';
import { verificationController } from '../controllers/verification.controller';
import { analysisFeatureService } from '../../settings/services/analysisFeature.service';
import { DEFAULT_ANALYSIS_FEATURES } from '../../settings/constants/default-analysis-features.constant';
import { companyService } from '../../company/services/company.service';
import { MailerService } from '../../../core/mailer/mailer.service';
import { passwordService } from '../../../common/utils/bcrypt.helper';

const user: any = { _id: '64a000000000000000000001', account_id: '64a000000000000000000002', email: 'test@example.com', firstName: 'Test', user_status: 'active' };
function persistence(t: any) {
  let record: any;
  const matches = (filter: any) => record && (!filter.email || record.email === filter.email)
    && record.code === filter.code && record.createdAt > filter.createdAt.$gt && record.createdAt <= filter.createdAt.$lte;
  t.mock.method(VerificationCodeModel, 'findOneAndUpdate', async (filter: any, update: any, options: any) => {
    if (!options?.upsert && !matches(filter)) return null;
    record = { ...record, ...update.$set }; return { ...record };
  });
  t.mock.method(VerificationCodeModel, 'findOneAndDelete', async (filter: any) => {
    if (!matches(filter)) return null;
    const result = record; record = null; return result;
  });
  t.mock.method(usersService, 'getAllUsers', async () => [user]);
  t.mock.method(UserModel, 'findOne', async () => user);
}
async function call(handler: any, body: any, authenticatedUser?: any) {
  const result: any = { cookies: [] };
  const response: any = { status(code: number) { result.code = code; return this; },
    json(data: any) { result.body = data; return this; },
    clearCookie(name: string) { result.cookies.push(name); return this; }, once() {} };
  await handler({ body, headers: {}, user: authenticatedUser }, response, (error: any) => { result.error = error; });
  return result;
}

test('real reset controllers exchange proof, bind email, validate before consume and allow exactly one concurrent reset', async t => {
  persistence(t);
  let writes = 0;
  t.mock.method(usersService, 'updateUserPassword', async () => { writes++; });
  const otp = await verificationChallenges.issueOtp(user, 'password-reset');
  const verified = await Promise.all([call(resetPasswordController.userOTPVerification, { email: user.email, verificationCode: otp }), call(resetPasswordController.userOTPVerification, { email: user.email, verificationCode: otp })]);
  assert.equal(verified.filter(result => result.body?.status).length, 1);
  const success = verified.find(result => result.body?.status);
  assert.equal(success.code, 200);
  assert.deepEqual(Object.keys(success.body).sort(), ['data', 'message', 'status']);
  const body = { email: user.email, resetToken: success.body.data.resetToken, newPassword: 'Strong1!', confirmNewPassword: 'Strong1!' };
  for (const invalid of [{ ...body, resetToken: undefined }, { ...body, email: 'other@example.com' }, { ...body, resetToken: 'access.jwt.token' }, { ...body, newPassword: 'weak', confirmNewPassword: 'weak' }]) {
    assert.ok((await call(userController.changeUserPassword, invalid)).error);
  }
  assert.equal(writes, 0);
  const changed = await Promise.all([call(userController.changeUserPassword, body), call(userController.changeUserPassword, body)]);
  assert.equal(changed.filter(result => result.body?.status).length, 1);
  assert.equal(writes, 1);
  assert.ok(changed.find(result => result.body?.status).cookies.length > 0);
});

test('legacy reset accepts only the same single-use reset grant and preserves its response envelope', async t => {
  persistence(t);
  let writes = 0;
  t.mock.method(usersService, 'updateUserPassword', async () => { writes++; });
  const otp = await verificationChallenges.issueOtp(user, 'password-reset');
  assert.ok((await call(userResetPassword, { token: otp, password: 'Strong1!' })).error);
  const token = await verificationChallenges.exchangeResetOtp(user.email, otp);
  const result = await call(userResetPassword, { token, password: 'Strong1!' });
  assert.deepEqual(result.body, { status: true, message: 'Password reset successful' });
  assert.ok(result.cookies.length > 0);
  assert.ok((await call(userResetPassword, { token, password: 'Strong1!' })).error);
  assert.equal(writes, 1);
});

test('email verification consumes only its own challenge before marking the user verified', async t => {
  persistence(t);
  let verified = 0;
  t.mock.method(usersService, 'userVerified', async () => { verified++; return user; });
  const wrongPurpose = await verificationChallenges.issueOtp(user, 'password-reset');
  assert.ok((await call(verificationController.userOTPVerification, { email: user.email, verificationCode: wrongPurpose })).error);
  const otp = await verificationChallenges.issueOtp(user, 'email-verification');
  const result = await call(verificationController.userOTPVerification, { email: user.email, verificationCode: otp });
  assert.deepEqual(result.body, { status: true, message: 'User verified successfully' });
  assert.ok((await call(verificationController.userOTPVerification, { email: user.email, verificationCode: otp })).error);
  assert.equal(verified, 1);
});

test('registration consumes its challenge before creating the account/user and cannot replay', async t => {
  persistence(t);
  t.mock.method(mongoose, 'startSession', async () => ({ startTransaction() {}, async commitTransaction() {}, async abortTransaction() {}, async endSession() {} }) as any);
  let created = 0;
  let featuresCreated = 0;
  t.mock.method(analysisFeatureService, 'createFeatureData', async (payload: any) => {
    featuresCreated++;
    assert.equal(payload.account_id, user.account_id);
    assert.deepEqual(payload.featuresJson, DEFAULT_ANALYSIS_FEATURES);
    return {} as any;
  });
  t.mock.method(companyService, 'createCompany', async () => { created++; return { _id: user.account_id } as any; });
  t.mock.method(usersService, 'createNewUser', async () => ({ userDetails: user, roleDetails: {} }) as any);
  t.mock.method(MailerService.prototype, 'sendRegistrationConfirmation', async () => true);
  const otp = await verificationChallenges.issueOtp(user, 'registration');
  const body = { email: user.email, password: 'Strong1!', verificationCode: otp };
  const result = await registrationService.verifyOTPCode({ ...body });
  assert.equal(result.userDetails.email, user.email);
  await assert.rejects(registrationService.verifyOTPCode({ ...body }));
  assert.equal(created, 1);
  assert.equal(featuresCreated, 1);
});

test('existing reset and legacy route paths are preserved', () => {
  const root = path.resolve(__dirname, '../../..');
  const reset = fs.readFileSync(path.join(root, 'modules/auth/routes/resetPassword.routes.ts'), 'utf8');
  for (const route of ['/reset-password', '/send-verification-email', '/verify-otp', '/change-password']) assert.ok(reset.includes(`'${route}'`));
  const legacy = fs.readFileSync(path.join(root, 'modules/auth/routes/authentication.routes.ts'), 'utf8');
  assert.ok(legacy.includes("'/updatePassword'"));
});

test('authenticated password change uses the same scoped update and clears auth cookies', async t => {
  t.mock.method(usersService, 'getUserDetails', async () => user);
  t.mock.method(passwordService, 'comparePassword', async () => true);
  let writes = 0;
  t.mock.method(usersService, 'updateUserPassword', async (id: any, password: string, account: any) => {
    assert.equal(id, user._id); assert.equal(account, user.account_id); assert.equal(password, 'Strong1!'); writes++;
  });
  const result = await call(userController.updatePasswordUser, { password: 'old-password', newPassword: 'Strong1!', confirmNewPassword: 'Strong1!' }, user);
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, true);
  assert.ok(result.cookies.length > 0);
  assert.equal(writes, 1);
});
