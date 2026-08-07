import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import registerLocationRoutes from './location.routes';
import registerFloorMapRoutes from '../floorMap/floorMap.routes';
import registerUserLocationRoutes from '../../transaction/mapUserLocation/userLocation.routes';

const invokePermission = (
  registerRoutes: (router: express.Router) => void,
  routePath: string,
  method: string,
  permissionIndex: number,
  role: Record<string, unknown>
) => {
  const root: any = express.Router();
  registerRoutes(root);
  const nestedRouter = root.stack.find((layer: any) => layer.name === 'router')?.handle;
  const stack = nestedRouter?.stack || root.stack;
  const route = stack.find(
    (layer: any) => layer.route?.path === routePath && layer.route?.methods?.[method]
  )?.route;
  expect(route?.methods?.[method]).toBe(true);
  const next = vi.fn();
  route.stack[permissionIndex].handle(
    { user: { user_role: 'manager' }, role },
    {},
    next
  );
  return next;
};

describe('location mutation route permissions', () => {
  it('guards location copy with location.add_location', () => {
    const next = invokePermission(
      registerLocationRoutes,
      '/make-copy/:id',
      'get',
      1,
      { location: { add_location: false, edit_location: true } }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('guards floor-map coordinate creation with floorMap.create_kpi', () => {
    const next = invokePermission(
      registerFloorMapRoutes,
      '/coordinate',
      'post',
      0,
      { floorMap: { create_kpi: false, view_floor_map: true } }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('guards user-location mapping writes with location.edit_location', () => {
    const next = invokePermission(
      registerUserLocationRoutes,
      '/userToLocations',
      'post',
      0,
      { location: { edit_location: false } }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });
});
