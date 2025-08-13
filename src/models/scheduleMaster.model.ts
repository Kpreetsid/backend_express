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
    wo_asset_id: string;
    wo_location_id: string;
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
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
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
        title: { type: String },
        description: { type: String },
        start_date: String,
        days_to_complete: Number,
        schedule_mode: String,
        work_order: Object,
        rescheduleEnabled: Boolean,
        no_of_time_call: Number,
        visible: Boolean,
        account_id: mongoose.Types.ObjectId,
        rescheduleWeekDays: Number,
        monday: Boolean,
        tuesday: Boolean,
        wednesday: Boolean,
        thursday: String,
        friday: String,
        saturday: String,
        sunday: String,
        location: [Object],
        asset: [Object],
        prev_asset_id: mongoose.Types.ObjectId,
        prev_loc_id: mongoose.Types.ObjectId,
        month: Number,
        dayOfMonth: String,
        next_execute_date: String
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

export const ScheduleMasterModel = mongoose.model<IScheduleMaster>("Preventive", ScheduleMasterSchema);
