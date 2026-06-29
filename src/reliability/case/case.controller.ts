import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { reliabilityCaseService } from './case.service';
import { CreateCaseFromAssetReportPayload, CreateCaseFromAlertsPayload, UpdateCaseStatusPayload } from './case.types';

class ReliabilityCaseController {
  getCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.getCases(user as any, req.query as Record<string, unknown>);
      res.status(200).json({ status: true, message: 'Reliability cases fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  getCaseById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.getCaseById(user as any, String(req.params.id));
      res.status(200).json({ status: true, message: 'Reliability case fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  getSpareAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.getSpareAvailability(String(req.params.id), user as any);
      res.status(200).json({ status: true, message: 'Reliability spare availability fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  createFromAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const token = get(req, 'userToken', '') as string;
      const alarmId = req.body?.alarm_id || req.body?.alarmId;
      const payload: CreateCaseFromAlertsPayload = {
        alarm_ids: alarmId ? [String(alarmId)] : [],
        title: req.body?.title,
        description: req.body?.description
      };
      const data = await reliabilityCaseService.createFromAlerts(payload, user as any, token);
      res.status(201).json({ status: true, message: 'Reliability case created successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  createFromAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const token = get(req, 'userToken', '') as string;
      const payload = req.body as CreateCaseFromAlertsPayload;
      const data = await reliabilityCaseService.createFromAlerts(payload, user as any, token);
      res.status(201).json({ status: true, message: 'Reliability case created successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  createFromAssetReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const payload = req.body as CreateCaseFromAssetReportPayload;
      const data = await reliabilityCaseService.createFromAssetReport(payload, user as any);
      res.status(201).json({ status: true, message: 'Reliability case created from asset report successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  groupAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const token = get(req, 'userToken', '') as string;
      const payload = req.body as CreateCaseFromAlertsPayload;
      const data = await reliabilityCaseService.groupAlerts(payload, user as any, token);
      res.status(200).json({ status: true, message: 'Reliability alerts grouped successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const payload = req.body as UpdateCaseStatusPayload;
      const data = await reliabilityCaseService.updateStatus(String(req.params.id), payload, user as any);
      res.status(200).json({ status: true, message: 'Reliability case status updated successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  addNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.addNote(String(req.params.id), String(req.body.note), user as any);
      res.status(200).json({ status: true, message: 'Reliability case note added successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  linkWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.linkWorkOrder(String(req.params.id), req.body, user as any);
      res.status(200).json({ status: true, message: 'Work order linked successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  updateRecommendation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.updateRecommendation(String(req.params.id), req.body, user as any);
      res.status(200).json({ status: true, message: 'Reliability recommendation updated successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  decideApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.decideApproval(String(req.params.id), req.body, user as any);
      res.status(200).json({ status: true, message: 'Reliability approval decision saved successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  workOrderDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.buildWorkOrderDraft(String(req.params.id), user as any, req.body || {});
      res.status(200).json({ status: true, message: 'Work order draft generated successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  createWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.createWorkOrderFromCase(String(req.params.id), user as any, req.body || {});
      res.status(201).json({ status: true, message: 'Work order created from reliability case successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  addFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.addFeedback(String(req.params.id), req.body, user as any);
      res.status(200).json({ status: true, message: 'Reliability case feedback saved successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  closeCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityCaseService.closeCase(String(req.params.id), req.body, user as any);
      res.status(200).json({ status: true, message: 'Reliability case closed successfully.', data });
    } catch (error) {
      next(error);
    }
  };
}

export const reliabilityCaseController = new ReliabilityCaseController();
