import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import registerWorkRequestRoutes from '../work/request/request.routes';
import registerInspectionRoutes from '../masters/inspection/inspection.routes';
import registerScheduleRoutes from '../masters/schedule/schedule.routes';
import registerPartRoutes from '../masters/part/parts.routes';
import registerPostRoutes from '../masters/post/posts.routes';
import registerUserRoutes from '../masters/user/user.routes';
import registerWorkOrderRoutes from '../work/order/order.routes';
import registerUserWorkOrderRoutes from '../transaction/mapUserWorkOrder/userWorkOrder.routes';
import registerProcedureRoutes from '../work/procedure/procedure.routes';
import registerOrderTemplateRoutes from '../work/orderTemplate/orderTemplate.routes';
import registerObservationRoutes from '../masters/observation/observation.routes';
import registerCommentRoutes from '../work/comments/comment.routes';
import registerInstructionRoutes from '../work/instruction/instruction.routes';
import registerTroubleshootGuideRoutes from '../masters/troubleshoot-guide/troubleshoot-guide.routes';
import registerCompanyRoutes from '../masters/company/company.routes';
import registerPostCommentRoutes from '../masters/post/comments/comments.routes';
import registerAssetReportRoutes from '../reports/asset/asset.routes';

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

describe('legacy mutation route permissions', () => {
  const denied = (next: ReturnType<typeof vi.fn>) => {
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  };

  it('guards work-request creation', () => {
    denied(invokePermission(
      registerWorkRequestRoutes,
      '/',
      'post',
      0,
      { work_request: { add: false } }
    ));
  });

  it('guards inspection creation', () => {
    denied(invokePermission(
      registerInspectionRoutes,
      '/',
      'post',
      0,
      { inspections: { add: false } }
    ));
  });

  it('guards preventive schedule creation', () => {
    denied(invokePermission(
      registerScheduleRoutes,
      '/',
      'post',
      0,
      { preventive: { add: false } }
    ));
  });

  it('guards inventory creation', () => {
    denied(invokePermission(
      registerPartRoutes,
      '/',
      'post',
      1,
      { inventory: { add: false } }
    ));
  });

  it('guards post creation', () => {
    denied(invokePermission(
      registerPostRoutes,
      '/',
      'post',
      0,
      { posts: { add: false } }
    ));
  });

  it('guards tenant-user creation', () => {
    denied(invokePermission(
      registerUserRoutes,
      '/',
      'post',
      0,
      { users: { add: false } }
    ));
  });

  it('guards work-order updates', () => {
    denied(invokePermission(
      registerWorkOrderRoutes,
      '/:id',
      'put',
      1,
      { workOrder: { edit_work_order: false } }
    ));
  });

  it('guards work-order assignment writes', () => {
    denied(invokePermission(
      registerUserWorkOrderRoutes,
      '/',
      'post',
      0,
      { workOrder: { edit_work_order: false } }
    ));
  });

  it('guards procedure creation', () => {
    denied(invokePermission(
      registerProcedureRoutes,
      '/',
      'post',
      0,
      { workOrder: { create_work_order: false } }
    ));
  });

  it('guards work-order template creation', () => {
    denied(invokePermission(
      registerOrderTemplateRoutes,
      '/',
      'post',
      0,
      { workOrder: { create_work_order: false } }
    ));
  });

  it('guards observation updates', () => {
    denied(invokePermission(
      registerObservationRoutes,
      '/:id',
      'put',
      1,
      { asset: { add_observation: false } }
    ));
  });

  it('guards work-order comment creation', () => {
    denied(invokePermission(
      registerCommentRoutes,
      '/',
      'post',
      0,
      { workOrder: { add_comment_work_order: false } }
    ));
  });

  it('guards instruction creation when neither resource permission is granted', () => {
    denied(invokePermission(
      registerInstructionRoutes,
      '/',
      'post',
      0,
      {
        asset: { edit_asset: false },
        location: { edit_location: false }
      }
    ));
  });

  it('allows instruction creation through the location permission alternative', () => {
    const next = invokePermission(
      registerInstructionRoutes,
      '/',
      'post',
      0,
      {
        asset: { edit_asset: false },
        location: { edit_location: true }
      }
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('guards troubleshoot-guide creation', () => {
    denied(invokePermission(
      registerTroubleshootGuideRoutes,
      '/',
      'post',
      0,
      {
        asset: { edit_asset: false },
        location: { edit_location: false }
      }
    ));
  });

  it('guards company updates', () => {
    denied(invokePermission(
      registerCompanyRoutes,
      '/:id',
      'patch',
      1,
      { users: { edit: false } }
    ));
  });

  it('guards post-comment creation', () => {
    denied(invokePermission(
      registerPostCommentRoutes,
      '/',
      'post',
      0,
      { posts: { add: false } }
    ));
  });

  it('guards asset-report PDF generation', () => {
    denied(invokePermission(
      registerAssetReportRoutes,
      '/generate-pdf/:id',
      'post',
      1,
      { asset: { download_report: false } }
    ));
  });
});
