import crypto from 'crypto';
import { Router } from 'express';
import { permissionSync } from '../core/config/env.config';
import { emitAccountPermissionsChanged } from '../core/socket/socket.server';
import { accountFeatureService } from '../modules/company/services/accountFeature.service';

const isAuthorizedService = (providedKey: string): boolean => {
  const expectedKey = permissionSync.serviceKey;
  if (!expectedKey || !providedKey) {
    return false;
  }

  const provided = Buffer.from(providedKey);
  const expected = Buffer.from(expectedKey);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
};

export const accountPermissionEventRoutes = (): Router => {
  const router = Router();

  router.post('/changed', (req, res) => {
    const serviceKey = String(req.headers['x-internal-service-key'] || '');
    if (!isAuthorizedService(serviceKey)) {
      return res.status(401).json({ status: false, message: 'Unauthorized service request' });
    }

    const accountId = String(req.body?.accountId || '').trim();
    const accountPermissionVersion = Number(req.body?.accountPermissionVersion);
    if (!accountId || !Number.isInteger(accountPermissionVersion) || accountPermissionVersion < 1) {
      return res.status(400).json({ status: false, message: 'Invalid permission change event' });
    }

    accountFeatureService.clear(accountId);
    const delivered = emitAccountPermissionsChanged(accountId, accountPermissionVersion);
    return res.status(202).json({ status: true, data: { delivered } });
  });

  return router;
};
