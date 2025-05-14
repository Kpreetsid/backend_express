import mongoose, { Document, Schema } from 'mongoose';

export interface IUserLog extends Document {
    userId: mongoose.Types.ObjectId;
    userName: string;
    module: string; // e.g., 'ASSET', 'AUTH', 'ACCOUNT'
    description: string; // Summary of what happened
    method: string; // HTTP method: GET, POST, PUT, DELETE
    statusCode: number;
    host: string;
    protocol: string; // HTTP or HTTPS
    port: number; // Port number
    hostName: string; // Hostname from headers
    requestUrl: string;
    ipAddress: string;
    userAgent: string;
    additionalData?: any;
    systemInfo: object;
    browserInfo: object;
    deviceInfo: object;
    networkInfo: object;
    requestMeta: object;
}

const userLogSchema: Schema<IUserLog> = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    module: { type: String, required: true },
    description: { type: String, required: true },
    method: { type: String },
    statusCode: { type: Number },
    host: { type: String },
    protocol: { type: String },
    port: { type: Number },
    hostName: { type: String },
    requestUrl: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    systemInfo: { type: Schema.Types.Mixed }, 
    browserInfo: { type: Schema.Types.Mixed }, // optional flexible data object,
    deviceInfo: { type: Schema.Types.Mixed }, // optional flexible data object,
    networkInfo: { type: Schema.Types.Mixed }, // optional flexible data object,
    requestMeta: { type: Schema.Types.Mixed }, // optional flexible data object
    additionalData: { type: Schema.Types.Mixed }, // optional flexible data
}, {
    collection: 'user_logs',
    timestamps: true
});

export const UserLog = mongoose.model<IUserLog>('UserLogs', userLogSchema);