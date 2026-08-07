import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import registerAssetRoutes from './asset.routes';

const getBuzzerPermissionMiddleware = () => {
  const rootRouter: any = express.Router();
  registerAssetRoutes(rootRouter);
  const assetRouter = rootRouter.stack.find((layer: any) => layer.name === 'router')?.handle;
  const routeLayer = assetRouter?.stack.find(
    (layer: any) => layer.route?.path === '/buzzer/:location_id'
  );
  expect(routeLayer?.route?.methods?.patch).toBe(true);
  expect(routeLayer?.route?.stack).toHaveLength(3);
  return routeLayer.route.stack[1].handle;
};

describe('asset buzzer route permission', () => {
  it('denies a role without asset.config_alarm', () => {
    const middleware = getBuzzerPermissionMiddleware();
    const next = vi.fn();

    middleware({
      user: { user_role: 'manager' },
      role: { asset: { config_alarm: false, edit_asset: true } }
    }, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'You do not have permission to access.',
      status: 403
    }));
  });

  it('allows a role with asset.config_alarm', () => {
    const middleware = getBuzzerPermissionMiddleware();
    const next = vi.fn();

    middleware({
      user: { user_role: 'manager' },
      role: { asset: { config_alarm: true } }
    }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});
