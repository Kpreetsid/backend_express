import mongoose, { Document, ObjectId, Schema } from 'mongoose';

export interface IUserLog extends Document {
    userId: ObjectId;
    userName: string;
    account_id: ObjectId;
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
        params: Record<string, any>;
        body: Record<string, any>;
        query: Record<string, any>;
        durationMs: number;
    };
    isFromMobile(): boolean;
}

const userLogSchema = new Schema<IUserLog>({
    userId: { type: Schema.Types.ObjectId, ref: 'UserModel' },
    userName: { type: String, trim: true, required: true },
    account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel' },
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
        params: Schema.Types.Mixed,
        body: Schema.Types.Mixed,
        query: Schema.Types.Mixed,
        durationMs: Number
    }
}, {
    collection: 'user_logs',
    versionKey: false,
    timestamps: true,
  toJSON: {
    virtuals: true,
    transform(doc: any, ret: any) {
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

export const UserLogModel = mongoose.model<IUserLog>('Schema_UserLog', userLogSchema);
