import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(__dirname, '../../..');
const account = '64a000000000000000000001';
const caller = '64a000000000000000000002';
const foreign = '64a000000000000000000003';
function load(relative: string, deps: Record<string, any>): any {
  const filename = path.resolve(root, relative); const exports: any = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
    exports, Buffer, Date, console: { log() {}, warn() {}, error() {} }, require(id: string) { if (Object.hasOwn(deps, id)) return deps[id]; throw new Error(`Unstubbed dependency blocked: ${id}`); }
  }, { filename, timeout: 2000 }); return exports;
}
async function invoke(fn: any, req: any) {
  let error: any; const res: any = { statusCode: 0, body: undefined, status(c: number) { this.statusCode=c; return this; }, json(v: any) { this.body=v; return this; }, clearCookie() {} };
  await fn(req,res,(e: any)=>{error=e;}); return {error,res};
}
function fixture(verified = true, firstUser = true) {
  const records: any[] = []; const queries: any[] = [];
  const user: any = { _id: caller, account_id: account, email: 'self@example.invalid', username: 'synthetic', user_status: 'active', user_role: 'admin', isVerified: verified, password: 'synthetic-credential-snapshot', toObject() { const {toObject,...copy}=this; return copy; } };
  const model = { findOne(q: any) {
    queries.push(q);
    const found = q.isFirstUser ? (firstUser ? user : null) : ((!q.email || q.email===user.email) && (!q._id || String(q._id)===caller) && (!q.account_id || String(q.account_id)===account) ? user : null);
    return { select: async()=>found, then(resolve: any,reject: any) { return Promise.resolve(found).then(resolve,reject); } };
  }};
  const controller = load('src/user/authentication/authentication.service.ts', {
    mongoose: { Types: { ObjectId: class { toString() { return '64a000000000000000000004'; } } } }, '../../models/user.model': {UserModel:model},
    '../../utils/bcrypt': {passwordService:{comparePassword:async()=>true}}, '../../_config/auth': {generateExternalAccessToken:()=> 'synthetic-encrypted-proof', generateAccessToken:()=> 'synthetic-access'},
    '../../models/userToken.model': {TokenModel:class {data: any; constructor(data: any){this.data=data;} async save(){records.push(this.data);}}},
    '../../masters/user/role/roles.service': {rolesService:{verifyUserRole:async()=>({data:{},roleMenu:{}})}}, '../resetPassword/resetPassword.service': {}, '../../configDB': {auth:{expiresIn:'1h'}},
    '../../utils/helper': {helperService:{validateObjectId:(v: any)=>v}}, '../../masters/company/company.service': {companyService:{getAllCompanies:async()=>[{cookie_status:'disabled'}]}}, lodash:{get:(o: any,k: string,f: any)=>o[k]??f},
    '../../transaction/mapUserLocation/userLocation.service': {mapUserToLocationService:{getLocationsMappedData:async()=>[{}]}}, '../../_cache/auth/tokenBlacklist':{},
    './refreshToken.service': {refreshTokenService:{issueForUser:async()=>({rawToken:'synthetic-refresh'})}}, '../../utils/ttl':{parseTtlSeconds:()=>3600},
    '../../_role/accountAccess.service':{accountAccessService:{getEffectivePermissions:()=>({platformControl:{},roleMenu:{}})}}, '../../_cache/session/tokenSessionStore':{tokenSessionStore:{setAccessSession:async()=>{}}},
    './authCookie.service':{clearAuthCookies(){},setAccessCookies(){}}, '../../masters/analysisFeature/analysisFeature.service':{analysisFeatureService:{getFeatureData:async()=>({})}}, './password-expiry':{passwordExpiryNotice:()=>({})}
  }); return {controller,records,queries,user};
}
test('external proof mint route requires authentication without changing legacy path or exchange',()=>{
  const routes: any[]=[]; const router: any={post(p: string,...h: any[]){routes.push(['post',p,h]);},get(p: string,...h: any[]){routes.push(['get',p,h]);},use(){}};
  const authenticated=()=>{}; const noop=()=>{};
  load('src/user/authentication/authentication.routes.ts', {express:{Router:()=>router},'../authentication/authentication.controller':{externalToken:noop,authenticationByToken:noop},'../../_config/auth':{isAuthenticated:authenticated,verifyEncryptedToken:noop},'../../middlewares/rateLimits':{rateLimiter:{}},'../../middlewares/passwordExpire':{}}).default(router);
  assert.ok(routes.find(r=>r[1]==='/create_external_token/:email')[2].includes(authenticated));
  assert.ok(routes.find(r=>r[1]==='/external_auth'));
});
test('mint rejects absent identity, foreign account/user and a different email',async()=>{
  for(const req of [
    {params:{email:'self@example.invalid'}},
    {params:{email:'self@example.invalid'},user:{_id:foreign,account_id:account},companyID:account},
    {params:{email:'self@example.invalid'},user:{_id:caller,account_id:foreign},companyID:foreign},
    {params:{email:'other@example.invalid'},user:{_id:caller,account_id:account},companyID:account}
  ]){
    const {controller,records}=fixture(); const {error}=await invoke(controller.createAuthenticationByToken,req);
    assert.ok(error && [401,403,404].includes(error.status)); assert.equal(records.length,0);
  }
});
test('authenticated self can mint only the matching own-account email proof',async()=>{
  const {controller,records,queries}=fixture();
  const {error,res}=await invoke(controller.createAuthenticationByToken,{params:{email:'SELF@example.invalid'},user:{_id:caller,account_id:account},companyID:account});
  assert.equal(error,undefined); assert.equal(res.statusCode,200); assert.equal(res.body.data.external_token,'synthetic-encrypted-proof'); assert.equal(records.length,1);
  assert.equal(String(queries[0]._id),caller); assert.equal(String(queries[0].account_id),account);
});
test('alternate password authentication rejects unverified users and inactive-first-user account lock',async()=>{
  for(const [verified,firstUser] of [[false,true],[true,false]]){
    const {controller,records}=fixture(verified,firstUser);const {error}=await invoke(controller.userAuthenticationToken,{body:{username:'synthetic',password:'correct-synthetic-password'},headers:{}});
    assert.ok(error && [401,403].includes(error.status));assert.equal(records.length,0);
  }
});
test('eligible verified user retains alternate password authentication',async()=>{
  const {controller,records}=fixture(); const {error,res}=await invoke(controller.userAuthenticationToken,{body:{username:'synthetic',password:'correct-synthetic-password'},headers:{}});
  assert.equal(error,undefined);assert.equal(res.statusCode,200);assert.equal(res.body.data.token,'synthetic-access');assert.equal(records.length,1);
});
