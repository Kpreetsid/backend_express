import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import registerSopRoutes from './sops.routes';
import registerCategoryRoutes from '../formCategory/formCategory.routes';

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
  const route = nestedRouter.stack.find(
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

describe('form and category route permissions', () => {
  it('guards SOP reads with form.view', () => {
    const next = invokePermission(
      registerSopRoutes,
      '/',
      'get',
      0,
      { form: { view: false } }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('guards SOP creation with form.add', () => {
    const next = invokePermission(
      registerSopRoutes,
      '/',
      'post',
      0,
      { form: { add: false } }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('guards category updates with form_category.edit', () => {
    const next = invokePermission(
      registerCategoryRoutes,
      '/:id',
      'put',
      1,
      { form_category: { edit: false } }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('guards category deletion with form_category.delete', () => {
    const next = invokePermission(
      registerCategoryRoutes,
      '/:id',
      'delete',
      1,
      { form_category: { delete: false } }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });
});
