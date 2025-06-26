import mongoose, { Schema, Document } from 'mongoose';

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
    status: { type: String, enum: ['success', 'failed'], required: true },
    messageId: { type: String },
    mailInfo: { type: Object },
    error: { type: String },
}, {
    collection: 'mail_logs',
    timestamps: true,
    versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

export const MailLogModel = mongoose.model<IMailLog>('MailLog', mailLogSchema);

export const createMailLog = async (mailLog: Partial<IMailLog>) => await new MailLogModel(mailLog).save();