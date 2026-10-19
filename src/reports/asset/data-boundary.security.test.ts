import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { isUploadOwnedBy } from '../../utils/upload-ownership';
import { UserModel } from '../../models/user.model';
import { Types } from 'mongoose';

// Execute complete source modules with only I/O collaborators replaced. Never start the app.
const repo = path.resolve(__dirname, '../../..');
const account = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const foreignAccount = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const id = '111111111111111111111111';
const uid = '222222222222222222222222';
const admin = { _id: uid, account_id: account, user_role: 'admin' };
const employee = { ...admin, user_role: 'employee' };
const get = (obj: any, key: string, fallback?: any) => key.split('.').reduce((value, part) => value?.[part], obj) ?? fallback;
const helperService = { validateObjectId: String, validateObjectIds: (v: any) => String(v).split(',') };
const controllerCache = { withCache: (x: any) => x };
function load(file: string, symbol: string, deps: Record<string, any> = {}): any {
  const source = fs.readFileSync(path.join(repo, file), 'utf8').replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/\bexport\s+(?=(?:class|const|function|interface|type)\b)/g, '').replace('export default ', 'const registerRoutes = ');
  const injected = { console: { log() {}, warn() {}, error() {} }, ...deps };
  return Function(...Object.keys(injected), '__dirname', stripTypeScriptTypes(source, { mode: 'strip' }) + `\nreturn ${symbol};`)(...Object.values(injected), path.dirname(path.join(repo, file)));
}
function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: [string, any]) => {
    if (key === '$and') return value.every((part: any) => matches(row, part));
    if (key === '$or') return value.some((part: any) => matches(row, part));
    if (value && typeof value === 'object' && '$in' in value) return value.$in.some((v: any) => String(v) === String(row[key]));
    if (value && typeof value === 'object' && '$exists' in value) return (row[key] !== undefined) === value.$exists;
    return String(row[key]) === String(value);
  });
}
function chain(value: any): any {
  return { select() { return this; }, lean() { return this; }, session() { return this; }, sort() { return this; }, populate() { return this; }, then(resolve: any, reject: any) { return Promise.resolve(value).then(resolve, reject); } };
}
function response(): any { return { headers: {}, statusCode: 200, status(n: number) { this.statusCode = n; return this; }, json(v: any) { this.body = v; return this; }, send(v: any) { this.body = v; return this; }, setHeader(k: string, v: any) { this.headers[k] = v; } }; }
const next = (error?: any) => { if (error) throw error; };
function roleFilter(assetIds: string[] = [], locationIds: string[] = []): any {
  return load('src/utils/roleFilter.ts', 'applyRoleFilter', {
    mapUserToAssetService: { getAssetsMappedData: async () => assetIds.map(assetId => ({ assetId })) },
    mapUserToLocationService: { getLocationsMappedData: async () => locationIds.map(locationId => ({ locationId })) }
  });
}

test('explicit IDs intersect mapping scope and retain requested predicates; mapped/admin reads remain valid', async () => {
  const filter = roleFilter([id]);
  const denied = await filter({ user: employee, mapping: 'asset', baseFilter: { _id: uid, asset_type: 'Motor' } });
  assert.equal(matches({ _id: uid, account_id: account, visible: true, asset_type: 'Motor' }, denied), false);
  const allowed = await filter({ user: employee, mapping: 'asset', baseFilter: { _id: id, asset_type: 'Motor' } });
  assert.equal(matches({ _id: id, account_id: account, visible: true, asset_type: 'Motor' }, allowed), true);
  assert.equal(matches({ _id: id, account_id: account, visible: true, asset_type: 'Fan' }, allowed), false);
  const adminFilter = await filter({ user: admin, mapping: 'asset', baseFilter: { _id: uid } });
  assert.equal(matches({ _id: uid, account_id: account, visible: true }, adminFilter), true);
});

