import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Execute complete production modules with isolated persistence/transport dependencies.
// No app/config imports, network, database, Redis, SMTP or real credentials.
const root = path.resolve(__dirname, '../../..');
const account = '64a000000000000000000001';
const actor = '64a000000000000000000002';
const other = '64a000000000000000000003';
const foreign = '64a000000000000000000004';
const permissionService: any = {
  isEffectivePermissionEnabled(menu: any, feature: string, action: string) {
    const entry = menu?.[feature];
    return entry?.view === true && (!entry.parent || menu?.[entry.parent]?.view === true) && (action === 'view' || entry[action] === true);
  },
  getAccountRoleMenu: () => ({}), toConfigurableRole: (r: any) => r,
  mergeConfigurablePlatformControl: (_old: any, update: any) => update
};
function load(relative: string, dependencies: Record<string, any> = {}): any {
  const filename = path.resolve(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports: any = {};
  vm.runInNewContext(compiled, {
    exports, Buffer, Date, console: { log() {}, warn() {}, error() {} },
    require(id: string) {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      if (id.endsWith('/userAuthorization') || id === './userAuthorization') return load('src/masters/user/userAuthorization.ts', { '../../_role/accountAccess.service': { accountAccessService: permissionService } });
      throw new Error(`Unstubbed dependency blocked: ${id}`);
    }
  }, { filename, timeout: 2000 });
  return exports;
}
function user(overrides: any = {}): any {
  return { _id: other, id: other, account_id: account, firstName: 'Synthetic', lastName: 'User', email: 'synthetic@example.invalid', username: 'synthetic', user_role: 'employee', user_status: 'active', isVerified: false, isFirstUser: false, createdBy: actor, ...overrides,
    toObject() { const { toObject, ...copy } = this; return copy; } };
}
const get = (o: any, key: string, fallback?: any) => o[key] ?? fallback;
function request(admin = false, body: any = {}, target = other): any {
  return { user: user({ _id: actor, id: actor, user_role: admin ? 'admin' : 'employee' }), companyID: account, body, params: { id: target }, query: {}, roleMenu: { master_admin_panel: { view: admin }, users: { parent: 'master_admin_panel', view: true, add: admin, edit: admin, delete: admin }, permission: { parent: 'master_admin_panel', view: true, add: admin, edit: admin, delete: admin } } };
}
async function invoke(fn: any, req: any) {
  let error: any; const res: any = { statusCode: 0, body: undefined, status(c: number) { this.statusCode = c; return this; }, json(v: any) { this.body = v; return this; }, clearCookie() {} };
  await fn(req, res, (e: any) => { error = e; });
  return { error, res };
}
function controllers(existing = user()) {
  const writes: any[] = [];
  const usersService: any = {
    getAllUsers: async (filter: any) => filter._id ? (String(filter._id) === String(existing._id) && (!filter.account_id || String(filter.account_id) === String(existing.account_id)) ? [existing] : []) : [],
    createNewUser: async (b: any) => { writes.push(b); return { userDetails: user({ ...b, password: 'synthetic-hash-must-not-leave-service' }), roleDetails: {} }; },
    updateUserDetails: async (_id: any, b: any) => { writes.push(b); return user({ ...existing.toObject(), ...b }); },
    removeById: async () => { writes.push('removed'); }
  };
  const controller = load('src/masters/user/user.controller.ts', {
    '../../_cache/controllerCache.service': { controllerCache: { withCache: (c: any) => c } }, lodash: { get }, './user.service': { usersService },
    '../../user/resetPassword/resetPassword.service': {}, '../../utils/bcrypt': {},
    '../../utils/roleFilter': { applyRoleFilter: async (o: any) => ({ ...o.baseFilter, account_id: o.user.account_id, ...(o.user.user_role === 'user' ? { createdBy: o.user._id } : {}) }) },
    '../../_config/mailer': { mailerService: { sendUserCreatedMail: async () => {} } }, '../../utils/helper': { helperService: { validateObjectId: (v: any) => v } },
    '../../utils/notification.service': { notificationService: { notifyAccountUsers: async () => {} } }, '../company/subscriptionLimit.service': { subscriptionLimitService: { assertCanCreate: async () => {} } },
    '../../user/verification/verification-challenge.service': {}, '../../user/authentication/authCookie.service': {}, '../../user/authentication/refreshToken.service': {},
    '../../_role/accountAccess.service': { accountAccessService: permissionService }
  }).userController;
  return { controller, writes };
}

test('ordinary user cannot create administrators or edit another user', async () => {
  const { controller, writes } = controllers();
  for (const [method, body] of [['createUser', { user_role: 'admin' }], ['updateUser', { firstName: 'Unauthorized' }], ['removeUser', {}]] as const) {
    const result = await invoke(controller[method], request(false, body));
    assert.equal(result.error?.status, 403); assert.equal(writes.length, 0);
  }
});
test('ordinary user can edit own profile even without user-management permissions or self-created ownership', async () => {
  const self = user({ _id: actor, id: actor, createdBy: other });
  const { controller, writes } = controllers(self);
  const req = request(false, { firstName: 'Updated', phone_no: { code: '+00', number: '000' }, isTourCompleted: true, user_role: 'employee', account_id: account, isFirstUser: false }, actor);
  req.user.user_role = 'user';
  // Equal immutable/role fields are accepted only when equal to the persisted self document.
  const result = await invoke(controller.updateUser, req);
  assert.equal(result.error, undefined); assert.equal(result.res.statusCode, 200);
  assert.equal(writes[0].firstName, 'Updated'); assert.equal(writes[0].isFirstUser, undefined); assert.equal(writes[0].account_id, undefined);
});
for (const body of [{ account_id: foreign }, { isFirstUser: true }, { password: 'chosen-password' }, { createdBy: foreign }, { updatedBy: foreign }, { 'account_id.value': foreign }, { $set: { isFirstUser: true } }]) {
  test(`generic admin update rejects reserved/operator write ${Object.keys(body)[0]}`, async () => {
    const { controller, writes } = controllers(); const result = await invoke(controller.updateUser, request(true, body));
    assert.equal(result.error?.status, 403); assert.equal(writes.length, 0);
  });
}
test('admin retains explicit same-tenant role, status and mark-verified management', async () => {
  const { controller, writes } = controllers();
  const result = await invoke(controller.updateUser, request(true, { firstName: 'Managed', user_role: 'manager', user_status: 'inactive', isVerified: true, account_id: account, isFirstUser: false, createdBy: actor }));
  assert.equal(result.error, undefined); assert.equal(result.res.statusCode, 200); assert.equal(writes[0].user_role, 'manager'); assert.equal(writes[0].isVerified, true); assert.equal(writes[0].user_status, 'inactive'); assert.equal(writes[0].account_id, undefined);
});
test('ordinary self profile cannot mark verified, promote role or disable self', async () => {
  for (const body of [{ isVerified: true }, { user_role: 'admin' }, { user_status: 'inactive' }]) {
    const { controller, writes } = controllers(user({ _id: actor, id: actor }));
    const result = await invoke(controller.updateUser, request(false, body, actor));
    assert.equal(result.error?.status, 403); assert.equal(writes.length, 0);
  }
});
test('admin create cannot grant first-user/verification flags; normal creation hides password hash', async () => {
  for (const body of [{ isFirstUser: true }, { isVerified: true }]) {
    const { controller, writes } = controllers(); const result = await invoke(controller.createUser, request(true, body));
    assert.equal(result.error?.status, 403); assert.equal(writes.length, 0);
  }
  const { controller, writes } = controllers();
  const result = await invoke(controller.createUser, request(true, { firstName: 'Created', username: 'unique-synthetic', email: 'new@example.invalid', password: 'creation-password', user_role: 'employee', phone_no: {} }));
  assert.equal(result.error, undefined); assert.equal(result.res.statusCode, 201); assert.equal(result.res.body.data.password, undefined); assert.equal(writes[0].isFirstUser, false); assert.equal(writes[0].isVerified, false);
});
test('account deletion rejects foreign IDs and ordinary users, allows same-account admin', async () => {
  const removed: any[] = [];
  const controller = load('src/masters/company/company.controller.ts', {
    '../../_cache/controllerCache.service': { controllerCache: { withCache: (v: any) => v } }, lodash: { get }, '../../models/user.model': { USER_ROLES: ['admin','employee'] },
    './company.service': { companyService: { removeById: async (...args: any[]) => { removed.push(args); return true; } } }, '../../utils/helper': { helperService: { validateObjectId: (v: any) => v } },
    '../../utils/roleFilter': {}, './accountFeature.service': { accountFeatureService: { clear() {} } }, './subscriptionLimit.service': {}
  }).companyController;
  for (const req of [request(true, {}, foreign), request(false, {}, account)]) {
    const result = await invoke(controller.removeCompany, req); assert.equal(result.error?.status, 403); assert.equal(removed.length, 0);
  }
  assert.equal((await invoke(controller.removeCompany, request(true, {}, account))).error, undefined); assert.equal(removed.length, 1);
});
test('non-admin log query cannot replace caller identity; admin can select another same-tenant user', async () => {
  let match: any;
  const controller = load('src/masters/user/logs/logs.controller.ts', { '../../../_cache/controllerCache.service': { controllerCache: { withCache: (v: any) => v } }, lodash: { get }, '../../../utils/helper': { helperService: { validateObjectId: (v: any) => v } }, './logs.service': { userLogsService: { getAllUserLogs: async (q: any) => { match=q; return [{}]; } } } }).userLogsController;
  const req = request(); req.query = { userId: other };
  assert.equal((await invoke(controller.userLogs, req)).error, undefined); assert.equal(match.userId, actor); assert.equal(match.account_id, account);
  const admin = request(true); admin.query = { userId: other };
  assert.equal((await invoke(controller.userLogs, admin)).error, undefined); assert.equal(match.userId, other); assert.equal(match.account_id, account);
});
test('role mutation requires explicit permission authority; authorized admin update still works', async () => {
  const writes: any[] = [];
  const controller = load('src/masters/user/role/roles.controller.ts', {
    './roles.service': { rolesService: { getRoles: async () => [{ data: {} }], updateById: async (...args: any[]) => { writes.push(args); return {}; }, removeById: async () => { writes.push('removed'); return {}; }, insertRole: async () => { writes.push('created'); return {}; } } },
    '../user.service': { usersService: { getAllUsers: async () => [user()] } }, lodash: { get }, '../../../utils/helper': { helperService: { validateObjectId: (v: any) => v } },
    '../../../_role/newUserRoles': { RoleManager: { getRoleMenuData: async () => ({}) } }, '../../company/company.service': { companyService: { verifyCompany: async () => ({}) } }, '../../../_role/accountAccess.service': { accountAccessService: permissionService }
  }).rolesController;
  for (const method of ['createRole','updateRole','removeRole']) {
    const result = await invoke(controller[method], request(false, { data: {} })); assert.equal(result.error?.status, 403); assert.equal(writes.length, 0);
  }
  assert.equal((await invoke(controller.updateRole, request(true, { data: { users: { edit: true } } }))).error, undefined); assert.equal(writes.length, 1);
});
function serviceFixture() {
  const revocations: any[] = []; let query: any;
  const active = user();
  const model = {
    findOne: (q: any) => { query=q; return { select: async () => q.user_status === 'active' && q.visible?.$ne === false ? null : { ...active, user_status: 'inactive' } }; },
    findOneAndUpdate: async (q: any, body: any) => { query=q; return user({ user_status: body.$set?.user_status || body.user_status || 'active' }); },
    findByIdAndUpdate: async (_id: any, body: any) => user({ user_status: body.user_status || 'active' })
  };
  const service = load('src/masters/user/user.service.ts', {
    '../../models/user.model': { UserModel: model }, '../../models/mapUserLocation.model': { MapUserAssetLocationModel: { deleteMany: async () => {} } }, '../../utils/bcrypt': {}, './role/roles.service': {}, '../../utils/helper': {}, '../../_config/mailer': {},
    '../../models/userToken.model': { TokenModel: { deleteMany: async (q: any) => { revocations.push(q); } } }, '../../_cache/session/tokenSessionStore': { tokenSessionStore: { deleteUserSessions: async (...args: any[]) => { revocations.push(args); } } },
    '../../user/verification/verification-challenge.service': {}, '../../user/authentication/password-expiry': {}, '../../_role/newUserRoles': {}, '../../models/userRoleMenu.model': {},
    '../../utils/transaction.helper': { withTransaction: async (fn: any) => fn(undefined) }, '../company/subscriptionLimit.service': {}
  }).usersService;
  return { service, revocations, query: () => query };
}
test('current-user lookup excludes inactive and hidden users', async () => {
  const { service, query } = serviceFixture();
  assert.equal(await service.verifyUserLogin({ id: actor, companyID: account, username: 'synthetic' }), null);
  assert.equal(query().user_status, 'active'); assert.equal(query().visible.$ne, false);
});
test('successful disable/delete revoke persisted and cached sessions; profile edit does not', async () => {
  const { service, revocations } = serviceFixture();
  await service.updateUserDetails(other, { firstName: 'Edited' }, account); assert.equal(revocations.length, 0);
  await service.updateUserDetails(other, { user_status: 'inactive' }, account); assert.equal(revocations.length, 2); assert.equal(revocations[0].account_id, undefined, 'global user identity must revoke legacy tokens without account_id');
  await service.removeById(other, account); assert.equal(revocations.length, 4);
});
