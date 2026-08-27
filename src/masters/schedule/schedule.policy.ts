const copyDefined = (source: any, fields: readonly string[]): Record<string, any> => {
  const result: Record<string, any> = {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) result[field] = source[field];
  }
  return result;
};

export const sanitizeSchedulePayload = (body: any, forCreate = false): Record<string, any> => {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const result = copyDefined(source, ['title', 'description']);

  if (source.schedule && typeof source.schedule === 'object' && !Array.isArray(source.schedule)) {
    const schedule = copyDefined(source.schedule, [
      'mode',
      'enabled',
      'start_date',
      'end_date',
      'no_of_repetition',
      'skipWeekends',
      'skipWeekendSaturday',
      'skipWeekendSunday',
      'skipDates'
    ]);
    if (source.schedule.daily) schedule.daily = copyDefined(source.schedule.daily, ['everyNDays']);
    if (source.schedule.weekly) schedule.weekly = copyDefined(source.schedule.weekly, ['everyNWeeks', 'days']);
    if (source.schedule.monthly) schedule.monthly = copyDefined(source.schedule.monthly, ['everyNMonths', 'monthDays']);
    result.schedule = schedule;
  }

  if (source.work_order && typeof source.work_order === 'object' && !Array.isArray(source.work_order)) {
    result.work_order = copyDefined(source.work_order, [
      'title',
      'description',
      'type',
      'priority',
      'estimated_time',
      'wo_location_id',
      'wo_asset_id',
      'sop_form_id',
      'userIdList',
      'tasks',
      'parts',
      'createdFrom'
    ]);
    if (forCreate) result.work_order.status = 'Open';
  }

  return result;
};