function reportController(rows: any[]): any {
  const service = { getAccessFilter: (user:any,baseFilter:any)=>roleFilter()({user,baseFilter,accountField:'accountId',mapping:'asset',idField:'assetId'}), getAllAssetReports: async (q: any) => rows.filter(r => matches(r, q)) };
  return load('src/reports/asset/asset.controller.ts', 'assetReportController', {
    controllerCache, get, helperService, applyRoleFilter: roleFilter(), assetReportService: service,
    ASSET_REPORT_STATUS: ['Open', 'On-Hold', 'In-Progress', 'Completed'], observationService: {}, processorAPIService: {},
    PdfService: class { async generateAssetReportPdf() { return Buffer.from('SYNTHETIC PDF'); } }, storageConfig: { baseUrl: 'https://uploads.example.invalid' }
  });
}
test('PDF lookup rejects a foreign report and still renders caller report', async () => {
  const controller = reportController([{ _id: id, accountId: foreignAccount, visible: true, files: [] }]);
  const req = { user: admin, params: { id }, body: {}, is: () => false };
  await assert.rejects(controller.generateAssetReportPdf(req, response(), next), /not found|unavailable/i);
  const own = reportController([{ _id: id, accountId: account, visible: true, files: [] }]);
  const res = response(); await own.generateAssetReportPdf(req, res, next); assert.ok(Buffer.isBuffer(res.body));
});

function reportService(row: any): { service: any; writes: any[] } {
  const writes: any[] = [];
  const model = {
    findOne: (q: any) => chain(matches(row, q) ? row : null), findById: () => chain(row),
    findByIdAndUpdate: async (_id: any, body: any) => { writes.push(body); return { ...row, ...body }; },
    findOneAndUpdate: async (q: any, body: any) => { if (!matches(row, q)) return null; writes.push(body); return { ...row, ...body }; }
  };
  const scopedModel = { exists: async (q: any) => matches({ _id: id, account_id: account, visible: true }, q) ? { _id: id } : null };
  const service = load('src/reports/asset/asset.service.ts', 'assetReportService', {
    ReportAssetModel: model, orderService: {}, AssetModel: scopedModel, LocationModel: scopedModel, WorkOrderModel: scopedModel, ObservationModel: scopedModel,
    applyRoleFilter: roleFilter([id], [id]), helperService
  });
  return { service, writes };
}
test('report update rejects foreign tenant before write and preserves immutable account/creator', async () => {
  const foreign = reportService({ _id: id, accountId: foreignAccount, visible: true });
  assert.equal(await foreign.service.updateAssetReport(id, { Observations: 'changed' }, account, uid, '', admin), null);
  assert.equal(foreign.writes.length, 0);
  const own = reportService({ _id: id, accountId: account, createdBy: uid, userId: uid, visible: true });
  const updated = await own.service.updateAssetReport(id, { Observations: 'changed', accountId: foreignAccount, createdBy: id, userId: id }, account, uid, '', admin);
  assert.equal(updated.accountId, account); assert.equal(updated.createdBy, uid); assert.equal(updated.userId, uid);
  assert.equal(updated.Observations, 'changed');
});
test('report rejects foreign asset reference before mutation', async () => {
  const own = reportService({ _id: id, accountId: account, visible: true });
  await assert.rejects(own.service.updateAssetReport(id, { assetId: uid }, account, uid, '', admin), /unavailable|scope|not found/i);
  assert.equal(own.writes.length, 0);
});
test('mapped reports without optional assetId remain accessible through their mapped root asset',async()=>{
  const h=reportService({_id:id,accountId:account,top_level_asset_id:id,visible:true});
  const filter=await h.service.accessFilter(id,employee);
  assert.equal(matches({_id:id,accountId:account,top_level_asset_id:id,visible:true},filter),true);
  assert.equal(matches({_id:id,accountId:account,assetId:null,top_level_asset_id:id,visible:true},filter),true);
  assert.equal(matches({_id:id,accountId:account,assetId:uid,top_level_asset_id:id,visible:true},filter),false);
  assert.equal(matches({_id:id,accountId:foreignAccount,top_level_asset_id:id,visible:true},filter),false);
  const creatorFilter=await h.service.accessFilter(id,{...employee,user_role:'user'});
  assert.equal(matches({_id:id,accountId:account,top_level_asset_id:id,createdBy:uid,visible:true},creatorFilter),true);
  assert.equal(matches({_id:id,accountId:account,top_level_asset_id:id,createdBy:id,visible:true},creatorFilter),false);
});

