import { body } from 'express-validator';

const WEEKDAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

const validateScheduleRules = (schedule: any, requireComplete = true): boolean => {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    throw new Error('Schedule must be an object');
  }
  const start = schedule.start_date ? new Date(schedule.start_date) : null;
  const end = schedule.end_date ? new Date(schedule.end_date) : null;
  if ((requireComplete && !start) || (start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
    throw new Error('Schedule dates must be valid ISO dates');
  }
  if (start && end && end < start) throw new Error('End date cannot be before start date');

  if (schedule.no_of_repetition != null && (!Number.isInteger(Number(schedule.no_of_repetition)) || Number(schedule.no_of_repetition) < 1)) {
    throw new Error('Number of repetitions must be a positive integer');
  }

  if (schedule.mode === 'daily' && (requireComplete || schedule.daily)) {
    const every = Number(schedule.daily?.everyNDays);
    if (!Number.isInteger(every) || every < 1) throw new Error('Daily interval must be a positive integer');
  }
  if (schedule.mode === 'weekly' && (requireComplete || schedule.weekly)) {
    const every = Number(schedule.weekly?.everyNWeeks);
    const days = schedule.weekly?.days;
    if (!Number.isInteger(every) || every < 1) throw new Error('Weekly interval must be a positive integer');
    if (!Array.isArray(days) || days.length === 0 || days.some((day: unknown) => !WEEKDAYS.has(String(day).toLowerCase()))) {
      throw new Error('At least one valid weekday is required');
    }
  }
  if (schedule.mode === 'monthly' && (requireComplete || schedule.monthly)) {
    const every = Number(schedule.monthly?.everyNMonths);
    const monthDays = schedule.monthly?.monthDays;
    if (!Number.isInteger(every) || every < 1) throw new Error('Monthly interval must be a positive integer');
    if (!Array.isArray(monthDays) || monthDays.length === 0 || monthDays.some((day: unknown) => !Number.isInteger(Number(day)) || Number(day) < 1 || Number(day) > 31)) {
      throw new Error('At least one valid day of month is required');
    }
  }
  return true;
};

export const scheduleValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim(),
  
  body('schedule')
    .notEmpty().withMessage('Schedule is required')
    .isObject().withMessage('Schedule must be an object'),

  body('schedule.mode')
    .notEmpty().withMessage('Schedule mode is required')
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Invalid schedule mode'),

  body('schedule.start_date')
    .notEmpty().withMessage('Start date is required')
    .isISO8601({ strict: true }).withMessage('Start date must be a valid ISO date'),

  body('schedule.end_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601({ strict: true }).withMessage('End date must be a valid ISO date'),

  body('schedule.enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
  body('schedule.skipWeekends').optional().isBoolean().withMessage('skipWeekends must be a boolean'),
  body('schedule.skipWeekendSaturday').optional().isBoolean().withMessage('skipWeekendSaturday must be a boolean'),
  body('schedule.skipWeekendSunday').optional().isBoolean().withMessage('skipWeekendSunday must be a boolean'),
  body('schedule.skipDates').optional().isArray().withMessage('skipDates must be an array'),
  body('schedule.skipDates.*').optional().isISO8601({ strict: true }).withMessage('Every skip date must be a valid ISO date'),
  body('schedule').custom((schedule) => validateScheduleRules(schedule, true)),

  body('work_order')
    .notEmpty().withMessage('Work order template is required')
    .isObject().withMessage('Work order must be an object'),

  body('work_order.title')
    .notEmpty().withMessage('Work order title is required')
    .isString().withMessage('Work order title must be a string')
    .trim(),

  body('work_order.type')
    .notEmpty().withMessage('Work order type is required')
    .isString().withMessage('Work order type must be a string')
    .trim(),

  body('work_order.priority')
    .notEmpty().withMessage('Work order priority is required')
    .isIn(['None', 'Low', 'Medium', 'High', 'Urgent']).withMessage('Invalid work order priority'),

  body('work_order.estimated_time')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Estimated time cannot be negative'),

  body('work_order.wo_location_id')
    .notEmpty().withMessage('Work order location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('work_order.wo_asset_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('work_order.userIdList')
    .notEmpty().withMessage('User ID list is required')
    .isArray({ min: 1 }).withMessage('At least one assigned user is required'),
  body('work_order.userIdList.*').isMongoId().withMessage('Every assigned user ID must be valid')
];

export const scheduleUpdateValidator = [
  body('title').optional().isString().withMessage('Title must be a string').trim(),
  body('schedule').optional().isObject().withMessage('Schedule must be an object'),
  body('schedule.mode').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid schedule mode'),
  body('schedule.start_date').optional().isISO8601({ strict: true }).withMessage('Start date must be a valid ISO date'),
  body('schedule.end_date').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }).withMessage('End date must be a valid ISO date'),
  body('schedule.enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
  body('rescheduleEnabled').optional().isBoolean().withMessage('rescheduleEnabled must be a boolean'),
  body('work_order').optional().isObject().withMessage('Work order must be an object'),
  body('work_order.title').optional().isString().withMessage('Work order title must be a string').trim(),
  body('work_order.type').optional().isString().withMessage('Work order type must be a string').trim(),
  body('work_order.priority').optional().isIn(['None', 'Low', 'Medium', 'High', 'Urgent']).withMessage('Invalid work order priority'),
  body('work_order.estimated_time').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Estimated time cannot be negative'),
  body('work_order.wo_location_id').optional().isMongoId().withMessage('Invalid Location ID format'),
  body('work_order.wo_asset_id').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Invalid Asset ID format'),
  body('work_order.userIdList').optional().isArray({ min: 1 }).withMessage('At least one assigned user is required'),
  body('work_order.userIdList.*').optional().isMongoId().withMessage('Every assigned user ID must be valid'),
  body('schedule').optional().custom((schedule) => validateScheduleRules(schedule, false))
];

