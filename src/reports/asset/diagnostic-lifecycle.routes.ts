import express, { NextFunction, Request, Response } from 'express';
import { get } from 'lodash';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { assetReportService } from './asset.service';

export const attachDiagnosticLifecycleRoutes = (router: express.Router): void => {
  router.patch(
    '/:id/diagnostic-lifecycle',
    validateParamId,
    hasRolePermission('asset', 'edit_report'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const keys = Object.keys(body);
        if (keys.length !== 1 || keys[0] !== 'diagnosticLifecycle') {
          throw Object.assign(new Error('Only diagnosticLifecycle may be changed through this endpoint'), { status: 400 });
        }

        const user = get(req, 'user', {}) as IUser;
        const reportId = helperService.validateObjectId(String(req.params.id));
        const data = await assetReportService.transitionDiagnosticLifecycle(
          reportId,
          user.account_id,
          user._id,
          body.diagnosticLifecycle,
        );
        if (!data) {
          throw Object.assign(
            new Error('Asset report diagnostic lifecycle changed during this request or the report is unavailable'),
            { status: 409 },
          );
        }

        res.status(200).json({
          status: true,
          message: 'Diagnostic lifecycle updated successfully',
          data,
        });
      } catch (error) {
        next(error);
      }
    },
  );
};
