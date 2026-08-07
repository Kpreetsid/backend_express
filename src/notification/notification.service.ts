import { Notification, INotification } from '../models/notification.model';
import { Types } from 'mongoose';

export class NotificationRepository {
  async create(data: Partial<INotification>) {
    const notification = new Notification({
      ...data,
      status: 'Sent',
      statusHistory: [{ status: 'Sent', timestamp: new Date() }]
    });
    return await notification.save();
  }

  async createMany(dataArray: Partial<INotification>[]) {
    const notifications = dataArray.map(data => new Notification({
      ...data,
      status: 'Sent',
      statusHistory: [{ status: 'Sent', timestamp: new Date() }]
    }));
    return await Notification.insertMany(notifications);
  }

  async updateStatus(id: string, status: 'Delivered' | 'Reached' | 'Opened', userId?: string) {
    const match: any = { _id: id };
    if (userId) {
      match.targetUser = new Types.ObjectId(userId);
    }
    return await Notification.findOneAndUpdate(
      match,
      {
        $set: { status },
        $push: { statusHistory: { status, timestamp: new Date(), userId: userId ? new Types.ObjectId(userId) : undefined } }
      },
      { returnDocument: 'after' }
    );
  }

  async getUserNotifications(userId: string, limit: number = 50, skip: number = 0) {
    return await Notification.find({ targetUser: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async markAllAsOpened(userId: string) {
    return await Notification.updateMany(
      { targetUser: userId, status: { $ne: 'Opened' } },
      {
        $set: { status: 'Opened' },
        $push: { statusHistory: { status: 'Opened', timestamp: new Date(), userId: new Types.ObjectId(userId) } }
      }
    );
  }
}

export const notificationRepository = new NotificationRepository();