function mapController(kind: 'asset' | 'location', userRows: any[], resourceRows: any[]): {controller:any; writes:any[]; read:any[]} {
  const writes: any[] = []; const read: any[] = [];
  const UserModel = { countDocuments: async (q: any) => userRows.filter(r => matches(r,q)).length, find:(q:any)=>chain(userRows.filter(r=>matches(r,q))) };
  const ResourceModel = { find: (q: any) => chain(resourceRows.filter(r => matches(r,q))), exists: async (q: any) => resourceRows.find(r=>matches(r,q)) || null, countDocuments: async (q: any) => resourceRows.filter(r=>matches(r,q)).length };
  const service = { createMapUserAssets: async (...args:any[]) => {writes.push(args);}, updateUserMapping: async (...args:any[])=>{writes.push(args);}, mapUserLocations: async (...args:any[])=>{writes.push(args);return [{}];}, userAssets: async(q:any)=>{read.push(q);return [{}];}, userLocations: async(q:any)=>{read.push(q);return [{}];}, updateMappedUserFlags: async(...args:any[])=>{writes.push(args);} };
  const controller = load(`src/transaction/mapUser${kind==='asset'?'Asset/userAsset':'Location/userLocation'}.controller.ts`, kind==='asset'?'userAssetController':'userLocationController', {
    controllerCache,get,helperService,UserModel,AssetModel:ResourceModel,LocationModel:ResourceModel,
    mapUserToAssetService:service,mapUserToLocationService:service,locationService:{getLocationsList:async(q:any)=>resourceRows.filter(r=>matches(r,q))},applyRoleFilter:roleFilter([id],[id])
  });
  return {controller,writes,read};
}
test('mapping reads always bind account and nonadmin user; mixed location lists stay scoped', async () => {
  const own = { _id:id, account_id:account,visible:true };
  for (const kind of ['asset','location'] as const) {
    const h=mapController(kind,[],[own]);
    await h.controller[kind==='asset'?'getUserAssets':'getUserLocations']({user:employee,query:{}},response(),next);
    assert.equal(matches({account_id:foreignAccount,userId:uid,locationId:id,assetId:id},h.read[0]),false);
    assert.equal(matches({account_id:account,userId:id,locationId:id,assetId:id},h.read[0]),false);
    assert.equal(matches({account_id:account,userId:uid,locationId:id,assetId:id},h.read[0]),true);
    assert.equal(matches({userId:uid,locationId:id,assetId:id},h.read[0]),true,'legacy row is allowed only through owned reference IDs');
    assert.equal(matches({userId:uid,locationId:uid,assetId:uid},h.read[0]),false);
  }
});
test('mapping writes reject foreign references before side effects and permit same-account pairs', async () => {
  for(const kind of ['asset','location'] as const) {
    const method=kind==='asset'?'setUserAssets':'setUserLocations'; const ref=kind==='asset'?'assetId':'locationId';
    assert.equal(UserModel.schema.path('visible'),undefined);
    const ownUser={_id:uid,account_id:account,user_status:'active'};
    const h=mapController(kind,[ownUser],[{_id:id,account_id:foreignAccount,visible:true}]);
    await assert.rejects(h.controller[method]({user:admin,body:[{[ref]:id,userId:uid}]},response(),next),/scope|unavailable|not found/i);
    assert.equal(h.writes.length,0);
    const valid=mapController(kind,[ownUser],[{_id:id,account_id:account,visible:true}]);
    await valid.controller[method]({user:admin,body:[{[ref]:id,userId:uid}]},response(),next);
    assert.equal(valid.writes.length,1);
  }
});
test('admin mapping lists prove both legacy references belong to account',async()=>{
  const users=[{_id:uid,account_id:account,user_status:'active'},{_id:id,account_id:foreignAccount,user_status:'active'}];
  const resources=[{_id:id,account_id:account,visible:true},{_id:uid,account_id:foreignAccount,visible:true}];
  for(const kind of ['asset','location'] as const){
    const h=mapController(kind,users,resources);
    await h.controller[kind==='asset'?'getUserAssets':'getUserLocations']({user:admin,query:{}},response(),next);
    const ref=kind==='asset'?'assetId':'locationId';
    assert.equal(matches({[ref]:id,userId:uid},h.read[0]),true);
    assert.equal(matches({[ref]:uid,userId:uid},h.read[0]),false);
    assert.equal(matches({[ref]:id,userId:id},h.read[0]),false);
  }
});
test('mapping mutation routes enforce existing management permission, including alternate methods',()=>{
  const express=require('express');
  const hasRolePermission=load('src/middlewares/permission.ts','hasRolePermission',{get,USER_ROLES:['admin','manager','employee','customer','user'],accountAccessService:{}});
  const noop=(_req:any,_res:any,done:any)=>done();
  const handlers=new Proxy({}, {get:()=>noop});
  for(const kind of ['asset','location'] as const){
    const register=load(`src/transaction/mapUser${kind==='asset'?'Asset/userAsset':'Location/userLocation'}.routes.ts`,'registerRoutes',{
      express,hasRolePermission,userAssetController:handlers,userLocationController:handlers,
      userAssetValidator:[],userAssetUpdateValidator:[],userLocationValidator:[],userLocationUpdateValidator:[],validate:noop,validateParam:()=>noop
    });
    const router=express.Router();register(router);
    for(const layer of router.stack.filter((item:any)=>item.route&&!item.route.methods.get&&item.route.path!=='/updateAssetsFlags')){
      let denied:any;layer.route.stack[0].handle({user:employee,role:{}},response(),(error:any)=>{denied=error;});assert.equal(denied?.status,403);
      let allowed=false;layer.route.stack[0].handle({user:admin,role:{[kind]:{[`edit_${kind}`]:true}}},response(),(error:any)=>{assert.equal(error,undefined);allowed=true;});assert.equal(allowed,true);
    }
  }
});

