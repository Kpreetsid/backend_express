import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';
import { auditConfig } from '../configDB';

export interface IUserLog extends Document {
    account_id: ObjectId;
    userId: ObjectId;
    userName: string;
    pageUrl: string;
    moduleName: string;
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
        isTablet: boolean;
        isDesktop: boolean;
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
        correlationId?: string;
        params: Record<string, any>;
        body: Record<string, any>;
        query: Record<string, any>;
        durationMs: number;
    };
    isFromMobile(): boolean;
}

const userLogSchema = new Schema<IUserLog>({
    account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel' },
    userId: { type: Schema.Types.ObjectId, ref: 'UserModel' },
    pageUrl: { type: String, trim: true },
    moduleName: { type: String, trim: true },
    userName: { type: String, trim: true },
    method: { type: String, trim: true, required: true },
    module: { type: String, trim: true, required: true },
    description: { type: String, trim: true, required: true },
    statusCode: { type: Number, required: true },
    requestUrl: { type: String, trim: true, required: true },
    host: { type: String, trim: true, required: true },
    hostName: { type: String, trim: true, required: true },
    protocol: { type: String, trim: true, required: true },
    port: { type: Number, required: true },
    ipAddress: { type: String, trim: true, required: true },
    userAgent: { type: String, trim: true, required: true },

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
        isTablet: Boolean,
        isDesktop: Boolean,
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
        correlationId: String,
        params: Schema.Types.Mixed,
        body: Schema.Types.Mixed,
        query: Schema.Types.Mixed,
        durationMs: Number
    }
}, {
    collection: 'user_logs',
    versionKey: false,
    timestamps: true
});

userLogSchema.virtual('isSuccess').get(function (this: IUserLog) {
    return this.statusCode >= 200 && this.statusCode < 300;
});

userLogSchema.methods['isFromMobile'] = function (this: IUserLog) {
    return this.deviceInfo?.isMobile || false;
};

userLogSchema.statics['findByUserId'] = function (userId: string) {
    return this.find({ userId: new mongoose.Types.ObjectId(userId) });
};

userLogSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: auditConfig.userLogRetentionDays * 24 * 60 * 60 }
);

export const UserLogModel = mongoose.model<IUserLog>('Schema_UserLog', userLogSchema);
