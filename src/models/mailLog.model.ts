import mongoose, { Schema, Document } from 'mongoose';

export const MAIL_LOG_STATUSES = ['success', 'failed'];

export interface IMailLog extends Document {
  to: string;
  subject: string;
  html: string;
  status: 'success' | 'failed';
  messageId?: string;
  mailInfo?: Record<string, any>;
  error?: string;
}

const mailLogSchema = new Schema<IMailLog>({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  html: { type: String, required: true },
  status: { type: String, enum: MAIL_LOG_STATUSES, required: true },
  messageId: { type: String },
  mailInfo: { type: Object },
  error: { type: String },
}, {
  collection: 'mail_logs',
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
});

export const MailLogModel = mongoose.model<IMailLog>('Schema_MailLog', mailLogSchema);

export const createMailLog = async (mailLog: Partial<IMailLog>) => await new MailLogModel(mailLog).save();