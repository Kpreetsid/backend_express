import mongoose, { Document, ObjectId, Schema } from 'mongoose';

export interface IUserLog extends Document {
    userId: ObjectId;
    userName: string;
    accountId: ObjectId;
    method: string;
    module: string;
    description: string;
    statusCode: number;
    requestUrl: string;
    host: string;
    hostName: string;
    protocol: string;
    port: number;
    ipAddress: string;
    userAgent: string;
    systemInfo: {
        platform: string;
        os: string;
        architecture: string;
    };
    browserInfo: {
        name: string;
        version: string;
        engine: string;
    };
    deviceInfo: {
        isMobile: boolean;
        userAgent: string;
    };
    networkInfo: {
        origin?: string;
        referer?: string;
        host?: string;
        connection?: string;
        contentLength: number;
        encoding?: string[];
        language?: string[];
    };
    requestMeta: {
        contentType?: string;
        accept?: string[];
        fetchMode?: string;
        fetchSite?: string;
        fetchDest?: string;
        dnt?: boolean;
        secCHUA?: string[];
    };
    additionalData: {
        params: Record<string, any>;
        body: Record<string, any>;
        query: Record<string, any>;
        durationMs: number;
    };
    isFromMobile(): boolean;
}

const userLogSchema = new Schema<IUserLog>({
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    userName: { type: String, required: true },
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    method: { type: String, required: true },
    module: { type: String, required: true },
    description: { type: String, required: true },
    statusCode: { type: Number, required: true },
    requestUrl: { type: String, required: true },
    host: { type: String, required: true },
    hostName: { type: String, required: true },
    protocol: { type: String, required: true },
    port: { type: Number, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },

    systemInfo: {
        platform: String,
        os: String,
        architecture: String
    },
    browserInfo: {
        name: String,
        version: String,
        engine: String
    },
    deviceInfo: {
        isMobile: Boolean,
        userAgent: String
    },
    networkInfo: {
        origin: String,
        referer: String,
        host: String,
        connection: String,
        contentLength: Number,
        encoding: [String],
        language: [String]
    },
    requestMeta: {
        contentType: String,
        accept: [String],
        fetchMode: String,
        fetchSite: String,
        fetchDest: String,
        dnt: Boolean,
        secCHUA: [String]
    },
    additionalData: {
        params: Schema.Types.Mixed,
        body: Schema.Types.Mixed,
        query: Schema.Types.Mixed,
        durationMs: Number
    }
}, {
    collection: 'user_logs',
    versionKey: false,         // No __v
    timestamps: true,          // Adds createdAt and updatedAt
    toJSON: {
        virtuals: true,
        transform: (_, ret) => {
            ret.id = ret._id;
            delete ret._id;
            return ret;
        }
    },
    toObject: {
        virtuals: true,
        transform: (_, ret) => {
            ret.id = ret._id;
            delete ret._id;
            return ret;
        }
    }
});

// Virtual field: isSuccess
userLogSchema.virtual('isSuccess').get(function () {
    return this.statusCode >= 200 && this.statusCode < 300;
});

// Instance method
userLogSchema.methods.isFromMobile = function () {
    return this.deviceInfo?.isMobile || false;
};

// Static method
userLogSchema.statics.findByUserId = function (userId: string) {
    return this.find({ userId: new mongoose.Types.ObjectId(userId) });
};

export const UserLog = mongoose.model<IUserLog>('UserLog', userLogSchema);

export const getAllUserLog = async (accountId: string) => await UserLog.find({ account_id: accountId }).lean();

export const getUserLogById = async (id: string) => await UserLog.findById(id);

export const getUserLogByFilter = async (accountId: string, filter: any) => await UserLog.find({ account_id: accountId, ...filter, visible: true }).lean();

export const createUserLog = async (log: IUserLog) => await UserLog.create(log);

export const updateUserLog = async (id: string, user: IUserLog) => await UserLog.findByIdAndUpdate({ id }, { $set: user });

export const deleteUserLog = async (id: string) => await UserLog.findByIdAndUpdate({ _id: id }, { $set: { visible: false } });