test('mapping flags cannot mutate another tenant or another ordinary user',async()=>{
  const rows=[{_id:id,account_id:foreignAccount,userId:uid,assetId:id,sendMail:true},{_id:uid,account_id:account,userId:uid,assetId:id,sendMail:true}];
  const model={find:(q:any)=>chain(rows.filter(r=>matches(r,q))),bulkWrite:async(ops:any[])=>{for(const op of ops){const row=rows.find(r=>matches(r,op.updateOne.filter));if(row)Object.assign(row,op.updateOne.update.$set);}return{};}};
  const service=load('src/transaction/mapUserAsset/userAsset.service.ts','mapUserToAssetService',{MapUserAssetLocationModel:model,LocationModel:{},AssetModel:{find:()=>chain([{_id:id,account_id:account}])},UserModel:{},helperService});
  await service.updateMappedUserFlags([{_id:id,sendMail:false,alert:false,danger:false,critical:false},{_id:uid,sendMail:false,alert:false,danger:false,critical:false}],employee);
  assert.equal(rows[0].sendMail,true);assert.equal(rows[1].sendMail,false);
});
test('legacy mapping flags use authoritative asset ownership and preserve self settings',async()=>{
  const rows:any[]=[{_id:id,userId:uid,assetId:id,sendMail:true},{_id:uid,userId:uid,assetId:uid,sendMail:true}];
  const model={find:(q:any)=>chain(rows.filter(r=>matches(r,q))),bulkWrite:async(ops:any[])=>{for(const op of ops){const row=rows.find(r=>matches(r,op.updateOne.filter));if(row)Object.assign(row,op.updateOne.update.$set);}return{};}};
  const service=load('src/transaction/mapUserAsset/userAsset.service.ts','mapUserToAssetService',{MapUserAssetLocationModel:model,LocationModel:{},AssetModel:{find:()=>chain([{_id:id,account_id:account}])},UserModel:{},helperService});
  await service.updateMappedUserFlags(rows.map(row=>({_id:row._id,sendMail:false,alert:false,danger:false,critical:false})),employee);
  assert.equal(rows[0].sendMail,false);assert.equal(rows[1].sendMail,true);
});
test('internal asset mapping inserts derive account from both authoritative references',async()=>{
  let written:any[]=[];
  const service=load('src/transaction/mapUserAsset/userAsset.service.ts','mapUserToAssetService',{
    MapUserAssetLocationModel:{insertMany:async(rows:any[])=>{written=rows;return rows;}},
    AssetModel:{find:()=>chain([{_id:id,account_id:account}])},UserModel:{find:(query:any)=>chain(matches({_id:uid,account_id:account,user_status:'inactive'},query)?[{_id:uid,account_id:account}]:[])},LocationModel:{},helperService
  });
  await service.createMapUserAssets([{assetId:id,userId:uid}]);assert.equal(written[0].account_id,account);
  await assert.rejects(service.createMapUserAssets([{assetId:id,userId:uid,account_id:foreignAccount}]),/scope|unavailable|account/i);
});
test('retaining a mapped ObjectId user neither duplicates nor removes that assignment',async()=>{
  const rows:any[]=[{_id:id,assetId:id,userId:uid,account_id:account}];
  const model={find:(q:any)=>chain(rows.filter(row=>matches(row,q))),insertMany:async(items:any[])=>{rows.push(...items);return items;},deleteMany:async(q:any)=>{for(let i=rows.length-1;i>=0;i--)if(matches(rows[i],q))rows.splice(i,1);return{};}};
  const service=load('src/transaction/mapUserAsset/userAsset.service.ts','mapUserToAssetService',{
    MapUserAssetLocationModel:model,AssetModel:{find:(q:any)=>chain(q.parent_id?[]:[{_id:id,account_id:account,visible:true}])},
    UserModel:{find:()=>chain([{_id:uid,account_id:account,user_status:'active'}])},LocationModel:{},helperService
  });
  await service.updateUserMapping(id,[new Types.ObjectId(uid)],[],[],undefined,account);
  assert.equal(rows.length,1);assert.equal(rows[0]._id,id);assert.equal(rows[0].userId,uid);
});

