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
  to: { type: String, trim: true, required: true },
  subject: { type: String, trim: true, required: true },
  html: { type: String, trim: true, required: true },
  status: { type: String, trim: true, enum: MAIL_LOG_STATUSES, required: true },
  messageId: { type: String, trim: true },
  mailInfo: { type: Object },
  error: { type: String, trim: true },
}, {
  collection: 'mail_logs',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc: any, ret: any) {
      ret.id = ret._id;
      delete (ret as any)._id;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function (doc: any, ret: any) {
      ret.id = ret._id;
      delete (ret as any)._id;
      return ret;
    }
  }
});

export const MailLogModel = mongoose.model<IMailLog>('Schema_MailLog', mailLogSchema);

export const createMailLog = async (mailLog: Partial<IMailLog>) => await new MailLogModel(mailLog).save();