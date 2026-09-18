import { Request, Response, Router } from 'express';
import { parsePlantBrainHistoryRequest, parsePlantBrainRespondRequest, PlantBrainRequestError } from './plantBrain.contract';
import {
  plantBrainDelegatedIdentityConfigFromEnv,
  PlantBrainDelegatedIdentityIssuer
} from './plantBrain.delegatedIdentity';
import { PlantBrainProxyError, proxyPlantBrainHistory, proxyPlantBrainRespond } from './plantBrain.proxy';
import { PlantBrainScopeError, resolvePlantBrainTrustedAssetScope } from './plantBrain.scope';
import { resolvePlantBrainSourceScope } from './plantBrain.sourceScope';

let delegatedIdentityIssuer: PlantBrainDelegatedIdentityIssuer | undefined;

const getDelegatedIdentityIssuer = (): PlantBrainDelegatedIdentityIssuer => {
  if (!delegatedIdentityIssuer) {
    delegatedIdentityIssuer = new PlantBrainDelegatedIdentityIssuer(plantBrainDelegatedIdentityConfigFromEnv());
  }
  return delegatedIdentityIssuer;
};

export const plantBrainPublicRoutes = (): Router => {
  const router = Router();

  // Public key material only. Token minting remains inside authenticated BFF execution.
  router.get('/.well-known/jwks.json', (_req: Request, res: Response) => {
    try {
      res.setHeader('cache-control', 'public, max-age=60');
      res.status(200).json(getDelegatedIdentityIssuer().jwks());
    } catch {
      res.status(503).json({
        status: false,
        code: 'plant_brain_delegation_unavailable',
        message: 'Plant Brain delegation identity is unavailable'
      });
    }
  });

  return router;
};

const plantBrainRoutes = (): Router => {
  const router = Router();

  router.get('/scope', async (req: Request, res: Response) => {
    try {
      const data = await resolvePlantBrainSourceScope(req);
      res.status(200).json({ status: true, data });
    } catch (error) {
      if (error instanceof PlantBrainScopeError) {
        res.status(error.status).json({
          status: false,
          code: error.code,
          message: error.message
        });
        return;
      }
      res.status(503).json({
        status: false,
        code: 'scope_source_unavailable',
        message: 'Plant Brain scope source is unavailable'
      });
    }
  });

  router.get('/history', async (req: Request, res: Response) => {
    try {
      const input = parsePlantBrainHistoryRequest(req.query);
      const scope = await resolvePlantBrainTrustedAssetScope(req, input.ui_asset_id);
      const response = await proxyPlantBrainHistory(scope, getDelegatedIdentityIssuer(), input.thread_id);
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof PlantBrainRequestError || error instanceof PlantBrainScopeError || error instanceof PlantBrainProxyError) {
        res.status(error.status).json({
          status: false,
          code: error.code,
          message: error.message
        });
        return;
      }
      res.status(503).json({
        status: false,
        code: 'plant_brain_unavailable',
        message: 'Plant Brain history is unavailable. No Presage asset state was changed.'
      });
    }
  });

  router.post('/respond', async (req: Request, res: Response) => {
    try {
      const input = parsePlantBrainRespondRequest(req.body);
      const scope = await resolvePlantBrainTrustedAssetScope(req, input.ui_asset_id);
      const response = await proxyPlantBrainRespond(req, input, scope, getDelegatedIdentityIssuer());
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof PlantBrainRequestError || error instanceof PlantBrainScopeError || error instanceof PlantBrainProxyError) {
        res.status(error.status).json({
          status: false,
          code: error.code,
          message: error.message
        });
        return;
      }
      res.status(503).json({
        status: false,
        code: 'plant_brain_unavailable',
        message: 'Plant Brain is unavailable. No Presage asset state was changed.'
      });
    }
  });

  return router;
};

export default plantBrainRoutes;
