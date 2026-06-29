import express from 'express';
import { reliabilityCaseController } from './case.controller';
import { validateParamId } from '../../middlewares/validate';
import { validate } from '../../middlewares/validator.middleware';
import { hasReliabilityPermission } from '../middlewares/permission';
import {
  addCaseNoteValidator,
  approvalValidator,
  closeCaseValidator,
  createCaseFromAlertValidator,
  createCaseFromAlertsValidator,
  feedbackValidator,
  linkWorkOrderValidator,
  recommendationValidator,
  updateCaseStatusValidator
} from './case.validator';

export default (router: express.Router) => {
  const caseRouter = express.Router();

  caseRouter.get('/', hasReliabilityPermission('view_case'), reliabilityCaseController.getCases);
  caseRouter.post('/group-alerts', hasReliabilityPermission('create_case'), createCaseFromAlertsValidator, validate, reliabilityCaseController.groupAlerts);
  caseRouter.get('/:id/spares', validateParamId, hasReliabilityPermission('view_case'), reliabilityCaseController.getSpareAvailability);
  caseRouter.get('/:id', validateParamId, hasReliabilityPermission('view_case'), reliabilityCaseController.getCaseById);
  caseRouter.post('/from-alert', hasReliabilityPermission('create_case'), createCaseFromAlertValidator, validate, reliabilityCaseController.createFromAlert);
  caseRouter.post('/from-alerts', hasReliabilityPermission('create_case'), createCaseFromAlertsValidator, validate, reliabilityCaseController.createFromAlerts);
  caseRouter.patch('/:id/status', validateParamId, hasReliabilityPermission('triage_case'), updateCaseStatusValidator, validate, reliabilityCaseController.updateStatus);
  caseRouter.post('/:id/notes', validateParamId, hasReliabilityPermission('edit_case'), addCaseNoteValidator, validate, reliabilityCaseController.addNote);
  caseRouter.post('/:id/recommendation', validateParamId, hasReliabilityPermission('generate_recommendation'), recommendationValidator, validate, reliabilityCaseController.updateRecommendation);
  caseRouter.post('/:id/approval', validateParamId, hasReliabilityPermission('approve_recommendation'), approvalValidator, validate, reliabilityCaseController.decideApproval);
  caseRouter.post('/:id/work-order-draft', validateParamId, hasReliabilityPermission('create_work_order_from_case'), reliabilityCaseController.workOrderDraft);
  caseRouter.post('/:id/create-work-order', validateParamId, hasReliabilityPermission('create_work_order_from_case'), reliabilityCaseController.createWorkOrder);
  caseRouter.post('/:id/feedback', validateParamId, hasReliabilityPermission('add_feedback'), feedbackValidator, validate, reliabilityCaseController.addFeedback);
  caseRouter.post('/:id/close', validateParamId, hasReliabilityPermission('close_case'), closeCaseValidator, validate, reliabilityCaseController.closeCase);
  caseRouter.post('/:id/link-work-order', validateParamId, hasReliabilityPermission('create_work_order_from_case'), linkWorkOrderValidator, validate, reliabilityCaseController.linkWorkOrder);

  router.use('/cases', caseRouter);
};
