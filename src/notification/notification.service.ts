import { Notification, INotification, NotificationStatus } from '../models/notification.model';
import { Types } from 'mongoose';

const previousStatuses: Record<Exclude<NotificationStatus, 'Sent'>, NotificationStatus[]> = {
  Delivered: ['Sent'],
  Reached: ['Sent', 'Delivered'],
  Opened: ['Sent', 'Delivered', 'Reached']
};

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

  async updateStatus(id: string, status: Exclude<NotificationStatus, 'Sent'>, userId?: string) {
    if (!Types.ObjectId.isValid(id) || (userId && !Types.ObjectId.isValid(userId))) {
      return null;
    }

    const match: any = { _id: id };
    if (userId) {
      match.targetUser = new Types.ObjectId(userId);
    }

    const updated = await Notification.findOneAndUpdate(
      { ...match, status: { $in: previousStatuses[status] } },
      {
        $set: { status },
        $push: { statusHistory: { status, timestamp: new Date(), userId: userId ? new Types.ObjectId(userId) : undefined } }
      },
      { returnDocument: 'after' }
    );

    // Status changes are idempotent and monotonic. Returning the current record keeps
    // repeated Opened/Reached acknowledgements successful without regressing state.
    return updated || await Notification.findOne(match);
  }

  async getUserNotifications(userId: string, limit: number = 25, skip: number = 0) {
    const match = { targetUser: new Types.ObjectId(userId) };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(match),
      Notification.countDocuments({ ...match, status: { $ne: 'Opened' } })
    ]);

    return { notifications, total, unreadCount };
  }

  async markManyAsDelivered(ids: string[]) {
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (!objectIds.length) return null;

    return await Notification.updateMany(
      { _id: { $in: objectIds }, status: 'Sent' },
      {
        $set: { status: 'Delivered' },
        $push: { statusHistory: { status: 'Delivered', timestamp: new Date() } }
      }
    );
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
