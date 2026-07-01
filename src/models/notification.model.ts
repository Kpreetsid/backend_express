import { Schema, model, Document, Types } from 'mongoose';
export const NOTIFICATION_COLLECTION_NAME = 'notification';


export interface INotification {
  message: string;
  type: string;
  targetUser: Types.ObjectId;
  account_id?: Types.ObjectId;
  metadata: {
    module?: string;
    event?: 'created' | 'updated';
    entityId?: string;
    entityName?: string;
    actionUrl?: string;
    queryParams?: Record<string, string>;
    sourceUserId?: string;
    [key: string]: any;
  };
  status: 'Sent' | 'Delivered' | 'Reached' | 'Opened';
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    userId?: Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

const NotificationSchema = new Schema({
  message: { type: String, required: true },
  type: { type: String, required: true },
  targetUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  account_id: { type: Schema.Types.ObjectId, ref: 'Company' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['Sent', 'Delivered', 'Reached', 'Opened'],
    default: 'Sent'
  },
  statusHistory: [{
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    userId: { type: Schema.Types.ObjectId, ref: 'User' }
  }, {versionKey: false}]
}, { 
  collection: NOTIFICATION_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
 });

NotificationSchema.index({ targetUser: 1, createdAt: -1 });
NotificationSchema.index({ account_id: 1, createdAt: -1 });

export const Notification = model<INotificationDocument>('Notification', NotificationSchema);
