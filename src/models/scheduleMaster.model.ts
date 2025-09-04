import mongoose, { Document, ObjectId, Schema } from "mongoose";

interface PhoneNumber {
    number: string;
    internationalNumber: string;
    nationalNumber: string;
    e164Number: string;
    countryCode: string;
    dialCode: string;
}

interface User {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    emailStatus: boolean;
    user_status: string;
    user_role: string;
    createdOn: Date;
    id: string;
    account_id: string;
    phone_no?: PhoneNumber;
    isFirstUser?: boolean;
    address?: string;
    pincode?: string;
    user_profile_img?: string;
    mobileNumber?: PhoneNumber;
    userrole?: string;
    userstatus?: string;
}

interface Location {
    location_name: string;
    description: string;
    location_type: string;
    top_level: boolean;
    assigned_to: string;
    visible: boolean;
    id: string;
    account_id: string;
    userId: string;
    top_level_location_id: string;
    teamId?: string | null;
    userName: string;
    top_level_location_image: string;
    image_path: string;
    location: string;
    qr_code: string;
}

interface AssetLocationData {
    location_name: string;
    id: string;
    assigned_to: string;
}

interface Asset {
    asset_name: string;
    asset_id: string;
    top_level: boolean;
    locationId: string;
    visible: boolean;
    id: string;
    account_id: string;
    top_level_asset_id: string;
    description: string;
    model: string;
    manufacturer: string;
    asset_type: string;
    year: string;
    teamId: string;
    assigned_to: number;
    locationData: AssetLocationData[];
    locationName: string;
    timestamp: string;
    childs: any[];
    location: {
        location_name: string;
        id: string;
    };
}

interface WorkOrder {
    title: string;
    description: string;
    estimated_time: string;
    priority: string;
    status: string;
    nature_of_work: string;
    account_id: string;
    assigned_to: number;
    asset_id: string;
    location_id: string;
    created_by: string;
    sopForm: any;
    userId: User[];
    workInstruction: any;
    estimatedParts: any[];
    actualParts: any[];
    createdFrom?: string;
}

export interface IScheduleMaster extends Document {
    title: string;
    description: string;
    start_date: string;
    days_to_complete: number;
    schedule_mode: string;
    work_order: WorkOrder;
    rescheduleEnabled: boolean;
    no_of_time_call: number;
    visible: boolean;
    account_id: ObjectId;
    rescheduleWeekDays?: number;
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    saturday?: boolean;
    sunday?: boolean;
    location?: Location[];
    asset?: Asset[];
    prev_asset_id?: ObjectId;
    prev_loc_id?: ObjectId;
    month?: number;
    dayOfMonth?: string;
    next_execute_date?: string;
}

const ScheduleMasterSchema = new Schema<IScheduleMaster>(
    {
        account_id: { type: mongoose.Types.ObjectId, ref: "AccountModel", required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        start_date: { type: String, required: true },
        days_to_complete: { type: Number, required: true },
        schedule_mode: { type: String, required: true },
        work_order: { type: Object, required: true },
        rescheduleEnabled: { type: Boolean, default: false },
        no_of_time_call: { type: Number, default: 1 },
        visible: { type: Boolean, default: true },
        rescheduleWeekDays: { type: Number },
        monday: { type: Boolean, default: false },
        tuesday: { type: Boolean, default: false },
        wednesday: { type: Boolean, default: false },
        thursday: { type: Boolean, default: false },
        friday: { type: Boolean, default: false },
        saturday: { type: Boolean, default: false },
        sunday: { type: Boolean, default: false },
        prev_asset_id: { type: mongoose.Types.ObjectId },
        prev_loc_id: { type: mongoose.Types.ObjectId },
        month: { type: Number },
        dayOfMonth: { type: String },
        next_execute_date: { type: String }
    },
    {
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
        },
        toObject: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                return ret;
            }
        }
    }
);

export const SchedulerModel = mongoose.model<IScheduleMaster>("Schema_Schedule", ScheduleMasterSchema);
