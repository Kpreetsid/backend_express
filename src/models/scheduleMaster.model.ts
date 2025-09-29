
import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IScheduleMaster extends Document {
    account_id: ObjectId;
    title: string;
    description: string;
    schedule_mode: string;

    schedule: {
        mode: string;
        enabled: boolean;

        no_of_time_call: number;
        start_date: string;
        end_date?: string;
        repeat: {
            weekly?: {
                interval?: number;
                days?: {
                    monday: boolean;
                    tuesday: boolean;
                    wednesday: boolean;
                    thursday: boolean;
                    friday: boolean;
                    saturday: boolean;
                    sunday: boolean;
                };
            };
            monthly?: {
                interval?: number;
                dayOfMonth?: number;
            };
        };
    };


    work_order: {
        title?: string;
        description?: string;
        type?: string;
        status?: string;
        priority?: string;
        estimated_time?: string;
        wo_location_id?: ObjectId;
        wo_asset_id?: ObjectId;
        sop_form_id?: ObjectId;
        userIdList?: string[];
        tasks?: any[];
        parts?: any[];
        // workInstruction?: string;
        createdFrom?: string;
    };
    rescheduleEnabled: boolean;
    visible: boolean;
    start_date: string;
    end_date?: string;
    next_execute_date?: string;
    last_execution_date?: string;

    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
    dayOfMonth?: string;

    default_asset_id?: ObjectId;
    default_location_id?: ObjectId;
    default_created_by?: ObjectId;
    default_assigned_user?: ObjectId;
    prev_asset_id?: ObjectId;
    prev_loc_id?: ObjectId;
    createdBy: ObjectId;
    updatedBy?: ObjectId;
}

const ScheduleMasterSchema = new Schema<IScheduleMaster>({
    account_id: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    description: { type: String },
    schedule_mode: { type: String, required: true },


    schedule: {
        mode: { type: String, required: true },
        enabled: { type: Boolean, default: true },

        no_of_time_call: { type: Number, default: 1 },
        start_date: { type: String },
        end_date: { type: String },
        repeat: {
            weekly: {
                interval: { type: Number },
                days: {
                    monday: { type: Boolean, default: false },
                    tuesday: { type: Boolean, default: false },
                    wednesday: { type: Boolean, default: false },
                    thursday: { type: Boolean, default: false },
                    friday: { type: Boolean, default: false },
                    saturday: { type: Boolean, default: false },
                    sunday: { type: Boolean, default: false }
                }
            },
            monthly: {
                interval: { type: Number },
                dayOfMonth: { type: Number }
            }
        }
    },


    work_order: {
        title: { type: String },
        description: { type: String },
        type: { type: String },
        status: { type: String },
        priority: { type: String },
        estimated_time: { type: String },
        wo_location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel' },
        wo_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
        sop_form_id: { type: Schema.Types.ObjectId, ref: 'SOPFormModel' },
        userIdList: [{ type: String }], // Array of user IDs as strings
        tasks: [{
            _id: { type: Schema.Types.ObjectId, auto: true },
            title: { type: String },
            type: { type: String },
            fieldValue: { type: String },
            options: [{
                key: { type: String },
                value: { type: Boolean }
            }]
        }],
        parts: [{
            _id: { type: Schema.Types.ObjectId, auto: true },
            part_id: { type: String },
            part_name: { type: String },
            part_type: { type: String },
            estimatedQuantity: { type: Number }
        }],
        // workInstruction: { type: String },
        createdFrom: { type: String }
    },
    rescheduleEnabled: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    start_date: { type: String, required: true },
    end_date: { type: String },
    next_execute_date: { type: String },
    last_execution_date: { type: String },

    // ✅ KEEP: Old day fields for backward compatibility
    monday: { type: Boolean, default: false },
    tuesday: { type: Boolean, default: false },
    wednesday: { type: Boolean, default: false },
    thursday: { type: Boolean, default: false },
    friday: { type: Boolean, default: false },
    saturday: { type: Boolean, default: false },
    sunday: { type: Boolean, default: false },
    dayOfMonth: { type: String },

    default_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
    default_location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel' },
    default_created_by: { type: Schema.Types.ObjectId, ref: 'UserModel' },
    default_assigned_user: { type: Schema.Types.ObjectId, ref: 'UserModel' },
    prev_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
    prev_loc_id: { type: Schema.Types.ObjectId, ref: 'LocationModel' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' }
}, {
    collection: 'schedule_master',
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform(doc: any, ret: any) {
            ret.id = ret._id;
            delete ret._id;
            return ret;
        }
    }
});

export const SchedulerModel = mongoose.model<IScheduleMaster>('Schema_ScheduleMaster', ScheduleMasterSchema);