import express, { NextFunction, Request, Response } from 'express';
import axios from 'axios';
import { get } from 'lodash';
import { Types } from 'mongoose';
import { hasRolePermission, hasAccountFeature } from '@common/middlewares';
import { applyRoleFilter } from '@common/utils/role-filter.helper';
import { AssetModel } from '@modules/assets';
import { IUser } from '@modules/users';

const fail = (message: string, status: number): Error => Object.assign(new Error(message), { status });
const principal = (req: Request): IUser => get(req, 'user') as unknown as IUser;

export async function callOpcuaProcessor(org: string, path: string, method = 'GET', data?: unknown, params?: unknown): Promise<any> {
  const base = process.env.OPCUA_PROCESSOR_URL || process.env.PROCESSOR_API_URL;
  const secret = process.env.OPCUA_GATEWAY_SECRET;
  if (!base) throw fail('OPC-UA mapping service URL is missing. Configure OPCUA_PROCESSOR_URL in Express.', 503);
  if (!secret) throw fail('OPC-UA gateway authentication is missing. Configure OPCUA_GATEWAY_SECRET in Express and Django.', 503);
  try {
    const result = await axios.request({
      url: `${base.replace(/\/+$/, '')}/internal/opcua/mappings/${path}`,
      method, data, params, timeout: 15000, maxRedirects: 0,
      headers: { 'X-Opcua-Gateway-Key': secret, 'X-Opcua-Org': org, 'Content-Type': 'application/json' },
    });
    return result.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const code = error.response?.status;
      const detail = error.response?.data?.detail;
      if (code && [400, 404, 409].includes(code)) {
        throw fail(typeof detail === 'string' ? detail : 'Invalid mapping. Check the asset ID and validation rules.', code);
      }
      throw fail('OPC-UA processing service is unavailable. Please retry.', 503);
    }
    throw error;
  }
}

async function assetFilter(user: IUser, baseFilter: Record<string, any> = {}): Promise<Record<string, any>> {
  return applyRoleFilter({ user, baseFilter, accountField: 'account_id', mapping: 'asset' });
}

async function assertAsset(user: IUser, id: unknown): Promise<any> {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw fail('Select a valid application asset.', 400);
  const asset = await AssetModel.findOne(await assetFilter(user, { _id: new Types.ObjectId(id) }))
    .select('_id asset_name asset_type').lean();
  if (!asset) throw fail('Asset is unavailable or outside your permitted scope.', 403);
  return asset;
}

function identity(req: Request): string {
  const id = String(req.params.id);
  if (!/^\d+$/.test(id)) throw fail('Invalid mapping identifier.', 400);
  return id;
}

function canonicalAssetType(type: string): string {
  const types: Record<string, string> = { Chillers: 'chiller', Motor: 'motor', Fan_Blower: 'fan',
    Compressor: 'compressor', Extruder: 'extruder', Mixer: 'mixer', Agitator: 'agitator', Kiln: 'kiln', Pumps: 'pump' };
  return types[type] || String(type || 'other').toLowerCase();
}

const wrap = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => { handler(req, res).catch(next); };

export function opcuaRoutes(): express.Router {
  const router = express.Router();
  router.use(hasRolePermission('peripheral_sensors', 'view'));
  router.use(hasAccountFeature('peripheral_sensors', 'view'));
  router.get('/assets', wrap(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = await assetFilter(principal(req), search ? { asset_name: { $regex: escaped, $options: 'i' } } : {});
    const rows = await AssetModel.find(filter).select('_id asset_name asset_type').sort({ asset_name: 1 }).limit(50).lean();
    res.json({ results: rows.map(row => ({ id: String(row._id), name: row.asset_name, asset_type: row.asset_type })) });
  }));
  router.get('/mappings', wrap(async (req, res) => {
    const user = principal(req);
    const params: Record<string, string> = {};
    for (const name of ['page', 'page_size', 'search', 'status']) {
      if (typeof req.query[name] === 'string') params[name] = String(req.query[name]).slice(0, 150);
    }
    const result = await callOpcuaProcessor(String(user.account_id), '', 'GET', undefined, params);
    const ids = (result.results || []).map((row: any) => row.asset_id).filter((id: unknown) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id));
    const assets = ids.length ? await AssetModel.find(await assetFilter(user, {
      _id: { $in: ids.map((id: string) => new Types.ObjectId(id)) },
    })).select('_id asset_name').lean() : [];
    const names = new Map(assets.map(asset => [String(asset._id), asset.asset_name]));
    for (const row of result.results || []) {
      row.asset_accessible = names.has(row.asset_id);
      row.asset_name = names.get(row.asset_id) || 'Unavailable asset';
    }
    res.json(result);
  }));
  router.get('/mappings/:id', wrap(async (req, res) => {
    const user = principal(req);
    const result = await callOpcuaProcessor(String(user.account_id), `${identity(req)}/`);
    result.asset_name = (await assertAsset(user, result.asset_id)).asset_name;
    res.json(result);
  }));
  const save = (updating: boolean) => wrap(async (req, res) => {
    const user = principal(req);
    const id = updating ? identity(req) : '';
    if (updating) {
      const current = await callOpcuaProcessor(String(user.account_id), `${id}/`);
      await assertAsset(user, current.asset_id);
    }
    const asset = await assertAsset(user, req.body?.asset_id);
    const selectedType = req.body.asset_type;
    const allowedTypes = ['chiller', 'motor', 'fan', 'compressor', 'extruder', 'mixer', 'agitator', 'kiln', 'pump', 'gearbox', 'other'];
    if (selectedType !== undefined && (typeof selectedType !== 'string' ||
        (!allowedTypes.includes(selectedType) && selectedType !== canonicalAssetType(asset.asset_type)))) {
      throw fail('Select a valid OPC-UA asset type.', 400);
    }
    const body = {
      source_asset_id: req.body.source_asset_id, asset_id: String(asset._id), asset_type: selectedType ?? canonicalAssetType(asset.asset_type),
      enabled: req.body.enabled, validation_rules: req.body.validation_rules,
      expected_version: updating ? req.body.expected_version : null,
      ...(req.body.source_config === undefined ? {} : { source_config: req.body.source_config }),
    };
    const result = await callOpcuaProcessor(String(user.account_id), updating ? `${id}/` : '', updating ? 'PUT' : 'POST', body);
    result.mapping.asset_name = asset.asset_name;
    res.status(updating ? 200 : 201).json(result);
  });
  router.post('/mappings', hasRolePermission('asset', 'attach_sensor'), save(false));
  router.put('/mappings/:id', hasRolePermission('asset', 'attach_sensor'), save(true));
  for (const action of ['refresh', 'replay']) {
    router.post(`/mappings/:id/${action}`, hasRolePermission('asset', 'attach_sensor'), wrap(async (req, res) => {
      const user = principal(req);
      const id = identity(req);
      const current = await callOpcuaProcessor(String(user.account_id), `${id}/`);
      await assertAsset(user, current.asset_id);
      const result = await callOpcuaProcessor(String(user.account_id), `${id}/${action}/`, 'POST', {});
      res.status(action === 'replay' ? 202 : 200).json(result);
    }));
  }
  return router;
}
