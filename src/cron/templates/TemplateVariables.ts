// src/cron/templates/TemplateVariables.ts
export class TemplateVariables {
    /**
     * Get all available template variables for a schedule
     */
    static getVariables(schedule: any, executionDate: Date): Record<string, string> {
        const formatDate = (date: Date) => {
            return date.toISOString().split('T')[0]; // YYYY-MM-DD
        };

        const formatDateTime = (date: Date) => {
            return date.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const formatTime = (date: Date) => {
            return date.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        return {
            // Schedule related
            'schedule_title': schedule.title || '',
            'schedule_description': schedule.description || '',
            'schedule_mode': schedule.schedule_mode || 'daily',


            // Date/Time related
            'date': formatDate(executionDate),
            'datetime': formatDateTime(executionDate),
            'time': formatTime(executionDate),
            'year': executionDate.getFullYear().toString(),
            'month': (executionDate.getMonth() + 1).toString().padStart(2, '0'),
            'day': executionDate.getDate().toString().padStart(2, '0'),
            'day_name': executionDate.toLocaleDateString('en-US', { weekday: 'long' }),
            'month_name': executionDate.toLocaleDateString('en-US', { month: 'long' }),



            // Work order related
            'wo_type': schedule.work_order?.type || 'Preventive Maintenance',
            'wo_priority': schedule.work_order?.priority || 'Medium',
            'estimated_time': schedule.work_order?.estimated_time || '4',

            // Timestamps
            'timestamp': Date.now().toString(),
            'iso_date': executionDate.toISOString(),
        };
    }

    /**
     * Get list of all available variable names
     */
    static getAvailableVariables(): string[] {
        return [
            'schedule_title',
            'schedule_description',
            'schedule_mode',
            'date',
            'datetime',
            'time',
            'year',
            'month',
            'day',
            'day_name',
            'month_name',
            'execution_count',
            'timezone',
            'wo_type',
            'wo_priority',
            'estimated_time',
            'timestamp',
            'iso_date'
        ];
    }
}