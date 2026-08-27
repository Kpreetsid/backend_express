const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { VerificationCodeModel } = require('../dist/models/userVerification.model.js');
const { resetPasswordService } = require('../dist/user/resetPassword/resetPassword.service.js');
const { resetPasswordController } = require('../dist/user/resetPassword/resetPassword.controller.js');
const { userController } = require('../dist/masters/user/user.controller.js');
const { usersService } = require('../dist/masters/user/user.service.js');
const { TokenModel } = require('../dist/models/userToken.model.js');
const authConfig = require('../dist/_config/auth.js');
const { isStrongPassword } = require('../dist/utils/passwordPolicy.js');
const jwt = require('jsonwebtoken');
const { verifyInternalAdminAccessToken } = require('../dist/_config/internalAuth.js');
const { notificationService } = require('../dist/utils/notification.service.js');
const { UserModel } = require('../dist/models/user.model.js');
const { companyService } = require('../dist/masters/company/company.service.js');
const { passwordService } = require('../dist/utils/bcrypt.js');
const { userAuthentication, assertPasswordNotExpired } = require('../dist/user/authentication/authentication.service.js');
const { registrationController } = require('../dist/user/registration/registration.controller.js');
const { rolesController } = require('../dist/masters/user/role/roles.controller.js');
const { rolesService } = require('../dist/masters/user/role/roles.service.js');
const { sanitizePermissionPatch } = require('../dist/masters/user/role/permissionPolicy.js');
const { MapUserAssetLocationModel } = require('../dist/models/mapUserLocation.model.js');
const { userLogsController } = require('../dist/masters/user/logs/logs.controller.js');
const { verificationService } = require('../dist/user/verification/verification.service.js');
const { uploadFilesService } = require('../dist/upload/upload.multer.js');
const { sanitizeAnalysisFeatureSelection } = require('../dist/masters/analysisFeature/selectionPolicy.js');
const { analysisFeatureService } = require('../dist/masters/analysisFeature/analysisFeature.service.js');
const { analysisFeatureController } = require('../dist/masters/analysisFeature/analysisFeature.controller.js');
const { AnalysisFeatureModel } = require('../dist/models/analysisFeature.model.js');
const { userAssetController } = require('../dist/transaction/mapUserAsset/userAsset.controller.js');
const { mapUserToAssetService } = require('../dist/transaction/mapUserAsset/userAsset.service.js');
const { AssetModel } = require('../dist/models/asset.model.js');
const { assetController } = require('../dist/masters/asset/asset.controller.js');
const { assetService } = require('../dist/masters/asset/asset.service.js');
const { LocationModel } = require('../dist/models/location.model.js');
const { locationController } = require('../dist/masters/location/location.controller.js');
const { locationService } = require('../dist/masters/location/location.service.js');
const { floorMapController } = require('../dist/masters/floorMap/floorMap.controller.js');
const { floorMapService } = require('../dist/masters/floorMap/floorMap.service.js');
const { equipmentController } = require('../dist/masters/equipment/equipment.controller.js');
const { equipmentService } = require('../dist/masters/equipment/equipment.service.js');
const { sanitizeEquipmentPayload } = require('../dist/masters/equipment/equipment.policy.js');
const {
  sanitizeInstructionPayload,
  sanitizeTroubleshootingPayload
} = require('../dist/utils/guidePayload.js');
const {
  assertGuideMutationPermission,
  assertGuideTargetAccessible,
  assertSameGuideContext,
  getGuideContext
} = require('../dist/utils/guideScope.js');
const { WorkInstructions } = require('../dist/models/workInstructions.model.js');
const { TroubleshootGuideModel } = require('../dist/models/troubleshootGuide.model.js');
const { instructionController } = require('../dist/work/instruction/instruction.controller.js');
const { instructionService } = require('../dist/work/instruction/instruction.service.js');
const { WorkRequestModel } = require('../dist/models/workRequest.model.js');
const { WorkOrderModel } = require('../dist/models/workOrder.model.js');
const { CommentsModel } = require('../dist/models/comment.model.js');
const { PartsModel } = require('../dist/models/part.model.js');
const { CycleCountModel } = require('../dist/models/cycleCount.model.js');
const mongoose = require('mongoose');
const { orderController } = require('../dist/work/order/order.controller.js');
const { orderService } = require('../dist/work/order/order.service.js');
const { sanitizeWorkOrderPayload } = require('../dist/work/order/workOrder.policy.js');
const {
  sanitizePartMetadataUpdatePayload,
  sanitizePartPayload
} = require('../dist/masters/part/part.policy.js');
const { sanitizePartTypePayload } = require('../dist/masters/part-type/part-type.policy.js');
const { applyRoleFilter } = require('../dist/utils/roleFilter.js');
const { mapUserToLocationService } = require('../dist/transaction/mapUserLocation/userLocation.service.js');
const { commentService } = require('../dist/work/comments/comment.service.js');
const { partsService } = require('../dist/masters/part/parts.service.js');
const { requestController } = require('../dist/work/request/request.controller.js');
const { requestService } = require('../dist/work/request/request.service.js');
const { sanitizeWorkRequestPayload } = require('../dist/work/request/workRequest.policy.js');
const { scheduleController } = require('../dist/masters/schedule/schedule.controller.js');
const { scheduleService } = require('../dist/masters/schedule/schedule.service.js');
const { sanitizeSchedulePayload } = require('../dist/masters/schedule/schedule.policy.js');
const {
  addCalendarMonths,
  calendarDateInTimeZone,
  dateKeyUtc,
  isScheduleDueOnDate,
  resolveSchedulerTimeZone
} = require('../dist/cron/scheduleCadence.js');
const { schedulerService } = require('../dist/cron/scheduler.service.js');
const { SchedulerModel } = require('../dist/models/scheduleMaster.model.js');
const { ProcedureModel } = require('../dist/models/procedure.model.js');
const { WorkOrderTemplateModel } = require('../dist/models/workOrderTemplate.model.js');
const { SOPsModel } = require('../dist/models/sops.model.js');
const { CategoryModel } = require('../dist/models/formCategory.model.js');
const { InspectionModel } = require('../dist/models/inspection.model.js');
const { MapUserInspectionModel } = require('../dist/models/mapUserInspection.model.js');
const { PostModel } = require('../dist/models/post.model.js');
const { sanitizeStructuredPayload } = require('../dist/utils/structuredPayload.js');
const { sanitizeSopPayload } = require('../dist/masters/sops/sops.policy.js');
const { sanitizeInspectionPayload } = require('../dist/masters/inspection/inspection.policy.js');
const { sanitizeProcedureContent } = require('../dist/work/procedure/procedure.policy.js');
const { orderTemplateService } = require('../dist/work/orderTemplate/orderTemplate.service.js');
const { sopsService } = require('../dist/masters/sops/sops.service.js');
const { formCategoryService } = require('../dist/masters/formCategory/formCategory.service.js');
const { inspectionController } = require('../dist/masters/inspection/inspection.controller.js');
const { inspectionService } = require('../dist/masters/inspection/inspection.service.js');
const { mapInspectionService } = require('../dist/transaction/mapUserInspection/userInspection.service.js');
const { helperService } = require('../dist/utils/helper.js');
const { sanitizePostPayload } = require('../dist/masters/post/post.policy.js');
const { postService } = require('../dist/masters/post/posts.service.js');
const { postController } = require('../dist/masters/post/posts.controller.js');
const { commentService: postCommentService } = require('../dist/masters/post/comments/comments.service.js');
const { postPublishingService } = require('../dist/cron/postPublishing.service.js');
const {
  sanitizeObservationCreatePayload,
  sanitizeObservationUpdatePayload
} = require('../dist/masters/observation/observation.policy.js');
const { observationService } = require('../dist/masters/observation/observation.service.js');
const { observationController } = require('../dist/masters/observation/observation.controller.js');
const { ObservationModel } = require('../dist/models/observation.model.js');
const {
  sanitizeAssetReportCreatePayload,
  sanitizeAssetReportStatusPayload,
  sanitizeAssetReportUpdatePayload
} = require('../dist/reports/asset/asset.policy.js');
const { assetReportService } = require('../dist/reports/asset/asset.service.js');
const { assetReportController } = require('../dist/reports/asset/asset.controller.js');
const { ReportAssetModel } = require('../dist/models/assetReport.model.js');
const { sanitizeLocationReportUpdatePayload } = require('../dist/reports/location/location.policy.js');
const { locationReportService } = require('../dist/reports/location/location.service.js');
const { locationReportController } = require('../dist/reports/location/location.controller.js');
const { ReportLocationModel } = require('../dist/models/locationReport.model.js');

test('OTP verification creates an opaque hashed reset proof', async () => {
  const original = VerificationCodeModel.findOneAndUpdate;
  let capturedQuery;
  let capturedUpdate;
  VerificationCodeModel.findOneAndUpdate = async (query, update) => {
    capturedQuery = query;
    capturedUpdate = update;
    return { _id: 'verification-id' };
  };

  try {
    const token = await resetPasswordService.createResetProof(' User@Example.com ', '123456');
    assert.equal(capturedQuery.email, 'user@example.com');
    assert.equal(capturedQuery.code, '123456');
    assert.equal(typeof token, 'string');
    assert.ok(token.length >= 32);
    assert.notEqual(capturedUpdate.$set.resetTokenHash, token);
    assert.match(capturedUpdate.$set.resetTokenHash, /^[a-f0-9]{64}$/);
    assert.ok(capturedUpdate.$set.resetTokenExpiresAt > new Date());
  } finally {
    VerificationCodeModel.findOneAndUpdate = original;
  }
});

test('reset proof is consumed atomically and cannot be reused', async () => {
  const original = VerificationCodeModel.findOneAndDelete;
  const capturedQueries = [];
  let available = true;
  VerificationCodeModel.findOneAndDelete = async (query) => {
    capturedQueries.push(query);
    if (!available) return null;
    available = false;
    return { _id: 'verification-id' };
  };

  try {
    const resetToken = 'single-use-proof-token-that-is-long-enough';
    assert.equal(await resetPasswordService.consumeResetProof('user@example.com', resetToken), true);
    assert.equal(await resetPasswordService.consumeResetProof('user@example.com', resetToken), false);
    assert.equal(capturedQueries.length, 2);
    assert.notEqual(capturedQueries[0].resetTokenHash, resetToken);
    assert.match(capturedQueries[0].resetTokenHash, /^[a-f0-9]{64}$/);
    assert.ok(capturedQueries[0].resetTokenExpiresAt.$gt instanceof Date);
  } finally {
    VerificationCodeModel.findOneAndDelete = original;
  }
});

test('OTP controller returns only the reset proof after a valid code', async () => {
  const originalGetUsers = usersService.getAllUsers;
  const originalCreateProof = resetPasswordService.createResetProof;
  usersService.getAllUsers = async () => [{ email: 'user@example.com', user_status: 'active' }];
  resetPasswordService.createResetProof = async () => 'server-issued-proof';
  const response = responseRecorder();
  let nextError;

  try {
    await resetPasswordController.userOTPVerification(
      { body: { email: 'user@example.com', verificationCode: '123456' } },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, { resetToken: 'server-issued-proof' });
  } finally {
    usersService.getAllUsers = originalGetUsers;
    resetPasswordService.createResetProof = originalCreateProof;
  }
});

test('password-reset requests do not reveal whether an active account exists', async () => {
  const originalGetUsers = usersService.getAllUsers;
  const originalSend = resetPasswordService.sendVerificationEmailCode;
  let sendCalls = 0;
  resetPasswordService.sendVerificationEmailCode = async () => {
    sendCalls += 1;
    return true;
  };

  try {
    usersService.getAllUsers = async () => [];
    const missingResponse = responseRecorder();
    await resetPasswordController.sendVerificationEmail(
      { body: { email: 'MISSING@example.com' } },
      missingResponse,
      error => { throw error; }
    );

    usersService.getAllUsers = async () => [{
      email: 'active@example.com',
      firstName: 'Active',
      lastName: 'User'
    }];
    const activeResponse = responseRecorder();
    await resetPasswordController.sendVerificationEmail(
      { body: { email: 'ACTIVE@example.com' } },
      activeResponse,
      error => { throw error; }
    );

    assert.equal(missingResponse.statusCode, 200);
    assert.equal(activeResponse.statusCode, 200);
    assert.equal(missingResponse.body.message, activeResponse.body.message);
    assert.equal(sendCalls, 1);
  } finally {
    usersService.getAllUsers = originalGetUsers;
    resetPasswordService.sendVerificationEmailCode = originalSend;
  }
});

test('password change rejects a missing or invalid reset proof', async () => {
  const originalGetUsers = usersService.getAllUsers;
  const originalConsume = resetPasswordService.consumeResetProof;
  const originalUpdate = usersService.updateUserPassword;
  let updateCalls = 0;
  usersService.getAllUsers = async () => [{ _id: '507f1f77bcf86cd799439011' }];
  resetPasswordService.consumeResetProof = async () => false;
  usersService.updateUserPassword = async () => { updateCalls += 1; };

  try {
    const missingError = await invokePasswordChange({
      email: 'user@example.com',
      newPassword: 'Strong1!',
      confirmNewPassword: 'Strong1!'
    });
    assert.equal(missingError.status, 400);

    const invalidError = await invokePasswordChange({
      email: 'user@example.com',
      resetToken: 'invalid-proof',
      newPassword: 'Strong1!',
      confirmNewPassword: 'Strong1!'
    });
    assert.equal(invalidError.status, 401);
    assert.equal(updateCalls, 0);
  } finally {
    usersService.getAllUsers = originalGetUsers;
    resetPasswordService.consumeResetProof = originalConsume;
    usersService.updateUserPassword = originalUpdate;
  }
});