function ordersHarness(owner=account, creator=uid): {service:any;writes:any[];inventory:any[]} {
  const writes:any[]=[];
  const inventory:any[]=[];
  const row:any={_id:id,account_id:owner,createdBy:creator,title:'Original',status:'Open',visible:true,toObject(){const{toObject,...value}=this;return value;}};
  const model={collection:{name:'orders'},findById:()=>chain(row),findOne:(q:any)=>chain(matches(row,q)?row:null),findOneAndUpdate:async(q:any,body:any)=>{if(!matches(row,q))return null;writes.push({q,body});return {...row,...body};}};
  const resource={collection:{name:'resource'},exists:async(q:any)=>matches({_id:id,account_id:account,visible:true},q)?{_id:id}:null,countDocuments:async(q:any)=>matches({_id:id,account_id:account,visible:true},q)?1:0};
  const service=load('src/work/order/order.service.ts','orderService',{
    MailerService:class{},withTransaction:async(cb:any)=>cb({}),assertSyncVersion:()=>{},WorkOrderModel:model,
    notificationService:{notifyAccountUsers:async()=>{}},helperService,applyRoleFilter:roleFilter([id],[id]),
    mongoose:{},UserModel:{collection:{name:'users'},countDocuments:async(q:any)=>matches({_id:uid,account_id:account,user_status:'active'},q)?1:0},userWorkOrderService:{getMappedWorkOrderIDs:async()=>[],updateMappedUsers:async()=>{}},partsService:{normalizeWorkOrderParts:(parts:any)=>parts,validateInventoryByWorkOrder:async(old:any)=>{inventory.push(old);},adjustInventoryByWorkOrder:async(old:any)=>{inventory.push(old);return {warnings:[]};}},commentService:{},requestService:{},ProcedureModel:resource,WorkOrderAssigneeModel:resource,workOrderActivityService:{},WorkRequestModel:resource,SchedulerModel:resource,AssetModel:resource,InventoryMovementModel:resource,LocationModel:resource,PartsModel:resource,PartsTypeModel:resource,SOPsModel:resource,ReportAssetModel:resource,createSyncConflict:()=>Error('conflict')
  });
  service.getChildOrderCount=async()=>0;service.normalizeNatureOfWorkPayload=(x:any)=>x;service.normalizeTimingFields=(x:any)=>x;
  service.syncStatusDetailAuditFields=(x:any)=>x;service.syncCompletionAuditFields=(x:any)=>x;service.logWorkOrderUpdateActivities=async()=>{};
  service.getAllOrders=async()=>[];
  service.getAssignedUserIdsForWorkOrder=async()=>[];
  return {service,writes,inventory};
}
test('work-order update refuses foreign object before side effects; legitimate update preserves account and creator',async()=>{
  const foreign=ordersHarness(foreignAccount);
  await assert.rejects(foreign.service.updateById(id,{title:'Changed'},admin),/not found|unavailable/i);
  assert.equal(foreign.writes.length,0);
  const own=ordersHarness();
  await own.service.updateById(id,{title:'Changed',account_id:foreignAccount,createdBy:id},admin);
  assert.equal(own.writes.length,1);assert.equal(own.writes[0].body.account_id,account);assert.equal(own.writes[0].body.createdBy,uid);
});
test('work-order cross references are rejected before mutation',async()=>{
  const own=ordersHarness();
  await assert.rejects(own.service.updateById(id,{wo_asset_id:uid},admin),/not found|unavailable|scope/i);
  assert.equal(own.writes.length,0);
});
test('work-order update honors creator/assignee scope and accepts active assignees from actual user schema',async()=>{
  const outside=ordersHarness(account,id);
  await assert.rejects(outside.service.updateById(id,{title:'Changed'},employee),/not found|unavailable/i);assert.equal(outside.writes.length,0);
  const own=ordersHarness();await own.service.updateById(id,{userIdList:[uid]},admin);assert.equal(own.writes.length,1);
});
test('work-order SOP references reject foreign templates while retaining own template links',async()=>{
  const denied=ordersHarness();await assert.rejects(denied.service.updateById(id,{sop_form_id:uid},admin),/scope|unavailable|not found/i);assert.equal(denied.writes.length,0);
  const own=ordersHarness();await own.service.updateById(id,{sop_form_id:id},admin);assert.equal(own.writes[0].body.sop_form_id,id);
});
test('legacy work-order SOP joins require both referenced ID and record account',()=>{
  const {service}=ordersHarness();
  const lookup=service.getWorkOrderPipeline({account_id:account}).find((stage:any)=>stage.$lookup?.as==='sopForm').$lookup;
  const evaluate=(expr:any,row:any):any=>{
    if(typeof expr==='string')return expr==='$$recordAccount'?account:expr==='$$sop_form_id'?id:expr.startsWith('$')?row[expr.slice(1)]:expr;
    if(Array.isArray(expr))return expr.map(item=>evaluate(item,row));
    if(expr&&typeof expr==='object'){
      if(expr.$and)return expr.$and.every((item:any)=>evaluate(item,row));
      if(expr.$eq){const [a,b]=evaluate(expr.$eq,row);return String(a)===String(b);}
      if(expr.$cond)return evaluate(expr.$cond[0],row)?evaluate(expr.$cond[1],row):evaluate(expr.$cond[2],row);
      if(expr.$type)return 'objectId';
      if(expr.$toObjectId)return evaluate(expr.$toObjectId,row);
    }
    return expr;
  };
  const expr=lookup.pipeline[0].$match.$expr;
  assert.equal(evaluate(expr,{_id:id,account_id:foreignAccount}),false);
  assert.equal(evaluate(expr,{_id:id,account_id:account}),true);
});
test('work-order inventory deltas use persisted prior parts and ignore client oldParts',async()=>{
  const own=ordersHarness();
  await own.service.updateById(id,{parts:[],oldParts:[{part_id:uid,estimatedQuantity:1}]},admin);
  assert.deepEqual(own.inventory,[[],[]]);
});
test('inventory adjustment rejects foreign legacy part references and still adjusts own stock',async()=>{
  let saved=0;const row:any={_id:id,account_id:foreignAccount,visible:true,part_name:'Synthetic',quantity:5,save:async()=>{saved++;}};
  const partModel={findById:()=>chain(row),findOne:(q:any)=>chain(matches(row,q)?row:null)};
  const service=load('src/masters/part/parts.service.ts','partsService',{
    PartsModel:partModel,PartsTypeModel:{},PartHistoryModel:{},InventoryMovementModel:{insertMany:async()=>[]},CycleCountModel:{},withTransaction:async(cb:any)=>cb({}),helperService,
    mongoose:{Types},assertSyncVersion:()=>{},createSyncConflict:()=>Error('conflict')
  });
  service.createInventoryMovementEntries=async()=>{};service.createPartHistoryEntry=async()=>{};
  const old=[{part_id:id,estimatedQuantity:1,reservedQuantity:1}];
  await assert.rejects(service.adjustInventoryByWorkOrder(old,[],admin,{}, {account_id:account,previous_status:'Open',next_status:'Open'}),/unavailable|scope|not found/i);
  assert.equal(saved,0);assert.equal(row.quantity,5);
  row.account_id=account;
  await service.adjustInventoryByWorkOrder(old,[],admin,{}, {account_id:account,previous_status:'Open',next_status:'Open'});
  assert.equal(saved,1);assert.equal(row.quantity,6);
});
test('work-order part-type references and legacy lookup reject foreign types and preserve own types',async()=>{
  const denied=ordersHarness();
  await assert.rejects(denied.service.updateById(id,{parts:[{part_id:id,part_type:uid,estimatedQuantity:1}]},admin),/scope|unavailable|not found/i);
  assert.equal(denied.writes.length,0);
  const own=ordersHarness();await own.service.updateById(id,{parts:[{part_id:id,part_type:id,estimatedQuantity:1}]},admin);assert.equal(own.writes.length,1);
  const lookup=own.service.getWorkOrderPipeline({account_id:account}).find((stage:any)=>stage.$lookup?.as==='partTypeDetails').$lookup;
  const evaluate=(expr:any,owner:string):boolean=>{
    if(expr.$and)return expr.$and.every((item:any)=>evaluate(item,owner));
    if(expr.$eq)return expr.$eq[0]==='$account_id'&&expr.$eq[1]==='$$recordAccount'?owner===account:false;
    return !!expr.$in;
  };
  assert.equal(evaluate(lookup.pipeline[0].$match.$expr,foreignAccount),false);
  assert.equal(evaluate(lookup.pipeline[0].$match.$expr,account),true);
});

