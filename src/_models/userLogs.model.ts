import mongoose, { Document, Schema } from 'mongoose';

export interface IUserLog extends Document {
    userId: mongoose.Types.ObjectId;
    userName: string;
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
    createdAt: Date;
}

const userLogSchema = new Schema<IUserLog>({
    userId: { type: Schema.Types.ObjectId, required: true },
    userName: { type: String, required: true },
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
        platform: { type: String },
        os: { type: String },
        architecture: { type: String }
    },
    browserInfo: {
        name: { type: String },
        version: { type: String },
        engine: { type: String }
    },
    deviceInfo: {
        isMobile: { type: Boolean },
        userAgent: { type: String }
    },
    networkInfo: {
        origin: { type: String },
        referer: { type: String },
        host: { type: String },
        connection: { type: String },
        contentLength: { type: Number },
        encoding: [{ type: String }],
        language: [{ type: String }]
    },
    requestMeta: {
        contentType: { type: String },
        accept: [{ type: String }],
        fetchMode: { type: String },
        fetchSite: { type: String },
        fetchDest: { type: String },
        dnt: { type: Boolean },
        secCHUA: [{ type: String }]
    },
    additionalData: {
        params: { type: Schema.Types.Mixed },
        body: { type: Schema.Types.Mixed },
        query: { type: Schema.Types.Mixed },
        durationMs: { type: Number }
    },
}, {
    collection: 'user_logs',
    timestamps: true,
    versionKey: false
});

export const UserLog = mongoose.model<IUserLog>('UserLog', userLogSchema);