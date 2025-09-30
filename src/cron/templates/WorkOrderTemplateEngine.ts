
import { TemplateVariables } from './TemplateVariables';
import { generateOrderNo } from "../../work/order/order.service";

export class WorkOrderTemplateEngine {
    static substituteVariables(template: string, variables: Record<string, any>): string {
        if (!template) return "";
        let result = template;
        for (const key in variables) {
            const value = variables[key];
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
            result = result.replace(regex, value);
        }
        return result;
    }
    static async generateWorkOrderData(schedule: any, executionDate: Date): Promise<any> {
        const variables = TemplateVariables.getVariables(schedule, executionDate);
        const wo = schedule.work_order || {};
        const orderNo = await generateOrderNo(schedule.account_id);
        const startDate = new Date(executionDate);
        const endDate = new Date(executionDate);
        endDate.setDate(startDate.getDate() + (schedule.schedule?.days_to_complete || 1));
        return {
            account_id: schedule.account_id,
            order_no: orderNo,
            title: this.substituteVariables(wo.title || schedule.title, variables),
            description: this.substituteVariables(wo.description || schedule.description || "", variables),
            priority: wo.priority,
            status: wo.status,
            type: wo.type,
            wo_asset_id: wo.wo_asset_id,
            wo_location_id: wo.wo_location_id,
            start_date: startDate,
            end_date: endDate,
            estimated_time: wo.estimated_time ? parseInt(wo.estimated_time) : 0,
            sop_form_id: wo.sop_form_id,
            repeat: {
                weekly: {
                    interval: schedule.schedule?.repeat?.weekly?.interval,
                    days: schedule.schedule?.repeat?.weekly?.days ?? {
                        monday: false,
                        tuesday: false,
                        wednesday: false,
                        thursday: false,
                        friday: false,
                        saturday: false,
                        sunday: false
                    }
                },
                monthly: {
                    interval: schedule.schedule?.repeat?.monthly?.interval ?? null,
                    dayOfMonth: schedule.schedule?.repeat?.monthly?.dayOfMonth ?? null
                }
            },
            no_of_time_call: schedule.schedule?.no_of_time_call || 1,
            tasks: (wo.tasks || []).map((task: any) => ({
                title: task.title,
                type: task.type,
                fieldValue: task.fieldValue,
                options: (task.options || []).map((opt: any) => ({
                    key: opt.key,
                    value: String(opt.value)
                }))
            })),
            parts: (wo.parts || []).map((p: any) => ({
                part_id: p.part_id,
                part_name: p.part_name,
                part_type: p.part_type,
                estimatedQuantity: p.estimatedQuantity,
                actualQuantity: 0
            })),
            visible: true,
            createdBy: schedule.createdBy,
            createdFrom: wo.createdFrom
        };
    }

    /**
     * Map priority to valid work order priority
     */
    private static mapPriority(priority: string): string {
        const validPriorities = ['None', 'Low', 'Medium', 'High'];
        const normalized = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
        return validPriorities.includes(normalized) ? normalized : 'Medium';
    }

    /**
     * Map status to valid work order status
     */
    private static mapStatus(status: string): string {
        const validStatuses = ['Open', 'Pending', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'];
        const normalized = status.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('-');
        return validStatuses.includes(normalized) ? normalized : 'Open';
    }

    /**
     * Get valid nature of work options
     */
    static getValidNatureOfWork(): string[] {
        return [
            'Preventive Maintenance',
            'Corrective Maintenance',
            'Emergency Repair',
            'Inspection',
            'Calibration',
            'Safety Check',
            'Cleaning',
            'Lubrication'
        ];
    }

    /**
     * Preview what a work order would look like without creating it
     */
    static previewWorkOrder(schedule: any, executionDate: Date): any {
        const variables = TemplateVariables.getVariables(schedule, executionDate);
        const template = schedule.work_order_template || {};

        return {
            title: this.substituteVariables(template.title || "{{schedule_title}} - {{date}}", variables),
            description: this.substituteVariables(template.description || schedule.description || "", variables),
            priority: this.mapPriority(template.priority || "Medium"),
            status: this.mapStatus(template.status || "Open"),
            type: template.nature_of_work || template.type || "Preventive Maintenance",
            estimated_time: template.estimated_time || 4,
            attachments: template.attachments || [],
            selected_parts: template.selected_parts || [],
            variables_used: variables
        };
    }
}