test('valid reset proof changes the password and revokes active sessions', async () => {
  const originalGetUsers = usersService.getAllUsers;
  const originalConsume = resetPasswordService.consumeResetProof;
  const originalUpdate = usersService.updateUserPassword;
  const originalDeleteMany = TokenModel.deleteMany;
  const originalClearCache = authConfig.clearAuthSessionCacheForUser;
  const user = { _id: '507f1f77bcf86cd799439011' };
  let updated = false;
  let revokedFor;
  let cacheClearedFor;
  usersService.getAllUsers = async () => [user];
  resetPasswordService.consumeResetProof = async () => true;
  usersService.updateUserPassword = async () => { updated = true; };
  TokenModel.deleteMany = async query => { revokedFor = query.userId; };
  authConfig.clearAuthSessionCacheForUser = userId => { cacheClearedFor = userId; };
  const response = responseRecorder();
  let nextError;

  try {
    await userController.changeUserPassword(
      {
        body: {
          email: 'USER@example.com',
          resetToken: 'valid-proof',
          newPassword: 'Strong1!',
          confirmNewPassword: 'Strong1!'
        }
      },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.equal(updated, true);
    assert.equal(String(revokedFor), user._id);
    assert.equal(cacheClearedFor, user._id);
  } finally {
    usersService.getAllUsers = originalGetUsers;
    resetPasswordService.consumeResetProof = originalConsume;
    usersService.updateUserPassword = originalUpdate;
    TokenModel.deleteMany = originalDeleteMany;
    authConfig.clearAuthSessionCacheForUser = originalClearCache;
  }
});

test('server password policy matches the Angular minimum policy', () => {
  assert.equal(isStrongPassword('Strong1!'), true);
  assert.equal(isStrongPassword('alllowercase1!'), false);
  assert.equal(isStrongPassword('NOLOWERCASE1!'), false);
  assert.equal(isStrongPassword('NoNumber!'), false);
  assert.equal(isStrongPassword('NoSpecial1'), false);
  assert.equal(isStrongPassword('S1!a'), false);
});

test('external login token minting accepts only a signed internal administrator token', () => {
  const secret = process.env.INTERNAL_AUTH_SECRET || process.env.AUTH_SECRET;
  assert.ok(secret, 'test environment must provide an authentication secret');
  const algorithm = process.env.INTERNAL_AUTH_ALGORITHM || process.env.AUTH_ALGORITHM || 'HS256';
  const adminToken = jwt.sign(
    { userId: 'internal-user', username: 'admin', role: 'admin' },
    secret,
    { algorithm, expiresIn: 60 }
  );
  const workerToken = jwt.sign(
    { userId: 'internal-worker', username: 'worker', role: 'worker' },
    secret,
    { algorithm, expiresIn: 60 }
  );

  assert.equal(verifyInternalAdminAccessToken(adminToken).userId, 'internal-user');
  assert.throws(
    () => verifyInternalAdminAccessToken(workerToken),
    error => error.status === 403
  );
  assert.throws(
    () => verifyInternalAdminAccessToken(`${adminToken}tampered`),
    error => error.status === 401
  );
});

test('non-admin account users cannot create, update another user, or delete users', async () => {
  const worker = {
    _id: '507f1f77bcf86cd799439011',
    account_id: '507f191e810c19729de860ea',
    user_role: 'employee'
  };

  const createError = await invokeController(userController.createUser.bind(userController), {
    user: worker,
    body: {}
  });
  assert.equal(createError.status, 403);

  const updateError = await invokeController(userController.updateUser.bind(userController), {
    user: worker,
    params: { id: '507f1f77bcf86cd799439012' },
    body: { user_role: 'admin' }
  });
  assert.equal(updateError.status, 403);

  const deleteError = await invokeController(userController.removeUser.bind(userController), {
    user: worker,
    params: { id: '507f1f77bcf86cd799439012' }
  });
  assert.equal(deleteError.status, 403);
});

test('non-admin self-profile updates discard role, status, password and account changes', async () => {
  const originalGetUsers = usersService.getAllUsers;
  const originalUpdate = usersService.updateUserDetails;
  const originalNotify = notificationService.notifyAccountUsers;
  const worker = {
    _id: '507f1f77bcf86cd799439011',
    account_id: '507f191e810c19729de860ea',
    user_role: 'employee'
  };
  let capturedUpdate;
  usersService.getAllUsers = async () => [{ _id: worker._id }];
  usersService.updateUserDetails = async (_id, _accountId, update) => {
    capturedUpdate = update;
    return { _id, ...update };
  };
  notificationService.notifyAccountUsers = async () => undefined;
  const response = responseRecorder();
  let nextError;

  try {
    await userController.updateUser(
      {
        user: worker,
        params: { id: worker._id },
        body: {
          firstName: 'Updated',
          user_role: 'admin',
          user_status: 'inactive',
          password: 'Plaintext1!',
          account_id: '507f191e810c19729de860eb',
          isVerified: true
        }
      },
      response,
      error => { nextError = error; }
    );

    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.equal(capturedUpdate.firstName, 'Updated');
    assert.equal(String(capturedUpdate.updatedBy), worker._id);
    assert.equal(capturedUpdate.user_role, undefined);
    assert.equal(capturedUpdate.user_status, undefined);
    assert.equal(capturedUpdate.password, undefined);
    assert.equal(capturedUpdate.account_id, undefined);
    assert.equal(capturedUpdate.isVerified, undefined);
  } finally {
    usersService.getAllUsers = originalGetUsers;
    usersService.updateUserDetails = originalUpdate;
    notificationService.notifyAccountUsers = originalNotify;
  }
});

test('unknown-user and wrong-password login attempts return the same error before account lookup', async () => {
  const originalFindOne = UserModel.findOne;
  const originalCompare = passwordService.comparePassword;
  const originalGetCompanies = companyService.getAllCompanies;
  let accountLookups = 0;
  companyService.getAllCompanies = async () => {
    accountLookups += 1;
    return [];
  };

  try {
    UserModel.findOne = () => ({ select: async () => null });
    const unknownError = await invokeAuthentication({ username: 'missing@example.com', password: 'wrong' });

    UserModel.findOne = () => ({
      select: async () => ({
        _id: '507f1f77bcf86cd799439011',
        account_id: '507f191e810c19729de860ea',
        password: 'hash'
      })
    });
    passwordService.comparePassword = async () => false;
    const wrongPasswordError = await invokeAuthentication({ username: 'known@example.com', password: 'wrong' });

    assert.equal(unknownError.status, 401);
    assert.equal(wrongPasswordError.status, 401);
    assert.equal(unknownError.message, 'Invalid credentials');
    assert.equal(wrongPasswordError.message, 'Invalid credentials');
    assert.equal(accountLookups, 0);
  } finally {
    UserModel.findOne = originalFindOne;
    passwordService.comparePassword = originalCompare;
    companyService.getAllCompanies = originalGetCompanies;
  }
});

test('registration rejects a weak password before database work', async () => {
  const originalGetUsers = usersService.getAllUsers;
  let userLookups = 0;
  usersService.getAllUsers = async () => {
    userLookups += 1;
    return [];
  };

  try {
    const error = await invokeController(registrationController.userRegister.bind(registrationController), {
      body: {
        email: 'user@example.com',
        username: 'user',
        firstName: 'User',
        account_name: 'Account',
        password: 'weak'
      }
    });
    assert.equal(error.status, 400);
    assert.equal(userLookups, 0);
  } finally {
    usersService.getAllUsers = originalGetUsers;
  }
});

test('non-admin users cannot list, update, or remove account permission records', async () => {
  const worker = {
    _id: '507f1f77bcf86cd799439011',
    account_id: '507f191e810c19729de860ea',
    user_role: 'employee'
  };
  const roleId = '507f1f77bcf86cd799439099';

  const listError = await invokeController(rolesController.getAll.bind(rolesController), {
    user: worker,
    query: {}
  });
  const updateError = await invokeController(rolesController.updateRole.bind(rolesController), {
    user: worker,
    params: { id: roleId },
    body: { data: { asset: { edit_asset: true } } }
  });
  const deleteError = await invokeController(rolesController.removeRole.bind(rolesController), {
    user: worker,
    params: { id: roleId }
  });

  assert.equal(listError.status, 403);
  assert.equal(updateError.status, 403);
  assert.equal(deleteError.status, 403);
});

test('permission updates accept only existing boolean permission keys', () => {
  const current = {
    asset: { view: true, edit: false },
    workOrder: { create: false }
  };
  assert.deepEqual(
    sanitizePermissionPatch(current, { asset: { edit: true } }),
    {
      asset: { view: true, edit: true },
      workOrder: { create: false }
    }
  );
  assert.throws(
    () => sanitizePermissionPatch(current, { admin: { all: true } }),
    error => error.status === 400
  );
  assert.throws(
    () => sanitizePermissionPatch(current, { asset: { edit: 'yes' } }),
    error => error.status === 400
  );
});

test('administrator permission updates are account scoped and revoke the target sessions', async () => {
  const originalGetRoles = rolesService.getRoles;
  const originalGetUsers = usersService.getAllUsers;
  const originalUpdateRole = rolesService.updateById;
  const originalDeleteMany = TokenModel.deleteMany;
  const originalClearCache = authConfig.clearAuthSessionCacheForUser;
  const actor = {
    _id: '507f1f77bcf86cd799439011',
    account_id: '507f191e810c19729de860ea',
    user_role: 'admin'
  };
  const targetUserId = '507f1f77bcf86cd799439012';
  const roleId = '507f1f77bcf86cd799439099';
  let capturedUpdate;
  let revokedFor;
  let cacheClearedFor;
  rolesService.getRoles = async () => [{
    _id: roleId,
    user_id: targetUserId,
    data: { asset: { view: true, edit: false } }
  }];
  usersService.getAllUsers = async () => [{ _id: targetUserId, isFirstUser: false }];
  rolesService.updateById = async (...args) => {
    capturedUpdate = args;
    return { _id: roleId, data: args[2] };
  };
  TokenModel.deleteMany = async query => { revokedFor = query.userId; };
  authConfig.clearAuthSessionCacheForUser = userId => { cacheClearedFor = userId; };
  const response = responseRecorder();
  let nextError;

  try {
    await rolesController.updateRole(
      {
        user: actor,
        params: { id: roleId },
        body: { data: { asset: { edit: true } } }
      },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.equal(String(capturedUpdate[1]), actor.account_id);
    assert.deepEqual(capturedUpdate[2], { asset: { view: true, edit: true } });
    assert.equal(String(revokedFor), targetUserId);
    assert.equal(cacheClearedFor, targetUserId);
  } finally {
    rolesService.getRoles = originalGetRoles;
    usersService.getAllUsers = originalGetUsers;
    rolesService.updateById = originalUpdateRole;
    TokenModel.deleteMany = originalDeleteMany;
    authConfig.clearAuthSessionCacheForUser = originalClearCache;
  }
});

test('expired passwords are checked only after credential verification', () => {
  assert.doesNotThrow(() => assertPasswordNotExpired({}));
  assert.doesNotThrow(() => assertPasswordNotExpired({ passwordExpiredAt: new Date() }));
  const expired = new Date();
  expired.setMonth(expired.getMonth() - 4);
  assert.throws(
    () => assertPasswordNotExpired({ passwordExpiredAt: expired }),
    error => error.status === 403
  );
});

test('authenticated API sessions require the user to remain active and verified', async () => {
  const originalFindOne = UserModel.findOne;
  let capturedQuery;
  UserModel.findOne = query => {
    capturedQuery = query;
    return { select: async () => null };
  };

  try {
    await usersService.verifyUserLogin({
      id: '507f1f77bcf86cd799439011',
      companyID: '507f191e810c19729de860ea',
      username: 'worker'
    });
    assert.equal(capturedQuery.user_status, 'active');
    assert.equal(capturedQuery.isVerified, true);
  } finally {
    UserModel.findOne = originalFindOne;
  }
});

test('changing a user role resets its permission defaults and revokes existing sessions', async () => {
  const originalGetUsers = usersService.getAllUsers;
  const originalUpdateUser = usersService.updateUserDetails;
  const originalResetRole = rolesService.resetUserRole;
  const originalDeleteMany = TokenModel.deleteMany;
  const originalClearCache = authConfig.clearAuthSessionCacheForUser;
  const originalNotify = notificationService.notifyAccountUsers;
  const actor = {
    _id: '507f1f77bcf86cd799439011',
    account_id: '507f191e810c19729de860ea',
    user_role: 'admin'
  };
  const targetUserId = '507f1f77bcf86cd799439012';
  let resetRole;
  let revokedFor;
  usersService.getAllUsers = async () => [{
    _id: targetUserId,
    account_id: actor.account_id,
    user_role: 'employee',
    user_status: 'active',
    isVerified: true,
    isFirstUser: false
  }];
  usersService.updateUserDetails = async (_id, accountId, update) => ({
    _id,
    account_id: accountId,
    user_role: update.user_role,
    user_status: 'active',
    username: 'target'
  });
  rolesService.resetUserRole = async role => { resetRole = role; };
  TokenModel.deleteMany = async query => { revokedFor = query.userId; };
  authConfig.clearAuthSessionCacheForUser = () => undefined;
  notificationService.notifyAccountUsers = async () => undefined;
  const response = responseRecorder();
  let nextError;

  try {
    await userController.updateUser(
      { user: actor, params: { id: targetUserId }, body: { user_role: 'manager' } },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.equal(resetRole, 'manager');
    assert.equal(String(revokedFor), targetUserId);
  } finally {
    usersService.getAllUsers = originalGetUsers;
    usersService.updateUserDetails = originalUpdateUser;
    rolesService.resetUserRole = originalResetRole;
    TokenModel.deleteMany = originalDeleteMany;
    authConfig.clearAuthSessionCacheForUser = originalClearCache;
    notificationService.notifyAccountUsers = originalNotify;
  }
});

test('the primary administrator and current administrator cannot be demoted or deactivated', async () => {
  const originalGetUsers = usersService.getAllUsers;
  const admin = {
    _id: '507f1f77bcf86cd799439011',
    account_id: '507f191e810c19729de860ea',
    user_role: 'admin'
  };

  try {
    usersService.getAllUsers = async () => [{
      _id: admin._id,
      user_role: 'admin',
      user_status: 'active',
      isFirstUser: false
    }];
    const selfError = await invokeController(userController.updateUser.bind(userController), {
      user: admin,
      params: { id: admin._id },
      body: { user_role: 'employee' }
    });
    assert.equal(selfError.status, 400);

    const primaryId = '507f1f77bcf86cd799439012';
    usersService.getAllUsers = async () => [{
      _id: primaryId,
      user_role: 'admin',
      user_status: 'active',
      isFirstUser: true
    }];
    const primaryError = await invokeController(userController.updateUser.bind(userController), {
      user: admin,
      params: { id: primaryId },
      body: { user_status: 'inactive' }
    });
    assert.equal(primaryError.status, 400);
  } finally {
    usersService.getAllUsers = originalGetUsers;
  }
});

test('location-wise user lookup uses the declared parameter and scopes users to the active account', async () => {
  const originalFind = MapUserAssetLocationModel.find;
  const originalGetUsers = usersService.getAllUsers;
  const accountId = '507f191e810c19729de860ea';
  const locationId = '507f1f77bcf86cd799439099';
  let capturedUserFilter;
  MapUserAssetLocationModel.find = () => ({
    select: async () => [{ userId: '507f1f77bcf86cd799439012' }]
  });
  usersService.getAllUsers = async filter => {
    capturedUserFilter = filter;
    return [{ _id: '507f1f77bcf86cd799439012' }];
  };
  const response = responseRecorder();
  let nextError;

  try {
    await usersService.getLocationWiseUser(
      {
        params: { locationID: locationId },
        user: { account_id: accountId }
      },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.equal(String(capturedUserFilter.account_id), accountId);
    assert.equal(capturedUserFilter.user_status, 'active');
  } finally {
    MapUserAssetLocationModel.find = originalFind;
    usersService.getAllUsers = originalGetUsers;
  }
});

test('non-admin activity-log queries cannot override the authenticated user scope', async () => {
  const worker = {
    _id: '507f1f77bcf86cd799439011',
    account_id: '507f191e810c19729de860ea',
    user_role: 'employee'
  };
  const error = await invokeController(userLogsController.userLogs.bind(userLogsController), {
    user: worker,
    query: { userId: '507f1f77bcf86cd799439012' }
  });

  assert.equal(error.status, 403);
});

test('user-verification codes are consumed atomically within their expiry window', async () => {
  const originalFindOneAndDelete = VerificationCodeModel.findOneAndDelete;
  let capturedQuery;
  VerificationCodeModel.findOneAndDelete = async query => {
    capturedQuery = query;
    return { _id: 'verification-id' };
  };

  try {
    const consumed = await verificationService.consumeUserOTP(' USER@example.com ', '123456');
    assert.ok(consumed);
    assert.equal(capturedQuery.email, 'user@example.com');
    assert.equal(capturedQuery.code, '123456');
    assert.ok(capturedQuery.createdAt.$gt instanceof Date);
  } finally {
    VerificationCodeModel.findOneAndDelete = originalFindOneAndDelete;
  }
});

test('upload validation rejects extension, MIME, and content-signature mismatches', () => {
  assert.equal(
    uploadFilesService.validateFileMetadata('avatar.jpg', 'image/jpeg', 'user_profile_img'),
    'image/jpeg'
  );
  assert.throws(
    () => uploadFilesService.validateFileMetadata('avatar.jpg', 'application/pdf', 'user_profile_img'),
    error => error.status === 415
  );
  assert.throws(
    () => uploadFilesService.validateFileMetadata('resume.pdf', 'application/pdf', 'user_profile_img'),
    error => error.status === 415
  );
  assert.throws(
    () => uploadFilesService.validateFileBuffer(Buffer.from('not an image'), 'image/png'),
    error => error.status === 415
  );
});

test('invalid uploaded content is removed before controllers can persist it', async () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cmms-upload-test-'));
  const tempFile = path.join(tempDirectory, 'spoofed.png');
  fs.writeFileSync(tempFile, 'plain text content');

  try {
    await assert.rejects(
      uploadFilesService.validateStoredUploads([{
        originalname: 'spoofed.png',
        mimetype: 'image/png',
        path: tempFile
      }], 'user_profile_img'),
      error => error.status === 415
    );
    assert.equal(fs.existsSync(tempFile), false);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('analysis feature updates preserve server metadata and accept only known boolean selections', () => {
  const current = [{
    id: 'vibration',
    categoryName: 'Vibration',
    subCategory: [{ id: 'velocity-rms', name: 'Velocity RMS', isSelected: true }]
  }];
  const sanitized = sanitizeAnalysisFeatureSelection(current, [{
    id: 'vibration',
    categoryName: 'Injected category',
    subCategory: [{ id: 'velocity-rms', name: 'Injected feature', isSelected: true }]
  }]);

  assert.equal(sanitized[0].categoryName, 'Vibration');
  assert.equal(sanitized[0].subCategory[0].name, 'Velocity RMS');
  assert.throws(
    () => sanitizeAnalysisFeatureSelection(current, [{
      id: 'vibration',
      subCategory: [{ id: 'unknown', isSelected: true }]
    }]),
    error => error.status === 400
  );
});

test('analysis feature writes are account scoped and store only sanitized selections', async () => {
  const originalFindOne = AnalysisFeatureModel.findOne;
  const originalFindOneAndUpdate = AnalysisFeatureModel.findOneAndUpdate;
  let capturedRead;
  let capturedWrite;
  AnalysisFeatureModel.findOne = async query => {
    capturedRead = query;
    return {
      featuresJson: [{
        id: 'vibration',
        categoryName: 'Vibration',
        subCategory: [{ id: 'velocity-rms', name: 'Velocity RMS', isSelected: false }]
      }]
    };
  };
  AnalysisFeatureModel.findOneAndUpdate = async (query, update) => {
    capturedWrite = { query, update };
    return { _id: query._id, ...update.$set };
  };

  try {
    await analysisFeatureService.updateFeatureData(
      '507f1f77bcf86cd799439011',
      'account-1',
      [{ id: 'vibration', categoryName: 'Tampered', subCategory: [{ id: 'velocity-rms', name: 'Tampered', isSelected: true }] }],
      '507f1f77bcf86cd799439012'
    );
    assert.equal(capturedRead.account_id, 'account-1');
    assert.equal(capturedWrite.query.account_id, 'account-1');
    assert.equal(capturedWrite.update.$set.featuresJson[0].categoryName, 'Vibration');
    assert.equal(capturedWrite.update.$set.featuresJson[0].subCategory[0].isSelected, true);
  } finally {
    AnalysisFeatureModel.findOne = originalFindOne;
    AnalysisFeatureModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('non-admin users cannot update analysis features or asset mail preferences', async () => {
  const worker = {
    _id: '507f1f77bcf86cd799439011',
    account_id: '507f191e810c19729de860ea',
    user_role: 'employee'
  };
  const analysisError = await invokeController(analysisFeatureController.updateFeatureData.bind(analysisFeatureController), {
    user: worker,
    params: { id: '507f1f77bcf86cd799439012' },
    body: { featuresJson: [] }
  });
  const mailError = await invokeController(userAssetController.updateSendMailFlag.bind(userAssetController), {
    user: worker,
    body: [{ _id: '507f1f77bcf86cd799439013', alert: true, danger: false, critical: false }]
  });

  assert.equal(analysisError.status, 403);
  assert.equal(mailError.status, 403);
});

test('administrator mail-preference updates derive the master mail flag and pass account scope', async () => {
  const originalUpdate = mapUserToAssetService.updateMappedUserFlags;
  let capturedBody;
  let capturedAccount;
  mapUserToAssetService.updateMappedUserFlags = async (body, accountId) => {
    capturedBody = body;
    capturedAccount = accountId;
  };

  try {
    const response = responseRecorder();
    let nextError;
    await userAssetController.updateSendMailFlag({
      user: {
        _id: '507f1f77bcf86cd799439011',
        account_id: '507f191e810c19729de860ea',
        user_role: 'admin'
      },
      body: [{
        _id: '507f1f77bcf86cd799439013',
        alert: false,
        danger: false,
        critical: false,
        sendMail: true,
        account_id: 'another-account'
      }]
    }, response, error => { nextError = error; });

    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.equal(String(capturedAccount), '507f191e810c19729de860ea');
    assert.deepEqual(Object.keys(capturedBody[0]).sort(), ['_id', 'alert', 'critical', 'danger', 'sendMail']);
    assert.equal(capturedBody[0].sendMail, false);
  } finally {
    mapUserToAssetService.updateMappedUserFlags = originalUpdate;
  }
});

test('mail preference service rejects mapping IDs outside the active account', async () => {
  const originalAssetCount = AssetModel.countDocuments;
  const originalUserCount = UserModel.countDocuments;
  const originalMappingFind = MapUserAssetLocationModel.find;
  AssetModel.countDocuments = async () => 0;
  UserModel.countDocuments = async () => 1;
  MapUserAssetLocationModel.find = () => ({
    select: () => ({
      lean: async () => [{
        _id: '507f1f77bcf86cd799439023',
        assetId: '507f1f77bcf86cd799439021',
        userId: '507f1f77bcf86cd799439022'
      }]
    })
  });

  try {
    await assert.rejects(
      mapUserToAssetService.updateMappedUserFlags([{
        _id: '507f1f77bcf86cd799439023',
        alert: true,
        danger: false,
        critical: false,
        sendMail: true
      }], '507f191e810c19729de860ea'),
      error => error.status === 404
    );
  } finally {
    AssetModel.countDocuments = originalAssetCount;
    UserModel.countDocuments = originalUserCount;
    MapUserAssetLocationModel.find = originalMappingFind;
  }
});

test('work request payload policy strips status, tenant, workflow and audit fields', () => {
  assert.deepEqual(sanitizeWorkRequestPayload({
    title: 'Leaking seal',
    priority: 'High',
    status: 'Approved',
    account_id: 'another-account',
    visible: false,
    approvedBy: 'another-user',
    review_due_at: '2099-01-01',
    createdBy: 'another-user'
  }), {
    title: 'Leaking seal',
    priority: 'High'
  });
});

test('work request detail lookup ignores query attempts to override tenant and record scope', async () => {
  const originalGetAll = requestService.getAllRequests;
  let capturedFilter;
  requestService.getAllRequests = async filter => {
    capturedFilter = filter;
    return [{ _id: filter._id, title: 'Scoped request' }];
  };
  const response = responseRecorder();
  const activeAccount = '507f191e810c19729de860ea';
  const requestId = '507f1f77bcf86cd799439011';

  try {
    await requestController.getById({
      user: { _id: '507f1f77bcf86cd799439012', account_id: activeAccount, user_role: 'admin' },
      params: { id: requestId },
      query: { account_id: '507f191e810c19729de860ff', _id: '507f1f77bcf86cd799439099', visible: 'false' }
    }, response, error => { throw error; });

    assert.equal(String(capturedFilter.account_id), activeAccount);
    assert.equal(String(capturedFilter._id), requestId);
    assert.equal(capturedFilter.visible, true);
    assert.equal(response.statusCode, 200);
  } finally {
    requestService.getAllRequests = originalGetAll;
  }
});

test('work request list filters use membership matching and return an empty successful list', async () => {
  const originalGetAll = requestService.getAllRequests;
  let capturedFilter;
  requestService.getAllRequests = async filter => {
    capturedFilter = filter;
    return [];
  };
  const response = responseRecorder();

  try {
    await requestController.getAll({
      user: { _id: '507f1f77bcf86cd799439012', account_id: '507f191e810c19729de860ea', user_role: 'admin' },
      query: { priority: 'High,Low', status: 'Open,Approved' }
    }, response, error => { throw error; });

    assert.deepEqual(capturedFilter.priority, { $in: ['High', 'Low'] });
    assert.deepEqual(capturedFilter.status, { $in: ['Open', 'Approved'] });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, []);
  } finally {
    requestService.getAllRequests = originalGetAll;
  }
});

test('work request approval is an account-scoped atomic transition from Open', async () => {
  const originalUpdate = WorkRequestModel.updateOne;
  let capturedFilter;
  let capturedUpdate;
  WorkRequestModel.updateOne = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { modifiedCount: 1 };
  };

  try {
    await requestService.markApproved(
      '507f1f77bcf86cd799439011',
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012',
      'High'
    );
    assert.equal(capturedFilter.account_id, '507f191e810c19729de860ea');
    assert.equal(capturedFilter.status, 'Open');
    assert.equal(capturedFilter.visible, true);
    assert.equal(capturedUpdate.$set.status, 'Approved');
    assert.equal(capturedUpdate.$set.approvedBy, '507f1f77bcf86cd799439012');
  } finally {
    WorkRequestModel.updateOne = originalUpdate;
  }
});

test('work request conversion is an account-scoped atomic transition from approved and unconverted', async () => {
  const originalUpdate = WorkRequestModel.updateOne;
  let capturedFilter;
  let capturedUpdate;
  WorkRequestModel.updateOne = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { modifiedCount: 1 };
  };

  try {
    await requestService.markConverted(
      '507f1f77bcf86cd799439011',
      '507f191e810c19729de860ea',
      {
        workOrderId: '507f1f77bcf86cd799439013',
        orderNo: 'WO-20260001',
        priority: 'High',
        convertedBy: '507f1f77bcf86cd799439012'
      }
    );
    assert.equal(capturedFilter.account_id, '507f191e810c19729de860ea');
    assert.equal(capturedFilter.status, 'Approved');
    assert.equal(capturedFilter.visible, true);
    assert.deepEqual(capturedFilter.$or, [
      { converted_work_order_id: { $exists: false } },
      { converted_work_order_id: null }
    ]);
    assert.equal(capturedUpdate.$set.converted_work_order_id, '507f1f77bcf86cd799439013');
  } finally {
    WorkRequestModel.updateOne = originalUpdate;
  }
});

test('work orders enforce one conversion per linked work request', () => {
  const linkedRequestIndex = WorkOrderModel.schema.indexes().find(([fields]) => fields.work_request_id === 1);
  assert.ok(linkedRequestIndex);
  assert.equal(linkedRequestIndex[1].unique, true);
  assert.deepEqual(linkedRequestIndex[1].partialFilterExpression, {
    work_request_id: { $type: 'objectId' }
  });
});

test('linked-request work-order creation requires an administrator with request edit access', async () => {
  const originalCreate = orderService.createWorkOrder;
  let createCalls = 0;
  orderService.createWorkOrder = async () => {
    createCalls += 1;
    return { _id: '507f1f77bcf86cd799439013' };
  };

  try {
    const nonAdminError = await invokeController(orderController.createOrder.bind(orderController), {
      user: { _id: '507f1f77bcf86cd799439012', user_role: 'manager' },
      role: { work_request: { edit: true } },
      body: { work_request_id: '507f1f77bcf86cd799439011' }
    });
    assert.equal(nonAdminError.status, 403);

    const revokedAdminError = await invokeController(orderController.createOrder.bind(orderController), {
      user: { _id: '507f1f77bcf86cd799439012', user_role: 'admin' },
      role: { work_request: { edit: false } },
      body: { work_request_id: '507f1f77bcf86cd799439011' }
    });
    assert.equal(revokedAdminError.status, 403);
    assert.equal(createCalls, 0);
  } finally {
    orderService.createWorkOrder = originalCreate;
  }
});

test('work-order update payloads cannot overwrite tenant, audit or server-owned linkage fields', () => {
  assert.deepEqual(sanitizeWorkOrderPayload({
    title: 'Safe update',
    status: 'In-Progress',
    account_id: 'attacker-account',
    visible: false,
    order_no: 'WO-OVERWRITE',
    createdBy: '507f1f77bcf86cd799439012',
    work_request_id: '507f1f77bcf86cd799439011',
    asset_report_id: '507f1f77bcf86cd799439013',
    createdFrom: 'Preventive',
    schedule_execution_key: 'forged-key'
  }, 'update'), {
    title: 'Safe update',
    status: 'In-Progress'
  });
});

test('work-order inventory validation requires and scopes every part to the active account', async () => {
  const originalFindOne = PartsModel.findOne;
  let capturedFilter;
  PartsModel.findOne = async filter => {
    capturedFilter = filter;
    return null;
  };

  try {
    await assert.rejects(
      () => partsService.validateInventoryByWorkOrder(
        [],
        [{ part_id: '507f1f77bcf86cd799439011', estimatedQuantity: 2 }],
        'Open',
        'Open',
        undefined,
        '507f191e810c19729de860ea'
      ),
      error => error.status === 400 && /active account/.test(error.message)
    );
    assert.equal(capturedFilter.account_id, '507f191e810c19729de860ea');
    assert.equal(capturedFilter.visible, true);

    await assert.rejects(
      () => partsService.validateInventoryByWorkOrder(
        [],
        [{ part_id: '507f1f77bcf86cd799439011', estimatedQuantity: 2 }],
        'Open',
        'Open'
      ),
      error => error.status === 400 && /Active account/.test(error.message)
    );
  } finally {
    PartsModel.findOne = originalFindOne;
  }
});

test('work-order history aggregation is scoped to the active account', async () => {
  const originalGetHistoryModel = WorkOrderModel.getHistoryModel;
  let capturedPipeline;
  WorkOrderModel.getHistoryModel = () => ({
    aggregate: async pipeline => {
      capturedPipeline = pipeline;
      return [{ original_id: '507f1f77bcf86cd799439011' }];
    }
  });

  try {
    await orderService.getHistory(
      '507f1f77bcf86cd799439011',
      '507f191e810c19729de860ea'
    );
    assert.equal(String(capturedPipeline[0].$match.original_id), '507f1f77bcf86cd799439011');
    assert.equal(capturedPipeline[0].$match.account_id, '507f191e810c19729de860ea');
  } finally {
    WorkOrderModel.getHistoryModel = originalGetHistoryModel;
  }
});

test('comment updates use one account, order, ownership and visibility scoped write', async () => {
  const originalFindOneAndUpdate = CommentsModel.findOneAndUpdate;
  let capturedFilter;
  CommentsModel.findOneAndUpdate = async filter => {
    capturedFilter = filter;
    return null;
  };

  try {
    const result = await commentService.updateComment({
      _id: '507f1f77bcf86cd799439011',
      account_id: '507f191e810c19729de860ea',
      order_id: '507f1f77bcf86cd799439012',
      createdBy: '507f1f77bcf86cd799439013'
    }, 'Updated comment', { _id: '507f1f77bcf86cd799439013' });
    assert.equal(result, null);
    assert.equal(capturedFilter.account_id, '507f191e810c19729de860ea');
    assert.equal(capturedFilter.order_id, '507f1f77bcf86cd799439012');
    assert.equal(capturedFilter.createdBy, '507f1f77bcf86cd799439013');
    assert.equal(capturedFilter.visible, true);
  } finally {
    CommentsModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('work request references must belong to the active account', async () => {
  const originalLocationExists = LocationModel.exists;
  const originalAssetExists = AssetModel.exists;
  LocationModel.exists = async () => ({ _id: 'location' });
  AssetModel.exists = async () => null;

  try {
    await assert.rejects(
      () => requestService.assertRequestReferences({
        location_id: '507f1f77bcf86cd799439011',
        asset_id: '507f1f77bcf86cd799439012'
      }, '507f191e810c19729de860ea'),
      error => error.status === 400 && /Asset/.test(error.message)
    );
  } finally {
    LocationModel.exists = originalLocationExists;
    AssetModel.exists = originalAssetExists;
  }
});

test('preventive schedule payload policy strips execution, lock, tenant and work-order status fields', () => {
  assert.deepEqual(sanitizeSchedulePayload({
    account_id: 'another-account',
    visible: false,
    cron_lock_instance_id: 'attacker',
    schedule: {
      mode: 'daily',
      start_date: '2026-08-25',
      no_of_execution: 999,
      last_execution_date: '2026-08-25',
      daily: { everyNDays: 2 }
    },
    work_order: {
      title: 'Inspection',
      status: 'Completed',
      wo_location_id: '507f1f77bcf86cd799439011'
    }
  }, true), {
    schedule: {
      mode: 'daily',
      start_date: '2026-08-25',
      daily: { everyNDays: 2 }
    },
    work_order: {
      title: 'Inspection',
      wo_location_id: '507f1f77bcf86cd799439011',
      status: 'Open'
    }
  });
});

test('daily preventive cadence honors every N days and skip/execution guards', () => {
  const schedule = {
    schedule: {
      mode: 'daily',
      enabled: true,
      start_date: '2026-08-01',
      skipDates: [],
      daily: { everyNDays: 3 },
      no_of_execution: 0
    }
  };
  assert.equal(isScheduleDueOnDate(schedule, new Date('2026-08-04T12:00:00Z')), true);
  assert.equal(isScheduleDueOnDate(schedule, new Date('2026-08-05T12:00:00Z')), false);
  schedule.schedule.last_execution_date = '2026-08-04T01:00:00Z';
  assert.equal(isScheduleDueOnDate(schedule, new Date('2026-08-04T20:00:00Z')), false);
});

test('weekly and monthly preventive cadence honors interval anchors', () => {
  const weekly = {
    schedule: {
      mode: 'weekly', enabled: true, start_date: '2026-08-03', skipDates: [],
      weekly: { everyNWeeks: 2, days: ['monday'] }, no_of_execution: 0
    }
  };
  assert.equal(isScheduleDueOnDate(weekly, new Date('2026-08-10T12:00:00Z')), false);
  assert.equal(isScheduleDueOnDate(weekly, new Date('2026-08-17T12:00:00Z')), true);

  const monthly = {
    schedule: {
      mode: 'monthly', enabled: true, start_date: '2026-01-01', skipDates: [],
      monthly: { everyNMonths: 3, monthDays: [15] }, no_of_execution: 0
    }
  };
  assert.equal(isScheduleDueOnDate(monthly, new Date('2026-02-15T12:00:00Z')), false);
  assert.equal(isScheduleDueOnDate(monthly, new Date('2026-04-15T12:00:00Z')), true);
});

test('preventive calendar date follows the configured timezone without a midnight offset', () => {
  const instant = new Date('2026-08-25T18:45:00.000Z');
  assert.equal(resolveSchedulerTimeZone('Asia/Kolkata'), 'Asia/Kolkata');
  assert.equal(dateKeyUtc(calendarDateInTimeZone(instant, 'Asia/Kolkata')), '2026-08-26');
  assert.equal(dateKeyUtc(calendarDateInTimeZone(instant, 'UTC')), '2026-08-25');
  assert.equal(dateKeyUtc(addCalendarMonths(new Date('2026-01-31T00:00:00.000Z'), 1)), '2026-02-28');
});

test('preventive work orders enforce one execution per schedule calendar date', () => {
  const executionIndex = WorkOrderModel.schema.indexes().find(([fields]) => (
    fields.account_id === 1 && fields.schedule_execution_key === 1
  ));
  assert.ok(executionIndex);
  assert.equal(executionIndex[1].unique, true);
  assert.deepEqual(executionIndex[1].partialFilterExpression, {
    schedule_execution_key: { $type: 'string' }
  });
});

test('preventive scheduler resolves an active execution user only within the schedule account', async () => {
  const originalGetUsers = usersService.getAllUsers;
  const calls = [];
  usersService.getAllUsers = async match => {
    calls.push(match);
    return match.user_role === 'admin'
      ? [{ _id: '507f1f77bcf86cd799439012', account_id: match.account_id, user_status: 'active', user_role: 'admin' }]
      : [];
  };

  try {
    const resolved = await schedulerService.resolveExecutionUser({
      _id: '507f1f77bcf86cd799439010',
      account_id: '507f191e810c19729de860ea',
      createdBy: '507f1f77bcf86cd799439011'
    });
    assert.equal(resolved._id, '507f1f77bcf86cd799439012');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].account_id, '507f191e810c19729de860ea');
    assert.equal(calls[0].user_status, 'active');
    assert.equal(calls[1].account_id, '507f191e810c19729de860ea');
    assert.equal(calls[1].user_role, 'admin');
  } finally {
    usersService.getAllUsers = originalGetUsers;
  }
});

test('preventive status update rejects string coercion and missing boolean values', async () => {
  const originalGet = scheduleService.getSchedules;
  const originalUpdate = scheduleService.updateStatus;
  let updates = 0;
  scheduleService.getSchedules = async () => [{ _id: '507f1f77bcf86cd799439011' }];
  scheduleService.updateStatus = async () => { updates += 1; };

  try {
    const error = await invokeController(scheduleController.updateStatus.bind(scheduleController), {
      user: { _id: '507f1f77bcf86cd799439012', account_id: '507f191e810c19729de860ea' },
      params: { id: '507f1f77bcf86cd799439011' },
      body: { enabled: 'false' }
    });
    assert.equal(error.status, 400);
    assert.equal(updates, 0);
  } finally {
    scheduleService.getSchedules = originalGet;
    scheduleService.updateStatus = originalUpdate;
  }
});

test('preventive status writes are scoped to the active account and update only server status fields', async () => {
  const originalFindOneAndUpdate = SchedulerModel.findOneAndUpdate;
  const originalGet = scheduleService.getSchedules;
  let capturedFilter;
  let capturedUpdate;
  SchedulerModel.findOneAndUpdate = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { _id: filter._id };
  };
  scheduleService.getSchedules = async () => [{ _id: '507f1f77bcf86cd799439011' }];

  try {
    await scheduleService.updateStatus(
      '507f1f77bcf86cd799439011',
      false,
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012'
    );
    assert.equal(capturedFilter.account_id, '507f191e810c19729de860ea');
    assert.equal(capturedFilter.visible, true);
    assert.deepEqual(capturedUpdate.$set, {
      'schedule.enabled': false,
      updatedBy: '507f1f77bcf86cd799439012'
    });
  } finally {
    SchedulerModel.findOneAndUpdate = originalFindOneAndUpdate;
    scheduleService.getSchedules = originalGet;
  }
});

test('inventory payload policies strip tenant, visibility, audit and stock fields from metadata updates', () => {
  const source = {
    account_id: 'attacker-account',
    visible: false,
    createdBy: 'attacker',
    updatedBy: 'attacker',
    quantity: 999,
    part_name: 'Bearing',
    part_number: 'BRG-001',
    location_id: '507f1f77bcf86cd799439011'
  };

  assert.deepEqual(sanitizePartPayload(source), {
    part_name: 'Bearing',
    part_number: 'BRG-001',
    quantity: 999,
    location_id: '507f1f77bcf86cd799439011'
  });
  assert.deepEqual(sanitizePartMetadataUpdatePayload(source), {
    part_name: 'Bearing',
    part_number: 'BRG-001',
    location_id: '507f1f77bcf86cd799439011'
  });
  assert.deepEqual(sanitizePartTypePayload({
    name: 'Mechanical',
    description: 'Mechanical spares',
    account_id: 'attacker-account',
    visible: false,
    createdBy: 'attacker'
  }), {
    name: 'Mechanical',
    description: 'Mechanical spares'
  });
});

test('mapped role filters intersect requested locations instead of replacing the mapping scope', async () => {
  const original = mapUserToLocationService.getLocationsMappedData;
  mapUserToLocationService.getLocationsMappedData = async () => [{ locationId: '507f1f77bcf86cd799439011' }];

  try {
    const filter = await applyRoleFilter({
      user: {
        _id: '507f1f77bcf86cd799439010',
        account_id: '507f191e810c19729de860ea',
        user_role: 'manager'
      },
      baseFilter: { location_id: '507f1f77bcf86cd799439099' },
      mapping: 'location',
      idField: 'location_id'
    });

    assert.equal(filter.account_id, '507f191e810c19729de860ea');
    assert.equal(filter.visible, true);
    assert.equal(filter.location_id, undefined);
    assert.deepEqual(filter.$and, [
      { location_id: '507f1f77bcf86cd799439099' },
      { location_id: { $in: ['507f1f77bcf86cd799439011'] } }
    ]);
  } finally {
    mapUserToLocationService.getLocationsMappedData = original;
  }
});

test('inventory schemas enforce non-negative stock values and indexed tenant-location lookups', () => {
  const invalid = new PartsModel({
    account_id: '507f191e810c19729de860ea',
    part_name: 'Bearing',
    part_number: 'BRG-001',
    unit: 'pcs',
    quantity: -1,
    min_quantity: 0,
    cost: 10,
    currency: 'INR',
    createdBy: '507f1f77bcf86cd799439010'
  }).validateSync();
  assert.ok(invalid?.errors?.quantity);

  const networkIndex = PartsModel.schema.indexes().find(([fields]) => (
    fields.account_id === 1 && fields.part_number === 1 && fields.location_id === 1 && fields.visible === 1
  ));
  assert.ok(networkIndex);
});

test('cycle count review claims only a pending approval and rejects repeated decisions', async () => {
  const originalStartSession = mongoose.startSession;
  const originalFindOneAndUpdate = CycleCountModel.findOneAndUpdate;
  const originalExists = CycleCountModel.exists;
  let capturedFilter;

  mongoose.startSession = async () => ({
    startTransaction() {},
    async commitTransaction() {},
    async abortTransaction() {},
    async endSession() {},
    inTransaction() { return true; }
  });
  CycleCountModel.findOneAndUpdate = async (filter) => {
    capturedFilter = filter;
    return null;
  };
  CycleCountModel.exists = () => ({
    session() { return this; },
    then(resolve) { resolve({ _id: '507f1f77bcf86cd799439011' }); }
  });

  try {
    await assert.rejects(
      () => partsService.approveCycleCount(
        '507f1f77bcf86cd799439011',
        'approved',
        '507f191e810c19729de860ea',
        { _id: '507f1f77bcf86cd799439012', firstName: 'Admin' }
      ),
      error => error.status === 409 && /already been reviewed/.test(error.message)
    );
    assert.equal(capturedFilter.account_id, '507f191e810c19729de860ea');
    assert.equal(capturedFilter.visible, true);
    assert.equal(capturedFilter.status, 'pending-approval');
  } finally {
    mongoose.startSession = originalStartSession;
    CycleCountModel.findOneAndUpdate = originalFindOneAndUpdate;
    CycleCountModel.exists = originalExists;
  }
});

test('part deletion refuses to hide non-zero stock', async () => {
  const originalFindOne = PartsModel.findOne;
  const originalOrderExists = WorkOrderModel.exists;
  let capturedFilter;
  PartsModel.findOne = (filter) => {
    capturedFilter = filter;
    return { lean: async () => ({ _id: filter._id, quantity: 2 }) };
  };
  WorkOrderModel.exists = async () => null;

  try {
    await assert.rejects(
      () => partsService.removeById(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        '507f191e810c19729de860ea'
      ),
      error => error.status === 409 && /quantity to zero/.test(error.message)
    );
    assert.equal(capturedFilter.account_id, '507f191e810c19729de860ea');
    assert.equal(capturedFilter.visible, true);
  } finally {
    PartsModel.findOne = originalFindOne;
    WorkOrderModel.exists = originalOrderExists;
  }
});

test('structured form and inspection payloads are bounded and reject prototype-pollution keys', () => {
  const unsafe = JSON.parse('{"components":[],"__proto__":{"polluted":true}}');
  assert.throws(
    () => sanitizeStructuredPayload(unsafe, 'Form template'),
    error => error.status === 400 && /unsafe key/.test(error.message)
  );
  assert.throws(
    () => sanitizeStructuredPayload({ value: 'x'.repeat(1025) }, 'Report', { maxBytes: 1024 }),
    error => error.status === 400 && /maximum allowed size/.test(error.message)
  );
});

test('form, inspection and procedure policies strip tenant, visibility and unknown nested fields', () => {
  const sop = sanitizeSopPayload({
    name: ' Pump Check ', locationId: 'location', categoryId: 'category',
    account_id: 'attacker', visible: false, createdBy: 'attacker',
    json_temp: { components: [] }
  });
  assert.equal(sop.name, 'Pump Check');
  assert.equal(sop.account_id, undefined);
  assert.equal(sop.visible, undefined);

  const inspection = sanitizeInspectionPayload({
    title: ' Inspection ', start_date: '2026-08-25', form_id: 'form', location_id: 'location', asset_id: 'asset',
    assignedUser: ['user-1', 'user-1'], status: 'Open', month: 'August', createdFrom: 'Work Order',
    account_id: 'attacker', visible: false, inspection_report: { answer: true }
  });
  assert.deepEqual(inspection.assignedUser, ['user-1']);
  assert.equal(inspection.account_id, undefined);
  assert.equal(inspection.visible, undefined);

  const procedure = sanitizeProcedureContent({
    name: ' Safe Procedure ', account_id: 'attacker', visible: false,
    steps: [{ id: 'step-1', type: 'field', title: 'Check', field_type: 'text', required: true, account_id: 'attacker', malicious: true }]
  });
  assert.equal(procedure.name, 'Safe Procedure');
  assert.equal(procedure.account_id, undefined);
  assert.equal(procedure.steps[0].malicious, undefined);
  assert.equal(procedure.steps[0].account_id, undefined);
});

test('procedure versions have a tenant-group version uniqueness constraint', () => {
  const index = ProcedureModel.schema.indexes().find(([fields, options]) => (
    fields.account_id === 1 && fields.version_group_id === 1 && fields.version === 1 && options.unique === true
  ));
  assert.ok(index);
});

test('work order template partial updates preserve omitted fields and remain account scoped', async () => {
  const originalFindOne = WorkOrderTemplateModel.findOne;
  const originalFindOneAndUpdate = WorkOrderTemplateModel.findOneAndUpdate;
  let capturedFilter;
  let capturedUpdate;
  WorkOrderTemplateModel.findOne = () => ({
    lean: async () => ({
      _id: '507f1f77bcf86cd799439011',
      template_name: 'Monthly Pump', title: 'Inspect Pump', description: 'Original', estimated_time: 30,
      priority: 'High', nature_of_work: 'Inspection', maintenance_type: 'Preventive',
      procedure_ids: [], assignee_ids: [], location_ids: [], asset_ids: [], parts: [], categories: ['Pump'], vendors: [],
      field_rules: {}, due_date_settings: { recurrence_value: 1, recurrence_unit: 'weeks' }
    })
  });
  WorkOrderTemplateModel.findOneAndUpdate = (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { lean: async () => ({ _id: filter._id }) };
  };

  try {
    await orderTemplateService.updateTemplate(
      '507f1f77bcf86cd799439011',
      { title: 'Inspect Pump Safely' },
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012'
    );
    assert.equal(capturedFilter.account_id, '507f191e810c19729de860ea');
    assert.equal(capturedFilter.visible, true);
    assert.equal(capturedUpdate.$set.template_name, 'Monthly Pump');
    assert.equal(capturedUpdate.$set.title, 'Inspect Pump Safely');
    assert.equal(capturedUpdate.$set.priority, 'High');
    assert.equal(capturedUpdate.$set.due_date_settings.recurrence_value, 1);
  } finally {
    WorkOrderTemplateModel.findOne = originalFindOne;
    WorkOrderTemplateModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('SOP partial updates preserve omitted form schema and remain account scoped', async () => {
  const originalFindOne = SOPsModel.findOne;
  const originalExists = SOPsModel.exists;
  const originalFindOneAndUpdate = SOPsModel.findOneAndUpdate;
  const originalLocationExists = LocationModel.exists;
  const originalCategoryExists = CategoryModel.exists;
  let capturedFilter;
  let capturedUpdate;
  SOPsModel.findOne = () => ({ lean: async () => ({
    _id: '507f1f77bcf86cd799439011',
    name: 'Pump Inspection', description: 'Old description',
    locationId: '507f1f77bcf86cd799439013', categoryId: '507f1f77bcf86cd799439014',
    json_temp: { components: [{ key: 'pressure', type: 'number' }] }
  }) });
  SOPsModel.exists = async () => null;
  LocationModel.exists = async () => ({ _id: '507f1f77bcf86cd799439013' });
  CategoryModel.exists = async () => ({ _id: '507f1f77bcf86cd799439014' });
  SOPsModel.findOneAndUpdate = (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { _id: filter._id };
  };

  try {
    await sopsService.updateSOPs(
      '507f1f77bcf86cd799439011',
      { description: 'Updated description' },
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012'
    );
    assert.equal(capturedFilter.account_id, '507f191e810c19729de860ea');
    assert.equal(capturedFilter.visible, true);
    assert.equal(capturedUpdate.$set.name, 'Pump Inspection');
    assert.deepEqual(capturedUpdate.$set.json_temp, { components: [{ key: 'pressure', type: 'number' }] });
    assert.equal(capturedUpdate.$set.description, 'Updated description');
  } finally {
    SOPsModel.findOne = originalFindOne;
    SOPsModel.exists = originalExists;
    SOPsModel.findOneAndUpdate = originalFindOneAndUpdate;
    LocationModel.exists = originalLocationExists;
    CategoryModel.exists = originalCategoryExists;
  }
});

test('form category writes are account scoped and deletion rejects an active form reference', async () => {
  const originalFindOneAndUpdate = CategoryModel.findOneAndUpdate;
  const originalSopExists = SOPsModel.exists;
  let capturedFilter;
  CategoryModel.findOneAndUpdate = (filter) => {
    capturedFilter = filter;
    return { _id: filter._id };
  };
  SOPsModel.exists = async () => null;
  const user = { _id: '507f1f77bcf86cd799439012', account_id: '507f191e810c19729de860ea' };

  try {
    await formCategoryService.updateById('507f1f77bcf86cd799439011', { name: 'Safety', description: '' }, user);
    assert.equal(capturedFilter.account_id, user.account_id);
    assert.equal(capturedFilter.visible, true);

    SOPsModel.exists = async () => ({ _id: 'form-id' });
    await assert.rejects(
      () => formCategoryService.removeById('507f1f77bcf86cd799439011', user),
      error => error.status === 409 && /active form/.test(error.message)
    );
  } finally {
    CategoryModel.findOneAndUpdate = originalFindOneAndUpdate;
    SOPsModel.exists = originalSopExists;
  }
});

test('inspection detail access requires the requested inspection to be assigned to a non-admin user', async () => {
  const originalMappings = mapInspectionService.getInspectionByUserId;
  const originalGetAll = inspectionService.getAllInspection;
  let readCalls = 0;
  mapInspectionService.getInspectionByUserId = async () => [{ inspection_id: '507f1f77bcf86cd799439099' }];
  inspectionService.getAllInspection = async () => { readCalls += 1; return []; };

  try {
    const error = await invokeController(inspectionController.getById.bind(inspectionController), {
      user: { _id: '507f1f77bcf86cd799439012', account_id: '507f191e810c19729de860ea', user_role: 'employee' },
      params: { id: '507f1f77bcf86cd799439011' }
    });
    assert.equal(error.status, 404);
    assert.equal(readCalls, 0);
  } finally {
    mapInspectionService.getInspectionByUserId = originalMappings;
    inspectionService.getAllInspection = originalGetAll;
  }
});

test('inspection creation rejects a location outside the active account before writing mappings', async () => {
  const originalLocationExists = LocationModel.exists;
  const originalAssetFindOne = AssetModel.findOne;
  const originalSopFindOne = SOPsModel.findOne;
  const originalUserCount = UserModel.countDocuments;
  LocationModel.exists = async () => null;
  AssetModel.findOne = () => ({ lean: async () => ({ locationId: '507f1f77bcf86cd799439011' }) });
  SOPsModel.findOne = () => ({ lean: async () => ({ locationId: '507f1f77bcf86cd799439011' }) });
  UserModel.countDocuments = async () => 0;

  try {
    await assert.rejects(
      () => inspectionService.createInspection({
        title: 'Check', start_date: '2026-08-25', form_id: '507f1f77bcf86cd799439013',
        location_id: '507f1f77bcf86cd799439011', asset_id: '507f1f77bcf86cd799439014',
        assignedUser: [], status: 'Open', month: 'August', createdFrom: 'Work Order'
      }, '507f191e810c19729de860ea', '507f1f77bcf86cd799439012'),
      error => error.status === 400 && /Location/.test(error.message)
    );
  } finally {
    LocationModel.exists = originalLocationExists;
    AssetModel.findOne = originalAssetFindOne;
    SOPsModel.findOne = originalSopFindOne;
    UserModel.countDocuments = originalUserCount;
  }
});

test('inspection partial updates preserve omitted fields and assigned-user mappings', async () => {
  const originalStartSession = mongoose.startSession;
  const originalFindOne = InspectionModel.findOne;
  const originalFindOneAndUpdate = InspectionModel.findOneAndUpdate;
  const originalMappings = mapInspectionService.getUserByInspectionId;
  const originalSetMapping = mapInspectionService.setInspection;
  const originalLocationExists = LocationModel.exists;
  const originalAssetFindOne = AssetModel.findOne;
  const originalSopFindOne = SOPsModel.findOne;
  const originalUserCount = UserModel.countDocuments;
  let capturedUpdate;
  let mappedUsers;

  mongoose.startSession = async () => ({
    startTransaction() {}, async commitTransaction() {}, async abortTransaction() {}, async endSession() {}, inTransaction() { return true; }
  });
  InspectionModel.findOne = () => ({ lean: async () => ({
    title: 'Pump Check', description: 'Existing', start_date: '2026-08-25',
    form_id: '507f1f77bcf86cd799439013', inspection_report: { pressure: 4 },
    location_id: '507f1f77bcf86cd799439011', asset_id: '507f1f77bcf86cd799439014',
    status: 'Open', month: 'August', createdFrom: 'Work Order', no_of_actions: 1
  }) });
  InspectionModel.findOneAndUpdate = async (_filter, update) => { capturedUpdate = update; return { _id: 'inspection-id' }; };
  mapInspectionService.getUserByInspectionId = async () => [{ user_id: '507f1f77bcf86cd799439015' }];
  mapInspectionService.setInspection = async (_account, _inspection, users) => { mappedUsers = users; };
  LocationModel.exists = async () => ({ _id: 'location-id' });
  AssetModel.findOne = () => ({ lean: async () => ({ locationId: '507f1f77bcf86cd799439011' }) });
  SOPsModel.findOne = () => ({ lean: async () => ({ locationId: '507f1f77bcf86cd799439011' }) });
  UserModel.countDocuments = async () => 1;

  try {
    await inspectionService.updateInspection(
      '507f1f77bcf86cd799439016',
      { status: 'Completed' },
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012'
    );
    assert.equal(capturedUpdate.$set.title, 'Pump Check');
    assert.deepEqual(capturedUpdate.$set.inspection_report, { pressure: 4 });
    assert.equal(capturedUpdate.$set.status, 'Completed');
    assert.deepEqual(mappedUsers, ['507f1f77bcf86cd799439015']);
  } finally {
    mongoose.startSession = originalStartSession;
    InspectionModel.findOne = originalFindOne;
    InspectionModel.findOneAndUpdate = originalFindOneAndUpdate;
    mapInspectionService.getUserByInspectionId = originalMappings;
    mapInspectionService.setInspection = originalSetMapping;
    LocationModel.exists = originalLocationExists;
    AssetModel.findOne = originalAssetFindOne;
    SOPsModel.findOne = originalSopFindOne;
    UserModel.countDocuments = originalUserCount;
  }
});

test('multi-value ObjectId query validation enforces the configured request bound', () => {
  const validId = '507f1f77bcf86cd799439011';
  assert.equal(helperService.validateObjectIds(`${validId},${validId}`, 2).length, 2);
  assert.throws(
    () => helperService.validateObjectIds(`${validId},${validId},${validId}`, 2),
    error => error.status === 400 && /maximum 2/.test(error.message)
  );
});

test('inspection user mapping skips empty inserts and deduplicates assigned users', async () => {
  const originalRemove = mapInspectionService.removeInspectionById;
  const originalInsertMany = MapUserInspectionModel.insertMany;
  let removeCalls = 0;
  let inserted = null;
  mapInspectionService.removeInspectionById = async () => { removeCalls += 1; };
  MapUserInspectionModel.insertMany = async (docs) => { inserted = docs; };

  try {
    await mapInspectionService.setInspection('account', 'inspection', []);
    assert.equal(removeCalls, 1);
    assert.equal(inserted, null);

    await mapInspectionService.setInspection('account', 'inspection', ['user-1', 'user-1', ' user-2 ']);
    assert.equal(removeCalls, 2);
    assert.deepEqual(inserted.map(item => item.user_id), ['user-1', 'user-2']);
  } finally {
    mapInspectionService.removeInspectionById = originalRemove;
    MapUserInspectionModel.insertMany = originalInsertMany;
  }
});

test('post payload policy sanitizes rich HTML and strips server-owned and unsafe file fields', () => {
  const payload = sanitizePostPayload({
    title: 'Pump safety', postType: 'Maintenance', relatedTo: 'Assets',
    description: '<p onclick="steal()">Safe <strong>content</strong></p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>',
    files: [{
      originalName: 'manual.pdf', fileName: '20260825-posts-account-abcd1234.pdf',
      folderName: 'posts', type: 'application/pdf', size: 1024,
      fileURL: 'https://attacker.example/posts/manual.pdf', destination: '../../outside'
    }],
    status: 'Draft', visibility: 'Account', account_id: 'attacker', likes: ['attacker']
  });

  assert.doesNotMatch(payload.description, /script|onclick|javascript:/i);
  assert.match(payload.description, /<strong>content<\/strong>/);
  assert.equal(payload.files[0].fileURL, undefined);
  assert.equal(payload.files[0].destination, undefined);
  assert.equal(payload.account_id, undefined);
  assert.equal(payload.likes, undefined);
});

test('post payload policy requires scoped post uploads and a location audience', () => {
  const base = {
    title: 'Pump safety', postType: 'Maintenance', relatedTo: 'Assets', description: '<p>Readable content</p>'
  };
  assert.throws(
    () => sanitizePostPayload({ ...base, visibility: 'Locations', publishTo: [] }),
    error => error.status === 400 && /location/.test(error.message)
  );
  assert.throws(
    () => sanitizePostPayload({
      ...base,
      files: [{ fileName: 'manual.pdf', folderName: 'work_order', type: 'application/pdf', size: 10 }]
    }),
    error => error.status === 400 && /posts folder/.test(error.message)
  );
});

test('post partial updates preserve omitted fields and use one account-scoped write', async () => {
  const originalFindOne = PostModel.findOne;
  const originalFindOneAndUpdate = PostModel.findOneAndUpdate;
  let capturedFilter;
  let capturedUpdate;
  PostModel.findOne = () => ({ lean: async () => ({
    title: 'Pump safety', subtitle: 'Existing subtitle', postType: 'Maintenance', relatedTo: 'Assets',
    tags: ['safety'], description: '<p>Existing content</p>', files: [], publishTo: [],
    status: 'Published', visibility: 'Account', featured: false, pinned: false, slug: 'pump-safety',
    seoTitle: '', seoDescription: '', keywords: [], scheduledAt: null, publishedAt: new Date('2026-08-20'),
    commentsEnabled: true, help: false, reviewHistory: []
  }) });
  PostModel.findOneAndUpdate = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { _id: filter._id };
  };

  try {
    await postService.updatePostById(
      '507f1f77bcf86cd799439011',
      { featured: true },
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012',
      { partial: true }
    );
    assert.equal(String(capturedFilter.account_id), '507f191e810c19729de860ea');
    assert.equal(capturedFilter.visible, true);
    assert.equal(capturedUpdate.$set.title, 'Pump safety');
    assert.equal(capturedUpdate.$set.subtitle, 'Existing subtitle');
    assert.equal(capturedUpdate.$set.featured, true);
    assert.equal(capturedUpdate.$set.account_id, undefined);
  } finally {
    PostModel.findOne = originalFindOne;
    PostModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('post reactions use an atomic tenant-scoped update pipeline', async () => {
  const originalFindOneAndUpdate = PostModel.findOneAndUpdate;
  let capturedFilter;
  let capturedUpdate;
  PostModel.findOneAndUpdate = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { _id: filter._id, likes: [], dislikes: [] };
  };

  try {
    await postService.likePost(
      '507f1f77bcf86cd799439011',
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012'
    );
    assert.equal(String(capturedFilter.account_id), '507f191e810c19729de860ea');
    assert.equal(capturedFilter.visible, true);
    assert.ok(Array.isArray(capturedUpdate));
    assert.ok(capturedUpdate[0].$set.likes.$cond);
    assert.ok(capturedUpdate[0].$set.dislikes.$setDifference);
  } finally {
    PostModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('post list filters use membership matching and return an empty successful list', async () => {
  const originalGetAll = postService.getAllPosts;
  let capturedFilter;
  postService.getAllPosts = async filter => { capturedFilter = filter; return []; };
  const response = responseRecorder();

  try {
    let nextError;
    await postController.getPosts(
      {
        user: { _id: '507f1f77bcf86cd799439012', account_id: '507f191e810c19729de860ea', user_role: 'admin' },
        query: { postType: 'General,Maintenance', relatedTo: 'Assets' }
      },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(capturedFilter.postType.$in, ['General', 'Maintenance']);
    assert.deepEqual(capturedFilter.relatedTo.$in, ['Assets']);
    assert.deepEqual(response.body.data, []);
  } finally {
    postService.getAllPosts = originalGetAll;
  }
});

test('post comments build a nested response with one bounded post query', async () => {
  const originalFind = CommentsModel.find;
  let findCalls = 0;
  CommentsModel.find = () => {
    findCalls += 1;
    const query = {
      sort() { return this; }, limit() { return this; }, populate() { return this; },
      async lean() {
        return [
          { _id: '507f1f77bcf86cd799439021', parentCommentId: null, comments: 'Root' },
          { _id: '507f1f77bcf86cd799439022', parentCommentId: '507f1f77bcf86cd799439021', comments: 'Reply' }
        ];
      }
    };
    return query;
  };

  try {
    const comments = await postCommentService.getAllCommentsForPost(
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439011'
    );
    assert.equal(findCalls, 1);
    assert.equal(comments.length, 1);
    assert.equal(comments[0].replies.length, 1);
    assert.equal(comments[0].replies[0].comments, 'Reply');
  } finally {
    CommentsModel.find = originalFind;
  }
});

test('post comment updates are scoped to tenant, post and author for non-moderators', async () => {
  const originalFindOneAndUpdate = CommentsModel.findOneAndUpdate;
  let capturedFilter;
  CommentsModel.findOneAndUpdate = async filter => {
    capturedFilter = filter;
    return { _id: filter._id };
  };

  try {
    await postCommentService.updatePostComment(
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439021',
      'Updated comment',
      '507f1f77bcf86cd799439012',
      false
    );
    assert.equal(String(capturedFilter.account_id), '507f191e810c19729de860ea');
    assert.equal(String(capturedFilter.post_id), '507f1f77bcf86cd799439011');
    assert.equal(String(capturedFilter.createdBy), '507f1f77bcf86cd799439012');
    assert.equal(capturedFilter.visible, true);
  } finally {
    CommentsModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('post audience scope restricts non-editors to published posts for their mapped locations', async () => {
  const originalMappings = mapUserToLocationService.getLocationsMappedData;
  let mappingCalls = 0;
  mapUserToLocationService.getLocationsMappedData = async () => {
    mappingCalls += 1;
    return [
      { locationId: '507f1f77bcf86cd799439013' },
      { locationId: '507f1f77bcf86cd799439013' },
      {}
    ];
  };
  const baseFilter = { account_id: '507f191e810c19729de860ea', visible: true };

  try {
    const managerFilter = await postService.applyAudienceScope(baseFilter, { _id: '507f1f77bcf86cd799439012' }, true);
    assert.equal(managerFilter, baseFilter);
    assert.equal(mappingCalls, 0);

    const viewerFilter = await postService.applyAudienceScope(baseFilter, { _id: '507f1f77bcf86cd799439012' }, false);
    assert.equal(mappingCalls, 1);
    assert.equal(viewerFilter.status, 'Published');
    assert.equal(viewerFilter.$and.length, 1);
    assert.deepEqual(viewerFilter.$and[0].$or, [
      { visibility: { $ne: 'Locations' } },
      { visibility: 'Locations', publishTo: { $in: ['507f1f77bcf86cd799439013'] } }
    ]);
  } finally {
    mapUserToLocationService.getLocationsMappedData = originalMappings;
  }
});

test('scheduled post publisher uses bounded atomic transitions for due posts', async () => {
  const originalFind = PostModel.find;
  const originalBulkWrite = PostModel.bulkWrite;
  let capturedLimit;
  let capturedOperations;
  let capturedOptions;
  const now = new Date('2026-08-25T12:00:00.000Z');
  const candidates = [
    { _id: '507f1f77bcf86cd799439011', createdBy: '507f1f77bcf86cd799439021' },
    { _id: '507f1f77bcf86cd799439012', createdBy: '507f1f77bcf86cd799439022' }
  ];
  PostModel.find = () => ({
    sort() { return this; },
    limit(value) { capturedLimit = value; return this; },
    select() { return this; },
    async lean() { return candidates; }
  });
  PostModel.bulkWrite = async (operations, options) => {
    capturedOperations = operations;
    capturedOptions = options;
    return { modifiedCount: 2 };
  };

  try {
    const count = await postPublishingService.publishDuePosts(now);
    assert.equal(count, 2);
    assert.equal(capturedLimit, 500);
    assert.equal(capturedOptions.ordered, false);
    assert.equal(capturedOperations.length, 2);
    for (const operation of capturedOperations) {
      assert.equal(operation.updateOne.filter.status, 'Scheduled');
      assert.equal(operation.updateOne.filter.visible, true);
      assert.equal(operation.updateOne.filter.scheduledAt.$lte, now);
      assert.equal(operation.updateOne.update.$set.status, 'Published');
      assert.equal(operation.updateOne.update.$set.publishedAt, now);
      assert.equal(operation.updateOne.update.$push.reviewHistory.$slice, -100);
    }
  } finally {
    PostModel.find = originalFind;
    PostModel.bulkWrite = originalBulkWrite;
  }
});

test('device sensor filtering intersects requested assets with the non-admin mapping scope', async () => {
  const originalMappings = mapUserToAssetService.getAssetsMappedData;
  const originalSensorList = assetService.getAssetDataSensorList;
  let capturedFilter;
  mapUserToAssetService.getAssetsMappedData = async () => [{ assetId: '507f1f77bcf86cd799439012' }];
  assetService.getAssetDataSensorList = async filter => {
    capturedFilter = filter;
    return [];
  };
  const response = responseRecorder();
  let nextError;

  try {
    await assetController.getFilteredAssetSensorList(
      {
        user: { _id: '507f1f77bcf86cd799439021', account_id: '507f191e810c19729de860ea', user_role: 'employee' },
        body: { assetList: ['507f1f77bcf86cd799439011'] }
      },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, []);
    assert.equal(String(capturedFilter.account_id), '507f191e810c19729de860ea');
    assert.equal(capturedFilter.visible, true);
    assert.equal(String(capturedFilter.$and[0]._id.$in[0]), '507f1f77bcf86cd799439011');
    assert.equal(String(capturedFilter.$and[1]._id.$in[0]), '507f1f77bcf86cd799439012');
  } finally {
    mapUserToAssetService.getAssetsMappedData = originalMappings;
    assetService.getAssetDataSensorList = originalSensorList;
  }
});

test('general asset filters preserve location, explicit asset and mapping constraints together', async () => {
  const originalMappings = mapUserToAssetService.getAssetsMappedData;
  const originalGetAll = assetService.getAllAssets;
  let capturedFilter;
  mapUserToAssetService.getAssetsMappedData = async () => [{ assetId: '507f1f77bcf86cd799439012' }];
  assetService.getAllAssets = async filter => {
    capturedFilter = filter;
    return [];
  };
  const response = responseRecorder();
  let nextError;

  try {
    await assetController.getFilteredAssets(
      {
        user: { _id: '507f1f77bcf86cd799439021', account_id: '507f191e810c19729de860ea', user_role: 'employee' },
        body: {
          assets: ['507f1f77bcf86cd799439011'],
          locationList: ['507f1f77bcf86cd799439013'],
          top_level: false
        }
      },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, []);
    assert.equal(capturedFilter.top_level, false);
    assert.equal(String(capturedFilter.locationId.$in[0]), '507f1f77bcf86cd799439013');
    assert.equal(String(capturedFilter.$and[0]._id.$in[0]), '507f1f77bcf86cd799439011');
    assert.equal(String(capturedFilter.$and[1]._id.$in[0]), '507f1f77bcf86cd799439012');
  } finally {
    mapUserToAssetService.getAssetsMappedData = originalMappings;
    assetService.getAllAssets = originalGetAll;
  }
});

async function invokePasswordChange(body) {
  let nextError;
  await userController.changeUserPassword(
    { body },
    responseRecorder(),
    error => { nextError = error; }
  );
  return nextError;
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
}

async function invokeController(controller, request) {
  let nextError;
  await controller(request, responseRecorder(), error => { nextError = error; });
  return nextError;
}

async function invokeAuthentication(body) {
  let nextError;
  await userAuthentication(
    { body },
    responseRecorder(),
    error => { nextError = error; }
  );
  return nextError;
}

test('observation payload policy sanitizes rich text and strips tenant, linkage and URL fields', () => {
  const accountId = '507f191e810c19729de860ea';
  const payload = sanitizeObservationCreatePayload({
    observation: '<p onclick="steal()">Motor <strong>vibration</strong></p><script>alert(1)</script>',
    recommendation: '<a href="javascript:alert(1)">Inspect bearings</a>',
    status: 'Alert',
    faults: ['Bearing Issue', 'Bearing Issue'],
    assetId: '507f1f77bcf86cd799439011',
    locationId: '507f1f77bcf86cd799439012',
    top_level_asset_id: '507f1f77bcf86cd799439013',
    files: [{
      originalName: 'evidence.pdf',
      fileName: `20260825-observations-${accountId}-abcd1234.pdf`,
      folderName: 'observations',
      type: 'application/pdf',
      size: 512,
      fileURL: 'https://attacker.example/evidence.pdf',
      filePath: '../../outside'
    }],
    accountId: 'attacker-account',
    createdBy: '507f1f77bcf86cd799439099',
    visible: false,
    type: 'alarm'
  }, accountId);

  assert.doesNotMatch(payload.observation, /script|onclick/i);
  assert.doesNotMatch(payload.recommendation, /javascript:/i);
  assert.equal(payload.faults.length, 1);
  assert.equal(payload.files[0].fileURL, undefined);
  assert.equal(payload.files[0].filePath, undefined);
  assert.equal(payload.accountId, undefined);
  assert.equal(payload.visible, undefined);
  assert.equal(payload.type, undefined);
});

test('observation update policy preserves only referenced stored files and mutable fields', () => {
  const accountId = '507f191e810c19729de860ea';
  const existingFiles = [{
    originalName: 'legacy.pdf', fileName: 'legacy-observation.pdf',
    folderName: 'observations', type: 'application/pdf', size: 100
  }];
  const payload = sanitizeObservationUpdatePayload({
    observation: '<p>Updated observation</p>',
    recommendation: '<p>Updated recommendation</p>',
    status: 'Healthy',
    faults: [],
    files: [{ ...existingFiles[0], fileURL: 'javascript:alert(1)' }],
    assetId: '507f1f77bcf86cd799439099',
    report_id: '507f1f77bcf86cd799439098',
    alarmId: 99,
    userId: '507f1f77bcf86cd799439097'
  }, existingFiles, accountId);

  assert.equal(payload.files[0].fileName, 'legacy-observation.pdf');
  assert.equal(payload.files[0].fileURL, undefined);
  assert.equal(payload.assetId, undefined);
  assert.equal(payload.report_id, undefined);
  assert.equal(payload.alarmId, undefined);
  assert.equal(payload.userId, undefined);
  assert.throws(
    () => sanitizeObservationUpdatePayload({
      observation: '<p>Updated</p>', recommendation: '<p>Updated</p>', status: 'Healthy', faults: [],
      files: [{ fileName: 'foreign.pdf', folderName: 'observations', type: 'application/pdf', size: 10 }]
    }, existingFiles, accountId),
    error => error.status === 400 && /active account/.test(error.message)
  );
});

test('observation references require a matching tenant asset, location and top-level asset', async () => {
  const accountId = '507f191e810c19729de860ea';
  const assetId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  const topLevelAssetId = '507f1f77bcf86cd799439013';
  const originalAssetFindOne = AssetModel.findOne;
  const originalLocationFindOne = LocationModel.findOne;
  const capturedFilters = [];
  let assetLocationId = locationId;
  const queryFor = value => ({ select() { return this; }, async lean() { return value; } });
  AssetModel.findOne = filter => {
    capturedFilters.push(filter);
    return queryFor(String(filter._id) === assetId
      ? { _id: assetId, locationId: assetLocationId, top_level: false, top_level_asset_id: topLevelAssetId }
      : { _id: topLevelAssetId, top_level: true });
  };
  LocationModel.findOne = filter => {
    capturedFilters.push(filter);
    return queryFor({ _id: locationId });
  };

  try {
    await observationService.assertObservationReferences({ assetId, locationId, top_level_asset_id: topLevelAssetId }, accountId);
    assert.ok(capturedFilters.every(filter => filter.visible === true && String(filter.account_id) === accountId));
    assetLocationId = '507f1f77bcf86cd799439099';
    await assert.rejects(
      () => observationService.assertObservationReferences({ assetId, locationId, top_level_asset_id: topLevelAssetId }, accountId),
      error => error.status === 400 && /Asset and location/.test(error.message)
    );
  } finally {
    AssetModel.findOne = originalAssetFindOne;
    LocationModel.findOne = originalLocationFindOne;
  }
});

test('observation update and delete use one tenant-scoped standalone-record mutation', async () => {
  const originalFindOneAndUpdate = ObservationModel.findOneAndUpdate;
  const calls = [];
  ObservationModel.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
    return { _id: filter._id };
  };

  try {
    await observationService.updateObservationById(
      '507f1f77bcf86cd799439011',
      { status: 'Healthy' },
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012'
    );
    await observationService.removeObservationById(
      '507f1f77bcf86cd799439011',
      '507f191e810c19729de860ea',
      '507f1f77bcf86cd799439012'
    );
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(String(call.filter.accountId), '507f191e810c19729de860ea');
      assert.equal(call.filter.visible, true);
      assert.equal(call.filter.report_id, null);
      assert.equal(call.filter.alarmId, null);
    }
    assert.equal(calls[0].update.$set.status, 'Healthy');
    assert.equal(calls[1].update.$set.visible, false);
  } finally {
    ObservationModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('observation lists are visibility scoped and return an empty successful response', async () => {
  const originalGetAll = observationService.getAllObservation;
  let capturedFilter;
  observationService.getAllObservation = async filter => { capturedFilter = filter; return []; };
  const response = responseRecorder();

  try {
    let nextError;
    await observationController.getObservations(
      {
        user: { _id: '507f1f77bcf86cd799439012', account_id: '507f191e810c19729de860ea', user_role: 'admin' },
        query: {}
      },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.equal(capturedFilter.visible, true);
    assert.deepEqual(response.body.data, []);
  } finally {
    observationService.getAllObservation = originalGetAll;
  }
});

test('observation aggregation bounds records before tenant-correlated lookups', async () => {
  const originalAggregate = ObservationModel.aggregate;
  let capturedPipeline;
  ObservationModel.aggregate = async pipeline => { capturedPipeline = pipeline; return []; };

  try {
    await observationService.getAllObservation({
      accountId: '507f191e810c19729de860ea',
      visible: true,
      assetId: '507f1f77bcf86cd799439011'
    });
    assert.deepEqual(capturedPipeline[0].$match.visible, true);
    assert.deepEqual(capturedPipeline[1], { $sort: { _id: -1 } });
    assert.equal(capturedPipeline[2].$limit, 2000);
    const lookups = capturedPipeline.filter(stage => stage.$lookup).map(stage => stage.$lookup);
    assert.equal(lookups.length, 3);
    for (const lookup of lookups) {
      assert.equal(lookup.let.accountId, '$accountId');
      assert.ok(lookup.pipeline[0].$match.$expr.$and.some(condition =>
        condition.$eq?.[1] === '$$accountId'));
    }
  } finally {
    ObservationModel.aggregate = originalAggregate;
  }
});

test('linked alarm and report observations cannot be edited through the timeline endpoint', async () => {
  const originalGetRecord = observationService.getObservationRecord;
  const originalUpdate = observationService.updateObservationById;
  let updateCalls = 0;
  observationService.getObservationRecord = async () => ({
    _id: '507f1f77bcf86cd799439011',
    assetId: '507f1f77bcf86cd799439012',
    alarmId: 88,
    files: []
  });
  observationService.updateObservationById = async () => { updateCalls += 1; };

  try {
    let nextError;
    await observationController.updateObservation(
      {
        user: { _id: '507f1f77bcf86cd799439013', account_id: '507f191e810c19729de860ea' },
        userToken: 'token',
        params: { id: '507f1f77bcf86cd799439011' },
        body: { observation: '<p>x</p>', recommendation: '<p>y</p>', status: 'Healthy', faults: [], files: [] }
      },
      responseRecorder(),
      error => { nextError = error; }
    );
    assert.equal(nextError.status, 409);
    assert.equal(updateCalls, 0);
  } finally {
    observationService.getObservationRecord = originalGetRecord;
    observationService.updateObservationById = originalUpdate;
  }
});

test('asset report policy sanitizes rich text, attachment metadata and server-owned fields', () => {
  const accountId = '507f191e810c19729de860ea';
  const payload = sanitizeAssetReportCreatePayload({
    EquipmentHealth: '3',
    Observations: '<p onclick="steal()">Alert <strong>vibration</strong></p><script>alert(1)</script>',
    Recommendations: '<a href="javascript:alert(1)">Inspect bearing</a>',
    CreateWorkRequest: '2',
    FaultDetected: '1',
    ISO: false,
    NewFault: '',
    Severity: '',
    TrendOfAlarm: '',
    files: [{
      originalName: 'evidence.pdf',
      fileName: `20260825-asset_report-${accountId}-abcd1234.pdf`,
      folderName: 'asset_report',
      type: 'application/pdf',
      size: 512,
      fileURL: 'https://attacker.example/evidence.pdf',
      destination: '../../outside'
    }],
    faultData: [{ name: 'Bearing Issue', value: 3 }],
    asset_health_history: [{ date: 'Aug-26', status: '3' }],
    endpointRMSData: [],
    chartDetail: [],
    harmonicIndex: [],
    assetId: '507f1f77bcf86cd799439011',
    locationId: '507f1f77bcf86cd799439012',
    top_level_asset_id: '507f1f77bcf86cd799439011',
    accountId: 'attacker', visible: false, createdBy: 'attacker', status: 'Completed'
  }, accountId);

  assert.doesNotMatch(payload.Observations, /script|onclick/i);
  assert.doesNotMatch(payload.Recommendations, /javascript:/i);
  assert.equal(payload.files[0].fileURL, undefined);
  assert.equal(payload.files[0].destination, undefined);
  assert.equal(payload.accountId, undefined);
  assert.equal(payload.visible, undefined);
  assert.equal(payload.status, undefined);
  assert.equal(payload.createdFrom, 'Asset Report');
});

test('asset report update and status policies preserve only mutable bounded fields', () => {
  const accountId = '507f191e810c19729de860ea';
  const existingFiles = [{
    originalName: 'legacy.pdf', fileName: 'legacy-report.pdf',
    folderName: 'asset_report', type: 'application/pdf', size: 100
  }];
  const payload = sanitizeAssetReportUpdatePayload({
    Observations: '<p>Updated observation</p>',
    files: [{ ...existingFiles[0], fileURL: 'javascript:alert(1)' }],
    assetId: '507f1f77bcf86cd799439099',
    locationId: '507f1f77bcf86cd799439098',
    top_level_asset_id: '507f1f77bcf86cd799439097',
    accountId: 'attacker', alarmId: 99, status: 'Completed'
  }, existingFiles, accountId);

  assert.equal(payload.Observations, '<p>Updated observation</p>');
  assert.equal(payload.files[0].fileName, 'legacy-report.pdf');
  assert.equal(payload.assetId, undefined);
  assert.equal(payload.locationId, undefined);
  assert.equal(payload.accountId, undefined);
  assert.equal(payload.status, undefined);
  assert.deepEqual(sanitizeAssetReportStatusPayload({
    status: 'Completed', observationId: '507f1f77bcf86cd799439011',
    top_level_asset_id: '507f1f77bcf86cd799439099', visible: false
  }), { status: 'Completed', observationId: '507f1f77bcf86cd799439011' });
  assert.throws(
    () => sanitizeAssetReportStatusPayload({ status: 'Closed' }),
    error => error.status === 400 && /Status/.test(error.message)
  );
});

test('asset report references require a matching tenant asset, location and top-level asset', async () => {
  const accountId = '507f191e810c19729de860ea';
  const assetId = '507f1f77bcf86cd799439011';
  const locationId = '507f1f77bcf86cd799439012';
  const topLevelAssetId = '507f1f77bcf86cd799439013';
  const originalAssetFindOne = AssetModel.findOne;
  const originalLocationFindOne = LocationModel.findOne;
  const capturedFilters = [];
  let assetLocationId = locationId;
  const queryFor = value => ({ select() { return this; }, async lean() { return value; } });
  AssetModel.findOne = filter => {
    capturedFilters.push(filter);
    return queryFor(String(filter._id) === assetId
      ? { _id: assetId, locationId: assetLocationId, top_level: false, top_level_asset_id: topLevelAssetId }
      : { _id: topLevelAssetId, top_level: true });
  };
  LocationModel.findOne = filter => {
    capturedFilters.push(filter);
    return queryFor({ _id: locationId });
  };

  try {
    await assetReportService.assertAssetReportReferences({ assetId, locationId, top_level_asset_id: topLevelAssetId }, accountId);
    assert.ok(capturedFilters.every(filter => filter.visible === true && String(filter.account_id) === accountId));
    assetLocationId = '507f1f77bcf86cd799439099';
    await assert.rejects(
      () => assetReportService.assertAssetReportReferences({ assetId, locationId, top_level_asset_id: topLevelAssetId }, accountId),
      error => error.status === 400 && /Asset and location/.test(error.message)
    );
  } finally {
    AssetModel.findOne = originalAssetFindOne;
    LocationModel.findOne = originalLocationFindOne;
  }
});

test('asset report writes are tenant scoped and status transitions are compare-and-set', async () => {
  const originalFindOneAndUpdate = ReportAssetModel.findOneAndUpdate;
  const calls = [];
  ReportAssetModel.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });
    return { _id: filter._id };
  };
  try {
    const reportId = '507f1f77bcf86cd799439011';
    const accountId = '507f191e810c19729de860ea';
    const userId = '507f1f77bcf86cd799439012';
    await assetReportService.updateAssetReport(reportId, { EquipmentHealth: '4' }, accountId, userId);
    await assetReportService.partialUpdateAssetReport(reportId, accountId, 'Open', { status: 'Completed' }, userId);
    await assetReportService.removeAssetReportById(reportId, accountId, userId);

    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.equal(String(call.filter.accountId), accountId);
      assert.equal(call.filter.visible, true);
    }
    assert.equal(calls[1].filter.status, 'Open');
    assert.equal(calls[1].update.$push.status_details.status, 'Completed');
    assert.equal(calls[2].update.$set.visible, false);
  } finally {
    ReportAssetModel.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('asset report lists return an empty successful response', async () => {
  const originalGetAll = assetReportService.getAllAssetReports;
  assetReportService.getAllAssetReports = async () => [];
  const response = responseRecorder();
  try {
    let nextError;
    await assetReportController.getAssetsReport(
      { user: { _id: '507f1f77bcf86cd799439012', account_id: '507f191e810c19729de860ea', user_role: 'admin' } },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, []);
  } finally {
    assetReportService.getAllAssetReports = originalGetAll;
  }
});

test('location report update policy strips ownership and audit fields', () => {
  const payload = sanitizeLocationReportUpdatePayload({
    asset_condition_summary_data: [{ key: 'Healthy', value: { value: 2 } }],
    account_id: 'attacker', location_id: 'attacker', visible: false,
    createdBy: 'attacker', user: { password: 'secret' }
  });
  assert.equal(payload.asset_condition_summary_data.length, 1);
  assert.equal(payload.account_id, undefined);
  assert.equal(payload.location_id, undefined);
  assert.equal(payload.visible, undefined);
  assert.equal(payload.user, undefined);
});

test('location hierarchy traversal is batched and cycle safe', async () => {
  const originalFind = LocationModel.find;
  const calls = [];
  LocationModel.find = filter => {
    calls.push(filter);
    const parentIds = filter.parent_id.$in.map(String);
    const rows = parentIds.includes('root')
      ? [{ _id: 'child' }]
      : parentIds.includes('child')
        ? [{ _id: 'root' }]
        : [];
    return { select() { return this; }, async lean() { return rows; } };
  };
  try {
    const ids = await locationReportService.fetchAllChildLocationIds('root', 'account');
    assert.deepEqual(ids.sort(), ['child', 'root']);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.visible === true && call.account_id === 'account'));
  } finally {
    LocationModel.find = originalFind;
  }
});

test('location report generation uses one visible tenant-scoped latest-report aggregation', async () => {
  const originalLocationFindOne = LocationModel.findOne;
  const originalAssetFind = AssetModel.find;
  const originalAggregate = ReportAssetModel.aggregate;
  const originalPopulate = ReportAssetModel.populate;
  const originalFetchChildren = locationReportService.fetchAllChildLocationIds;
  const originalSave = ReportLocationModel.prototype.save;
  let pipeline;
  let assetFilter;
  LocationModel.findOne = () => ({ select() { return this; }, async lean() { return { _id: 'root-location' }; } });
  locationReportService.fetchAllChildLocationIds = async () => ['root-location', 'child-location'];
  AssetModel.find = filter => {
    assetFilter = filter;
    return { select() { return this; }, limit() { return this; }, async lean() { return [{ _id: 'asset-1' }]; } };
  };
  ReportAssetModel.aggregate = async value => {
    pipeline = value;
    return [{
      _id: 'report-1', top_level_asset_id: 'asset-1', EquipmentHealth: '4', faultData: [],
      locationId: { _id: 'child-location', location_name: 'Child' },
      assetId: { _id: 'asset-1', asset_name: 'Pump' }, endpointRMSData: [], asset_health_history: []
    }];
  };
  ReportAssetModel.populate = async docs => docs;
  ReportLocationModel.prototype.save = async function () { return this; };

  try {
    const user = { _id: '507f1f77bcf86cd799439012', account_id: '507f191e810c19729de860ea' };
    const report = await locationReportService.createLocationReport('507f1f77bcf86cd799439011', user);
    assert.ok(report);
    assert.equal(assetFilter.visible, true);
    assert.deepEqual(assetFilter.locationId.$in, ['root-location', 'child-location']);
    assert.equal(pipeline[0].$match.visible, true);
    assert.equal(String(pipeline[0].$match.accountId), user.account_id);
    assert.ok(pipeline.some(stage => stage.$group?.report?.$first === '$$ROOT'));
  } finally {
    LocationModel.findOne = originalLocationFindOne;
    AssetModel.find = originalAssetFind;
    ReportAssetModel.aggregate = originalAggregate;
    ReportAssetModel.populate = originalPopulate;
    locationReportService.fetchAllChildLocationIds = originalFetchChildren;
    ReportLocationModel.prototype.save = originalSave;
  }
});

test('location report lists return an empty successful response', async () => {
  const originalGetAll = locationReportService.getAll;
  locationReportService.getAll = async () => [];
  const response = responseRecorder();
  try {
    let nextError;
    await locationReportController.getLocationsReport(
      { user: { _id: '507f1f77bcf86cd799439012', account_id: '507f191e810c19729de860ea', user_role: 'admin' }, query: {} },
      response,
      error => { nextError = error; }
    );
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, []);
  } finally {
    locationReportService.getAll = originalGetAll;
  }
});

test('asset and location reports have tenant-list compound indexes', () => {
  assert.ok(ReportAssetModel.schema.indexes().some(([fields]) => (
    fields.accountId === 1 && fields.visible === 1 && fields.top_level_asset_id === 1 && fields._id === -1
  )));
  assert.ok(ReportLocationModel.schema.indexes().some(([fields]) => (
    fields.account_id === 1 && fields.visible === 1 && fields.location_id === 1 && fields._id === -1
  )));
});

test('dashboard work-order filters reject unsafe date ranges and object query injection', async () => {
  const base = {
    account_id: '507f191e810c19729de860ea',
    user_id: '507f1f77bcf86cd799439011',
    user_role: 'admin'
  };

  const safeMatch = await orderService.buildSearchMatch({
    ...base,
    query: { order_no: { $ne: null } }
  });
  assert.equal(safeMatch.order_no, undefined);

  await assert.rejects(
    () => orderService.buildSearchMatch({
      ...base,
      query: { fromDate: 'invalid', toDate: new Date().toISOString() }
    }),
    error => error.status === 400 && /fromDate/.test(error.message)
  );

  const now = new Date();
  const invertedStart = new Date(now.getTime() - 3600000);
  await assert.rejects(
    () => orderService.buildSearchMatch({
      ...base,
      query: { fromDate: now.toISOString(), toDate: invertedStart.toISOString() }
    }),
    error => error.status === 400
  );

  const overFiveYears = new Date(now);
  overFiveYears.setFullYear(overFiveYears.getFullYear() - 6);
  await assert.rejects(
    () => orderService.buildSearchMatch({
      ...base,
      query: { fromDate: overFiveYears.toISOString(), toDate: now.toISOString() }
    }),
    error => error.status === 400
  );
});

test('dashboard pending orders are sorted and capped before expensive lookups', async () => {
  const originalAggregate = WorkOrderModel.aggregate;
  let pipeline;
  WorkOrderModel.aggregate = async value => {
    pipeline = value;
    return [];
  };
  try {
    const result = await orderService.getDashboardPendingOrders({ account_id: 'account', visible: true }, 1000);
    assert.deepEqual(result, []);
    assert.deepEqual(pipeline[0], { $match: { account_id: 'account', visible: true } });
    assert.deepEqual(pipeline[1], { $sort: { createdAt: -1 } });
    assert.deepEqual(pipeline[2], { $limit: 100 });
  } finally {
    WorkOrderModel.aggregate = originalAggregate;
  }
});

test('execution dashboard filters date scope in MongoDB before relationship lookups', async () => {
  const originalAggregate = WorkOrderModel.aggregate;
  let pipeline;
  WorkOrderModel.aggregate = async value => {
    pipeline = value;
    return [];
  };
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - 7 * 86400000);
  try {
    await orderService.getExecutionScopedOrders(
      { account_id: 'account', visible: true },
      { fromDate, toDate }
    );
    assert.equal(pipeline[0].$match.$and[0].account_id, 'account');
    assert.equal(pipeline[0].$match.$and[1].$or.length, 3);
    assert.deepEqual(pipeline[0].$match.$and[1].$or[0].end_date, { $gte: fromDate, $lte: toDate });
  } finally {
    WorkOrderModel.aggregate = originalAggregate;
  }
});

test('completed-by-user dashboard lookup remains tenant and active-user scoped', async () => {
  const originalOrderFind = WorkOrderModel.find;
  const originalUserFind = UserModel.find;
  let userFilter;
  const userId = '507f1f77bcf86cd799439011';
  WorkOrderModel.find = () => ({
    select() { return this; },
    async lean() {
      return [{
        order_no: 'WO-1', title: 'Inspection', actual_end_date: new Date(),
        status_details: [], completed_by: { id: userId }
      }];
    }
  });
  UserModel.find = filter => {
    userFilter = filter;
    return {
      select() { return this; },
      async lean() { return [{ _id: userId, firstName: 'Test', lastName: 'User' }]; }
    };
  };
  try {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 86400000);
    const result = await orderService.completedByUserReport(
      { account_id: 'tenant-account', visible: true },
      { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() }
    );
    assert.equal(userFilter.account_id, 'tenant-account');
    assert.equal(userFilter.user_status, 'active');
    assert.equal(result.details[0].user_name, 'Test User');
  } finally {
    WorkOrderModel.find = originalOrderFind;
    UserModel.find = originalUserFind;
  }
});

test('asset and location hierarchy routes enforce mutation-specific permissions', () => {
  const assetRoutes = fs.readFileSync(path.join(__dirname, '../src/masters/asset/asset.routes.ts'), 'utf8');
  const locationRoutes = fs.readFileSync(path.join(__dirname, '../src/masters/location/location.routes.ts'), 'utf8');
  const uploadRoutes = fs.readFileSync(path.join(__dirname, '../src/upload/upload.routes.ts'), 'utf8');
  assert.match(assetRoutes, /parent_id\s*\?\s*'add_child_asset'\s*:\s*'add_asset'/);
  assert.match(assetRoutes, /patch\('\/buzzer\/:location_id'[\s\S]*hasRolePermission\('asset', 'edit_asset'\)/);
  assert.match(locationRoutes, /parent_id\s*\?\s*'add_child_location'\s*:\s*'add_location'/);
  assert.match(locationRoutes, /floor-map-image\/:id'[\s\S]*hasRolePermission\('floorMap', 'upload_floor_map'\)/);
  assert.match(uploadRoutes, /folderName === 'assets'[\s\S]*assetImageUploadPermission/);
  assert.match(uploadRoutes, /folderName === 'locations'[\s\S]*locationImageUploadPermission/);
});

test('floor-map routes enforce view, create, upload and delete permissions', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/masters/floorMap/floorMap.routes.ts'), 'utf8');
  assert.match(routes, /post\('\/coordinate'[\s\S]*hasRolePermission\('floorMap', 'create_kpi'\)/);
  assert.match(routes, /get\('\/coordinate\/asset\/:id'[\s\S]*hasRolePermission\('floorMap', 'view_floor_map'\)/);
  assert.match(routes, /get\('\/:id'[\s\S]*hasRolePermission\('floorMap', 'view_floor_map'\)/);
  assert.match(routes, /patch\('\/:id'[\s\S]*hasRolePermission\('floorMap', 'upload_floor_map'\)/);
  assert.match(routes, /delete\('\/coordinate\/:id'[\s\S]*hasRolePermission\('floorMap', 'delete_kpi'\)/);
});

test('floor-map coordinate creation derives tenant ownership and strips extra fields', async () => {
  const originalFindOne = LocationModel.findOne;
  const originalGet = floorMapService.getFloorMaps;
  const originalInsert = floorMapService.insertFloorMapCoordinates;
  const accountId = '507f1f77bcf86cd799439001';
  const userId = '507f1f77bcf86cd799439002';
  const locationId = '507f1f77bcf86cd799439003';
  let inserted;
  LocationModel.findOne = () => ({ select() { return this; }, async lean() { return { _id: locationId }; } });
  floorMapService.getFloorMaps = async () => [];
  floorMapService.insertFloorMapCoordinates = async (body, account, user) => {
    inserted = { body, account, user };
    return { _id: 'coordinate' };
  };
  try {
    const res = responseRecorder();
    let nextError;
    await floorMapController.setFloorMapCoordinates({
      user: { account_id: accountId, _id: userId, user_role: 'admin' },
      body: {
        coordinate: { x: 100, y: 200 }, locationId, data_type: 'location',
        account_id: 'attacker', createdBy: 'attacker', visible: false, end_point: { point_name: 'ignored' }
      }
    }, res, error => { nextError = error; });
    assert.equal(nextError, undefined);
    assert.equal(String(inserted.account), accountId);
    assert.equal(String(inserted.user), userId);
    assert.deepEqual(Object.keys(inserted.body).sort(), ['coordinate', 'data_type', 'locationId']);
    assert.equal(res.statusCode, 200);
  } finally {
    LocationModel.findOne = originalFindOne;
    floorMapService.getFloorMaps = originalGet;
    floorMapService.insertFloorMapCoordinates = originalInsert;
  }
});

test('floor-map coordinate creation rejects cross-tenant references before writing', async () => {
  const originalFindOne = LocationModel.findOne;
  const originalInsert = floorMapService.insertFloorMapCoordinates;
  let inserted = false;
  LocationModel.findOne = () => ({ select() { return this; }, async lean() { return null; } });
  floorMapService.insertFloorMapCoordinates = async () => { inserted = true; };
  try {
    let nextError;
    await floorMapController.setFloorMapCoordinates({
      user: {
        account_id: '507f1f77bcf86cd799439001',
        _id: '507f1f77bcf86cd799439002',
        user_role: 'admin'
      },
      body: {
        coordinate: { x: 1, y: 2 },
        locationId: '507f1f77bcf86cd799439099',
        data_type: 'kpi'
      }
    }, responseRecorder(), error => { nextError = error; });
    assert.equal(nextError.status, 404);
    assert.equal(inserted, false);
  } finally {
    LocationModel.findOne = originalFindOne;
    floorMapService.insertFloorMapCoordinates = originalInsert;
  }
});

test('floor-map hierarchy traversal batches roots and terminates on cycles', async () => {
  const originalFind = LocationModel.find;
  const calls = [];
  LocationModel.find = filter => {
    calls.push(filter);
    const parents = filter.parent_id.$in.map(String);
    const rows = parents.includes('root-a') || parents.includes('root-b')
      ? [
          { _id: 'child-a', parent_id: 'root-a' },
          { _id: 'child-b', parent_id: 'root-b' }
        ]
      : parents.includes('child-a') || parents.includes('child-b')
        ? [
            { _id: 'root-a', parent_id: 'child-a' },
            { _id: 'child-c', parent_id: 'child-b' }
          ]
        : [];
    return { select() { return this; }, async lean() { return rows; } };
  };
  try {
    const ids = await floorMapService.getAllChildLocationsRecursive(
      ['root-a', 'root-b'], undefined, 'admin', 'account'
    );
    assert.deepEqual(ids.sort(), ['child-a', 'child-b', 'child-c']);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0].parent_id.$in.sort(), ['root-a', 'root-b']);
    assert.ok(calls.every(call => call.account_id === 'account' && call.visible === true));
  } finally {
    LocationModel.find = originalFind;
  }
});

test('location master child traversal is tenant scoped and cycle safe', async () => {
  const originalFind = LocationModel.find;
  const calls = [];
  LocationModel.find = filter => {
    calls.push(filter);
    const rows = String(filter.parent_id) === 'root'
      ? [{ _id: 'child' }]
      : String(filter.parent_id) === 'child'
        ? [{ _id: 'root' }]
        : [];
    return { async lean() { return rows; } };
  };
  try {
    const ids = await locationService.getAllChildLocationIds('root', 'account');
    assert.deepEqual(ids, ['root', 'child']);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.visible === true && call.account_id === 'account'));
  } finally {
    LocationModel.find = originalFind;
  }
});

test('location creation derives tenant hierarchy and strips server-owned fields', async () => {
  const originalUserCount = UserModel.countDocuments;
  const originalLocationFindOne = LocationModel.findOne;
  const originalInsert = locationService.insertLocation;
  const originalMap = mapUserToLocationService.mapUserLocationData;
  const originalNotify = notificationService.notifyAccountUsers;
  let insertedBody;
  let mappedUsers;
  const accountId = '507f1f77bcf86cd799439001';
  const userId = '507f1f77bcf86cd799439002';
  const parentId = '507f1f77bcf86cd799439003';
  const topId = '507f1f77bcf86cd799439004';
  const assigneeId = '507f1f77bcf86cd799439005';
  UserModel.countDocuments = async () => 1;
  LocationModel.findOne = () => ({
    async select() { return { _id: parentId, location_name: 'Parent', top_level: false, top_level_location_id: topId }; }
  });
  locationService.insertLocation = async body => {
    insertedBody = { ...body };
    return { _id: 'new-location', location_name: body.location_name };
  };
  mapUserToLocationService.mapUserLocationData = async (_id, users) => { mappedUsers = users; };
  notificationService.notifyAccountUsers = async () => undefined;
  try {
    const res = responseRecorder();
    let nextError;
    await locationController.createLocation({
      user: { account_id: accountId, _id: userId },
      body: {
        location_name: 'Child', location_type: 'Area', parent_id: parentId,
        userIdList: [assigneeId], account_id: 'attacker', createdBy: 'attacker', visible: false,
        top_level: true, top_level_location_id: '507f1f77bcf86cd799439099'
      }
    }, res, error => { nextError = error; });
    assert.equal(nextError, undefined);
    assert.equal(String(insertedBody.account_id), accountId);
    assert.equal(insertedBody.createdBy, userId);
    assert.equal(insertedBody.visible, undefined);
    assert.equal(insertedBody.top_level, false);
    assert.equal(String(insertedBody.top_level_location_id), topId);
    assert.deepEqual(mappedUsers, [assigneeId]);
    assert.equal(res.statusCode, 201);
  } finally {
    UserModel.countDocuments = originalUserCount;
    LocationModel.findOne = originalLocationFindOne;
    locationService.insertLocation = originalInsert;
    mapUserToLocationService.mapUserLocationData = originalMap;
    notificationService.notifyAccountUsers = originalNotify;
  }
});

test('asset creation rejects a parent from a different location before writing', async () => {
  const originalUserCount = UserModel.countDocuments;
  const originalGetLocation = locationService.getLocationById;
  const originalHierarchy = assetService.getAssetHierarchyNode;
  const originalCreate = assetService.createAssetOld;
  const accountId = '507f1f77bcf86cd799439001';
  const locationId = '507f1f77bcf86cd799439010';
  const parentId = '507f1f77bcf86cd799439011';
  UserModel.countDocuments = async () => 1;
  locationService.getLocationById = async () => ({ _id: locationId });
  assetService.getAssetHierarchyNode = async () => ({
    _id: parentId, locationId: '507f1f77bcf86cd799439099', top_level: true
  });
  assetService.createAssetOld = async () => { throw new Error('must not write'); };
  try {
    let nextError;
    await assetController.createOld({
      user: { account_id: accountId, _id: '507f1f77bcf86cd799439002' },
      userToken: 'token',
      body: {
        asset_name: 'Pump', asset_type: 'Other', locationId, parent_id: parentId,
        userIdList: ['507f1f77bcf86cd799439005'], alarmType: ['alert']
      }
    }, responseRecorder(), error => { nextError = error; });
    assert.equal(nextError.status, 400);
    assert.match(nextError.message, /Parent asset and location/);
  } finally {
    UserModel.countDocuments = originalUserCount;
    locationService.getLocationById = originalGetLocation;
    assetService.getAssetHierarchyNode = originalHierarchy;
    assetService.createAssetOld = originalCreate;
  }
});

test('copying a root asset requires root-asset permission even when child permission exists', async () => {
  const originalHierarchy = assetService.getAssetHierarchyNode;
  const originalCopy = assetService.makeAssetCopyRecursive;
  assetService.getAssetHierarchyNode = async () => ({ _id: 'asset', top_level: true, parent_id: null });
  assetService.makeAssetCopyRecursive = async () => { throw new Error('must not copy'); };
  try {
    let nextError;
    await assetController.makeAssetCopy({
      user: { account_id: '507f1f77bcf86cd799439001', _id: '507f1f77bcf86cd799439002' },
      role: { asset: { add_asset: false, add_child_asset: true } },
      params: { id: '507f1f77bcf86cd799439011' },
      userToken: 'token'
    }, responseRecorder(), error => { nextError = error; });
    assert.equal(nextError.status, 403);
  } finally {
    assetService.getAssetHierarchyNode = originalHierarchy;
    assetService.makeAssetCopyRecursive = originalCopy;
  }
});

test('equipment routes validate create and update payloads and accept either copy permission', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/masters/equipment/equipment.routes.ts'), 'utf8');
  assert.match(routes, /post\('\/'[\s\S]*hasRolePermission\('asset', 'add_asset'\)[\s\S]*equipmentValidator[\s\S]*validate[\s\S]*equipmentController\.create/);
  assert.match(routes, /put\('\/:id'[\s\S]*hasRolePermission\('asset', 'edit_asset'\)[\s\S]*equipmentValidator[\s\S]*validate[\s\S]*equipmentController\.update/);
  assert.match(routes, /make-copy\/:id'[\s\S]*hasAnyRolePermission\('asset', \['add_asset', 'add_child_asset'\]\)/);
});

test('equipment payload sanitizer drops server-owned and unknown processor fields', () => {
  const userId = '507f1f77bcf86cd799439005';
  const payload = sanitizeEquipmentPayload({
    Equipment: {
      asset_name: '  Line 1  ', asset_type: 'Equipment', userList: [userId, userId],
      account_id: 'attacker', createdBy: 'attacker', locationId: '507f1f77bcf86cd799439010',
      imageNodeData: { nodes: [{
        data: { id: 1, label: ' Motor 1 ', type: 'Motor', image: ' motor.png ', injected: true },
        position: { x: 10, y: 20, z: 30 }, injected: true
      }], injected: true }
    },
    Motor: {
      asset_name: ' Motor 1 ', asset_type: 'Injected', minInputRotation: 1200,
      org_id: 'attacker', account_id: 'attacker', arbitrary: true
    },
    Flexible: {}, Rigid: {}, Belt_Pulley: [], Gearbox: [], Fan_Blower: {}, Pumps: {}, Compressor: {},
    account_id: 'attacker'
  });
  assert.equal(payload.Equipment.asset_name, 'Line 1');
  assert.deepEqual(payload.Equipment.userList, [userId]);
  assert.equal(payload.Equipment.account_id, undefined);
  assert.equal(payload.Motor.asset_type, 'Motor');
  assert.equal(payload.Motor.org_id, undefined);
  assert.equal(payload.Motor.arbitrary, undefined);
  assert.deepEqual(payload.Equipment.imageNodeData.nodes[0], {
    data: { id: 1, label: 'Motor 1', type: 'Motor', image: 'motor.png' },
    position: { x: 10, y: 20 }
  });
});

test('equipment payload sanitizer requires the equipment root object', () => {
  assert.throws(
    () => sanitizeEquipmentPayload({ Motor: {} }),
    error => error.status === 400 && /payload is required/i.test(error.message)
  );
});

test('non-admin equipment tree keeps mapping and requested-id restrictions together', async () => {
  const originalMappings = mapUserToAssetService.getAssetsMappedData;
  const originalTree = equipmentService.getEquipmentTreeData;
  const accountId = '507f1f77bcf86cd799439001';
  const userId = '507f1f77bcf86cd799439002';
  const mappedId = '507f1f77bcf86cd799439010';
  const requestedId = '507f1f77bcf86cd799439011';
  let capturedQuery;
  mapUserToAssetService.getAssetsMappedData = async () => [{ assetId: mappedId }];
  equipmentService.getEquipmentTreeData = async query => {
    capturedQuery = query;
    return [{ id: requestedId }];
  };
  try {
    const response = responseRecorder();
    let nextError;
    await equipmentController.getAssetTree({
      user: { account_id: accountId, _id: userId, user_role: 'employee' },
      query: { id: requestedId }
    }, response, error => { nextError = error; });
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.equal(capturedQuery.$and.length, 2);
    assert.equal(String(capturedQuery.$and[0].$or[0]._id.$in[0]), mappedId);
    assert.equal(String(capturedQuery.$and[1].$or[0]._id.$in[0]), requestedId);
  } finally {
    mapUserToAssetService.getAssetsMappedData = originalMappings;
    equipmentService.getEquipmentTreeData = originalTree;
  }
});

test('equipment descendant traversal is tenant scoped, batched and cycle safe', async () => {
  const originalFind = AssetModel.find;
  const accountId = '507f1f77bcf86cd799439001';
  const rootId = '507f1f77bcf86cd799439010';
  const childId = '507f1f77bcf86cd799439011';
  const calls = [];
  AssetModel.find = filter => {
    calls.push(filter);
    const parents = filter.parent_id.$in.map(String);
    const rows = parents.includes(rootId)
      ? [{ _id: childId }]
      : parents.includes(childId)
        ? [{ _id: rootId }]
        : [];
    const query = {
      select() { return query; },
      session() { return query; },
      async lean() { return rows; }
    };
    return query;
  };
  try {
    const ids = await equipmentService.getAllChildEquipmentIDs(rootId, accountId);
    assert.deepEqual(ids, [rootId, childId]);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.account_id === accountId && call.visible === true));
  } finally {
    AssetModel.find = originalFind;
  }
});

test('equipment child updates require matching tenant, parent, type and visibility', async () => {
  const originalStartSession = mongoose.startSession;
  const originalUpdate = AssetModel.findOneAndUpdate;
  const originalRemoveMapping = mapUserToAssetService.removeAssetMapping;
  const accountId = '507f1f77bcf86cd799439001';
  const equipmentId = '507f1f77bcf86cd799439010';
  const motorId = '507f1f77bcf86cd799439011';
  let capturedMatch;
  let removedMapping;
  mongoose.startSession = async () => ({
    startTransaction() {},
    async commitTransaction() {},
    async abortTransaction() {},
    async endSession() {},
    inTransaction() { return true; }
  });
  AssetModel.findOneAndUpdate = (match) => {
    capturedMatch = match;
    return { async lean() { return { _id: motorId, asset_type: 'Motor' }; } };
  };
  mapUserToAssetService.removeAssetMapping = async id => { removedMapping = id; };
  try {
    const result = await equipmentService.updateMotor(
      { id: motorId, asset_name: 'Motor 1', asset_type: 'Motor' },
      { id: equipmentId, asset_timezone: 'UTC', locationId: '507f1f77bcf86cd799439012' },
      accountId,
      '507f1f77bcf86cd799439002'
    );
    assert.equal(String(capturedMatch._id), motorId);
    assert.equal(String(capturedMatch.account_id), accountId);
    assert.equal(String(capturedMatch.parent_id), equipmentId);
    assert.equal(capturedMatch.asset_type, 'Motor');
    assert.equal(capturedMatch.visible, true);
    assert.equal(removedMapping, motorId);
    assert.equal(String(result._id), motorId);
  } finally {
    mongoose.startSession = originalStartSession;
    AssetModel.findOneAndUpdate = originalUpdate;
    mapUserToAssetService.removeAssetMapping = originalRemoveMapping;
  }
});

test('equipment copy does not report success when processor endpoint replication fails', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/masters/equipment/equipment.service.ts'), 'utf8');
  const copyMethod = source.slice(
    source.indexOf('async makeAssetCopyByIdWithChildren'),
    source.indexOf('export const equipmentService')
  );

  assert.doesNotMatch(copyMethod, /console\.error\("Endpoint copy failed/);
  assert.match(copyMethod, /deleteEquipmentEndpointByAssetId\(\[savedAsset\._id\]/);
  assert.match(copyMethod, /Object\.assign\(error, \{ status: 502 \}\)/);
  assert.match(copyMethod, /throw error/);
});

test('equipment controller cleanup cannot replace the original request error', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/masters/equipment/equipment.controller.ts'), 'utf8');
  const createHandler = source.slice(source.indexOf('create = async'), source.indexOf('update = async'));
  const updateHandler = source.slice(source.indexOf('update = async'), source.indexOf('updateAssetImage = async'));

  assert.match(createHandler, /try \{\s*await equipmentService\.deleteAssetsById\(equipmentId\);\s*\} catch \{ \}/);
  assert.match(createHandler, /try \{\s*await processorAPIService\.deleteEquipmentEndpointByAssetId/);
  assert.match(updateHandler, /try \{\s*await equipmentService\.deleteEquipmentAssetIds\(newlyCreatedAssetId\);\s*\} catch \{ \}/);
});

test('shared guide payload policies strip ownership fields and canonicalize bounded steps', () => {
  const assetId = '507f1f77bcf86cd799439010';
  const image = 'data:image/png;base64,iVBORw0KGgo=';
  const instruction = sanitizeInstructionPayload({
    title: '  Lockout  ',
    tag: 'Safety',
    description: '  Isolate power.  ',
    assetId,
    account_id: 'attacker',
    visible: false,
    createdBy: 'attacker',
    WI_steps: [{
      title: '  Stop  ', description: '  Press stop.  ', image: [{ file: image, type: 'text/html', injected: true }],
      id: 99, Position: 99, injected: true
    }]
  });
  const troubleshooting = sanitizeTroubleshootingPayload({
    title: '  Reset  ', tags: 'Maintenance', locationId: '507f1f77bcf86cd799439011',
    troubleshooting_steps: [{ title: ' Check ', description: ' Inspect ', files: [{ file: image }] }],
    updatedBy: 'attacker'
  });

  assert.equal(instruction.title, 'Lockout');
  assert.equal(instruction.account_id, undefined);
  assert.equal(instruction.visible, undefined);
  assert.deepEqual(instruction.WI_steps[0], {
    title: 'Stop', description: 'Press stop.', id: 1, Position: 1,
    image: [{ file: image, type: 'image/png' }]
  });
  assert.equal(troubleshooting.updatedBy, undefined);
  assert.deepEqual(troubleshooting.troubleshooting_steps[0].image, [{ file: image, type: 'image/png' }]);
});

test('shared guide payload policies reject ambiguous scope and unbounded content', () => {
  const assetId = '507f1f77bcf86cd799439010';
  const locationId = '507f1f77bcf86cd799439011';
  const step = { title: 'Step', description: 'Description', image: [] };
  assert.throws(
    () => sanitizeInstructionPayload({ title: 'Guide', WI_steps: [step], assetId, locationId }),
    error => error.status === 400 && /exactly one/i.test(error.message)
  );
  assert.throws(
    () => sanitizeInstructionPayload({ title: 'Guide', WI_steps: Array.from({ length: 26 }, () => step), assetId }),
    error => error.status === 400 && /between 1 and 25/i.test(error.message)
  );
  assert.throws(
    () => sanitizeTroubleshootingPayload({ title: 'Guide', tags: 'Injected', troubleshooting_steps: [step], assetId }),
    error => error.status === 400 && /invalid.*tag/i.test(error.message)
  );
  assert.throws(
    () => sanitizeInstructionPayload({
      title: 'Guide', assetId,
      WI_steps: [{ ...step, image: [{ file: 'data:image/png;base64,PGh0bWw+' }] }]
    }),
    error => error.status === 400 && /invalid or oversized image/i.test(error.message)
  );
});

test('shared guide context permissions follow the target module and prevent scope moves', () => {
  const assetId = '507f1f77bcf86cd799439010';
  const locationId = '507f1f77bcf86cd799439011';
  const req = {
    user: { user_role: 'manager' },
    role: { asset: { edit_asset: true }, location: { edit_location: false } }
  };

  assert.equal(assertGuideMutationPermission(req, { assetId }).module, 'asset');
  assert.throws(
    () => assertGuideMutationPermission(req, { locationId }),
    error => error.status === 403
  );
  assert.equal(getGuideContext({ assetId }).id, assetId);
  assert.throws(
    () => assertSameGuideContext({ assetId }, { locationId }),
    error => error.status === 400 && /cannot be moved/i.test(error.message)
  );
});

test('shared guide routes validate context and enforce context-specific mutation permission', () => {
  const instructionRoutes = fs.readFileSync(path.join(__dirname, '../src/work/instruction/instruction.routes.ts'), 'utf8');
  const troubleshootingRoutes = fs.readFileSync(path.join(__dirname, '../src/masters/troubleshoot-guide/troubleshoot-guide.routes.ts'), 'utf8');
  for (const routes of [instructionRoutes, troubleshootingRoutes]) {
    assert.match(routes, /get\('\/'[\s\S]*QueryValidator[\s\S]*validate/);
    assert.match(routes, /post\('\/'[\s\S]*hasGuideMutationPermission[\s\S]*Validator[\s\S]*validate/);
    assert.match(routes, /put\('\/:id'[\s\S]*hasGuideMutationPermission/);
  }
});

test('shared guide models index tenant-context lists used by routed pages', () => {
  const instructionIndexes = WorkInstructions.schema.indexes().map(([keys]) => keys);
  const troubleshootingIndexes = TroubleshootGuideModel.schema.indexes().map(([keys]) => keys);
  for (const indexes of [instructionIndexes, troubleshootingIndexes]) {
    assert.ok(indexes.some(keys => keys.account_id === 1 && keys.assetId === 1 && keys.visible === 1));
    assert.ok(indexes.some(keys => keys.account_id === 1 && keys.locationId === 1 && keys.visible === 1));
  }
});

test('shared guide target access intersects tenant, requested asset and user mappings', async () => {
  const originalMappings = mapUserToAssetService.getAssetsMappedData;
  const originalExists = AssetModel.exists;
  const assetId = '507f1f77bcf86cd799439010';
  const accountId = '507f1f77bcf86cd799439001';
  let capturedFilter;
  mapUserToAssetService.getAssetsMappedData = async () => [{ assetId }];
  AssetModel.exists = async filter => {
    capturedFilter = filter;
    return { _id: assetId };
  };
  try {
    await assertGuideTargetAccessible(
      { _id: '507f1f77bcf86cd799439002', account_id: accountId, user_role: 'manager' },
      { assetId }
    );
    assert.equal(String(capturedFilter.account_id), accountId);
    assert.equal(capturedFilter.visible, true);
    assert.equal(String(capturedFilter.$and[0]._id), assetId);
    assert.equal(String(capturedFilter.$and[1]._id.$in[0]), assetId);
  } finally {
    mapUserToAssetService.getAssetsMappedData = originalMappings;
    AssetModel.exists = originalExists;
  }
});

test('work instruction contextual lists return an empty successful response', async () => {
  const originalExists = AssetModel.exists;
  const originalGet = instructionService.getInstructions;
  const assetId = '507f1f77bcf86cd799439010';
  const accountId = '507f1f77bcf86cd799439001';
  AssetModel.exists = async () => ({ _id: assetId });
  instructionService.getInstructions = async () => [];
  const response = responseRecorder();
  let nextError;
  try {
    await instructionController.getAll({
      user: { _id: '507f1f77bcf86cd799439002', account_id: accountId, user_role: 'admin' },
      query: { assetId }
    }, response, error => { nextError = error; });
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, []);
  } finally {
    AssetModel.exists = originalExists;
    instructionService.getInstructions = originalGet;
  }
});