function pdfService(extra: any = {}): any {
  return load('src/reports/asset/asset-pdf.service.ts','PdfService',{
    fs,path,storageConfig:{baseUrl:'https://uploads.example.invalid'},processorAPIService:{},puppeteer:{},
    isUploadOwnedBy,...extra
  });
}
test('PDF text and labels cannot replace scripts or inject HTML; JSON cannot close its script',()=>{
  const Pdf=pdfService();const pdf=new Pdf();
  const attack='</script><script>globalThis.INJECTED=1</script><img src="https://example.invalid">';
  const html=pdf.buildHtml({labels:{echartsScript:'globalThis.OVERRIDE=1',assetName:attack,assetNameLabel:attack},assetName:attack,assetCondition:attack,observations:attack,readings:[],healthHistory:[],faultData:[{name:attack,value:1}],attachments:[],chartData:{x:attack}});
  assert.equal(html.includes('<script>globalThis.INJECTED=1</script>'),false);
  assert.equal(html.includes('globalThis.OVERRIDE=1'),false);
  assert.ok(html.includes('&lt;script&gt;'));
  const chart=html.match(/<script id="chart-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(chart);assert.equal(JSON.parse(chart[1]).x,attack);
});
test('PDF local files require real containment, regular image signature, size, and matching owner',()=>{
  const Pdf=pdfService();const pdf=new Pdf();
  const root=path.join(repo,'uploadFiles');fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'security-test-'));const outside=fs.mkdtempSync('/tmp/cmms-pdf-test-');
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('SYNTHETIC IMAGE')]);
  const owned=path.join(dir,`20261019-123456789-assets-${account}-a1b2c3d4.png`);
  const foreign=path.join(dir,`20261019-123456789-assets-${foreignAccount}-a1b2c3d4.png`);
  const fake=path.join(dir,`20261019-123456789-assets-${account}-a1b2c3d5.png`);
  try{
    fs.writeFileSync(owned,png);fs.writeFileSync(foreign,png);fs.writeFileSync(fake,'SYNTHETIC TEXT');
    const outsideFile=path.join(outside,path.basename(owned));fs.writeFileSync(outsideFile,png);
    fs.symlinkSync(outsideFile,path.join(dir,'escape.png'));
    assert.equal(pdf.toBase64(outsideFile,account),'');
    assert.equal(pdf.toBase64(path.join(dir,'escape.png'),account),'');
    assert.equal(pdf.toBase64(foreign,account),'');
    assert.equal(pdf.toBase64(fake,account),'');
    assert.equal(pdf.toBase64(dir,account),'');
    assert.ok(pdf.toBase64(owned,account).startsWith('data:image/png;base64,'));
  }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});}
});
test('PDF browser rejects outbound/file requests and permits embedded chart/image resources',async()=>{
  let handler:any;let interception=false;let html='';
  const page={on:(name:string,cb:any)=>{if(name==='request')handler=cb;},setRequestInterception:async(value:boolean)=>{interception=value;},setUserAgent:async()=>{},setContent:async(value:string)=>{html=value;},waitForFunction:async()=>{},evaluate:async()=>null,pdf:async()=>Buffer.from('PDF')};
  const Pdf=pdfService({puppeteer:{launch:async()=>({newPage:async()=>page,close:async()=>{}})}});
  await new Pdf().generateAssetReportPdf({labels:{},readings:[],healthHistory:[],faultData:[],attachments:[],chartData:{ok:[]},accountId:account});
  assert.equal(interception,true);assert.equal(typeof handler,'function');assert.ok(html.includes('chart-data'));
  for(const url of ['http://127.0.0.1/private','https://example.invalid','file:///tmp/private','data:text/html,<script>1</script>']){
    let aborted=false;handler({url:()=>url,abort:()=>{aborted=true;},continue:()=>{}});assert.equal(aborted,true,url);
  }
  let continued=false;handler({url:()=> 'data:image/png;base64,iVBORw0KGgo=',abort:()=>{},continue:()=>{continued=true;}});assert.equal(continued,true);
});
test('PDF template inserts error labels as text rather than HTML',async()=>{
  const template=fs.readFileSync(path.join(repo,'src/public/asset-report.html'),'utf8');
  const script=[...template.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)![1];
  let callback:any;let unsafe=false;const children:any[]=[];
  const root:any={replaceChildren:(...nodes:any[])=>{children.splice(0,children.length,...nodes);},appendChild:(node:any)=>children.push(node)};
  Object.defineProperty(root,'innerHTML',{set(){unsafe=true;}});
  const label='<img src=x onerror=INJECTED()>';
  const document={createElement:()=>({className:'',textContent:''}),getElementById:(key:string)=>key==='charts-root'?root:{textContent:key==='frontend-chart-images'?'false':key==='labels-data'?JSON.stringify({noChartDataLabel:label}):key==='readings-data'?'[]':'{}'}};
  vm.runInNewContext(script,{document,window:{addEventListener:(_name:string,cb:any)=>{callback=cb;}},console:{log(){},error(){}},requestAnimationFrame:(cb:any)=>cb()});
  await callback();assert.equal(unsafe,false);assert.equal(children[0].textContent,label);
});
