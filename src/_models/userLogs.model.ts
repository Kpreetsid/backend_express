import mongoose, { Document, Schema } from 'mongoose';

export interface IUserLog extends Document {
    userId: mongoose.Types.ObjectId;
    userName: string;
    action: string; // e.g., 'LOGIN', 'CREATE_ASSET', 'UPDATE_PROFILE'
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
    timestamp: Date;
    additionalData?: any; // for storing raw request body, params, etc.
}

const userLogSchema: Schema<IUserLog> = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true },
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
    timestamp: { type: Date, default: Date.now },
    additionalData: { type: Schema.Types.Mixed }, // optional flexible data
}, {
    collection: 'user_logs',
    timestamps: { createdAt: true, updatedAt: false }
});

export const UserLog = mongoose.model<IUserLog>('UserLogs', userLogSchema);