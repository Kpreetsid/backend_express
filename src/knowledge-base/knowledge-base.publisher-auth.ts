import axios from 'axios';
import jwt from 'jsonwebtoken';
import { Request, RequestHandler } from 'express';

export interface GuidePermissions { view: boolean; add: boolean; edit: boolean; delete: boolean; }
export interface GuidePublisher { id: string; permissions: GuidePermissions; }
export type GuidePublisherRequest = Request & { guidePublisher?: GuidePublisher };
const unauthorized = () => Object.assign(new Error('An active internal login is required.'), { status: 401 });
const forbidden = () => Object.assign(new Error('Your role does not allow this knowledge-base action.'), { status: 403 });

export function guideRolePermissions(roleMenu: any, role: string): GuidePermissions {
  // Preserve access for existing administrators until the new menu is added.
  // Explicitly configured denials always take precedence, including for admins.
  const enabled = role === 'admin';
  const parent = roleMenu?.master_knowledge_base === undefined ? { view: enabled } : roleMenu.master_knowledge_base;
  const child = roleMenu?.knowledge_base === undefined ? { view: enabled, add: enabled, edit: enabled, delete: enabled } : roleMenu.knowledge_base;
  const view = parent?.view === true && child?.view === true;
  return { view, add: view && child?.add === true, edit: view && child?.edit === true, delete: view && child?.delete === true };
}

export function isGuidePublishingBearerRequest(req: Request): boolean {
  const prefix = (process.env.API_BASE_PATH || '/cmms_express').replace(/\/$/, '');
  const paths = ['/api/internal/knowledge-base', '/api/v1/internal/knowledge-base',
    prefix + '/api/internal/knowledge-base', prefix + '/api/v1/internal/knowledge-base'];
  return /^Bearer \S+$/.test(req.get('Authorization') || '') &&
    paths.some(base => req.path === base || req.path.startsWith(base + '/'));
}

export async function verifyGuidePublisher(token: string): Promise<GuidePublisher> {
  const decoded = jwt.decode(token);
  // This untrusted ID is only a lookup key. The internal server verifies the
  // signature, session, expiry and current user before returning the identity.
  const id = decoded && typeof decoded === 'object' ? String(decoded['userId'] || '') : '';
  if (!/^[a-f0-9]{24}$/i.test(id)) { throw unauthorized(); }
  const base = (process.env.KNOWLEDGE_BASE_INTERNAL_API_URL ||
    'https://app.presageinsights.ai/internal_express').replace(/\/$/, '');
  const options = { headers: { Authorization: 'Bearer ' + token, 'x-db-type': 'production' }, timeout: 8000, maxRedirects: 0 };
  try {
    const response = await axios.get(base + '/api/internal/users/' + id, options);
    const user = response.data?.data;
    if (!response.data?.status || String(user?._id || user?.id || '') !== id ||
        user?.user_status !== 'active' || user?.visible === false) { throw unauthorized(); }
    const rolesResponse = await axios.get(base + '/api/internal/role-menu', {
      ...options, params: { user_id: id }, validateStatus: status => status === 200 || status === 404
    });
    const roles = rolesResponse.data?.status && Array.isArray(rolesResponse.data?.data) ? rolesResponse.data.data : [];
    const currentRole = roles.find((role: any) => String(role.userId) === id && role.roleName === user.user_role && role.visible !== false);
    if (!currentRole) { throw forbidden(); }
    return { id, permissions: guideRolePermissions(currentRole.roleMenu, user.user_role) };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if ([401, 403, 404].includes(error.response?.status || 0)) { throw unauthorized(); }
      throw Object.assign(new Error('Internal login verification is temporarily unavailable.'), { status: 503 });
    }
    throw error;
  }
}

export const requireGuidePublisher: RequestHandler = async (req, _res, next) => {
  try {
    const match = /^Bearer (\S+)$/.exec(req.get('Authorization') || '');
    if (!match) { throw unauthorized(); }
    (req as GuidePublisherRequest).guidePublisher = await verifyGuidePublisher(match[1]!);
    next();
  } catch (error) { next(error); }
};

export const requireGuidePermission = (action: keyof GuidePermissions): RequestHandler => (req, _res, next) => {
  const permissions = (req as GuidePublisherRequest).guidePublisher?.permissions;
  if (!permissions?.view || !permissions[action]) { next(forbidden()); return; }
  next();
};
