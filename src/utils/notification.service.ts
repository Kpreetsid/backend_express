import { Server } from 'socket.io';
import { notificationRepository } from '../notification/notification.service';
import { Types } from 'mongoose';
import { UserModel } from '../models/user.model';
import { globalEmitter, Events } from '../utils/event-emitter';

export type NotificationEvent = 'created' | 'updated';

export interface AccountNotificationPayload {
  accountId: string;
  module: string;
  event: NotificationEvent;
  entityId: string;
  entityName?: string;
  actionUrl: string;
  queryParams?: Record<string, string>;
  sourceUserId?: string;
  type?: string;
  message?: string;
}

/**
 * NotificationService
 * A singleton service to manage real-time notifications via Socket.io and persist them in DB
 */
export class NotificationService {
  private static instance: NotificationService;
  private io: Server | null = null;

  private constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    globalEmitter.on(Events.NOTIFICATION_CREATED, async (payload: any) => {
      const { userId, type, message, data, companyId } = payload;
      await this.notifyUser(userId, type, message, data, companyId);
    });
  }

  public static getInstance(): NotificationService {

    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize the service with the Socket.io server instance
   * @param io Socket.io Server instance
   */
  public init(io: Server): void {
    this.io = io;
  }

  private buildMessage(moduleName: string, event: NotificationEvent, entityName?: string): string {
    const name = entityName || 'Record';
    return `${moduleName} "${name}" was ${event}.`;
  }

  private buildType(moduleName: string, event: NotificationEvent): string {
    return `${moduleName}_${event}`.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  }

  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    return id instanceof Types.ObjectId ? id : new Types.ObjectId(id);
  }

  private emitNotification(userId: string, notification: any, type: string, message: string, metadata: any): void {
    if (!this.io) return;
    this.io.to(userId).emit('notification', {
      id: notification._id,
      _id: notification._id,
      type,
      message,
      metadata,
      data: metadata,
      status: notification.status,
      createdAt: notification.createdAt,
      timestamp: notification.createdAt || new Date()
    });
  }

  /**
   * Emit a notification to a specific user's room and persist it
   * @param userId The ID of the user to notify
   * @param type Notification type (e.g., 'WORK_ORDER_ASSIGNED')
   * @param message The display message
   * @param data Optional metadata (entity IDs, redirect paths, etc.)
   * @param companyId Optional company ID for filtering
   */
  public async notifyUser(userId: string, type: string, message: string, data: any = {}, companyId?: string): Promise<void> {
    if (!this.io) {
      console.warn('NotificationService: Socket.io not initialized.');
      return;
    }

    // 1. Persist in DB (Status: Sent)
    const notification = await notificationRepository.create({
      targetUser: new Types.ObjectId(userId),
      account_id: companyId ? new Types.ObjectId(companyId) : undefined,
      type,
      message,
      metadata: data
    });

    // 2. Emit via socket
    this.emitNotification(userId.toString(), notification, type, message, data);

    // 3. Update status to Delivered
    await notificationRepository.updateStatus(notification._id.toString(), 'Delivered');
  }

  /**
   * Emit a notification to an entire company (account-wide) and persist for all active users in that company
   * @param companyId The ID of the company/account
   * @param type Notification type
   * @param message The display message
   * @param data Optional metadata
   */
  public async notifyCompany(companyId: string, type: string, message: string, data: any = {}): Promise<void> {
    if (!this.io) {
      console.warn('NotificationService: Socket.io not initialized.');
      return;
    }

    try {
      // 1. Get all active users in this company
      const users = await UserModel.find({
        account_id: new Types.ObjectId(companyId),
        user_status: 'active'
      }).select('_id');

      if (!users || users.length === 0) return;

      // 2. Bulk Persist in DB
      const notificationData = users.map(user => ({
        targetUser: user._id,
        account_id: new Types.ObjectId(companyId),
        type,
        message,
        metadata: data
      }));

      const createdNotifications = await notificationRepository.createMany(notificationData);

      // 3. Emit the matching notification id to each user's socket room.
      await Promise.all(createdNotifications.map(async (notification: any) => {
        this.emitNotification(notification.targetUser.toString(), notification, type, message, data);
        await notificationRepository.updateStatus(notification._id.toString(), 'Delivered');
      }));

    } catch (error) {
      console.error('Error in notifyCompany:', error);
    }
  }

  public async notifyAccountUsers(payload: AccountNotificationPayload): Promise<void> {
    if (!this.io) {
      console.warn('NotificationService: Socket.io not initialized.');
      return;
    }

    const message = payload.message || this.buildMessage(payload.module, payload.event, payload.entityName);
    const type = payload.type || this.buildType(payload.module, payload.event);
    const metadata = {
      module: payload.module,
      event: payload.event,
      entityId: payload.entityId,
      entityName: payload.entityName,
      actionUrl: payload.actionUrl,
      queryParams: payload.queryParams || {},
      sourceUserId: payload.sourceUserId
    };

    const users = await UserModel.find({
      account_id: this.toObjectId(payload.accountId),
      user_status: 'active'
    }).select('_id');

    if (!users.length) return;

    const notifications = await notificationRepository.createMany(users.map(user => ({
      targetUser: user._id,
      account_id: this.toObjectId(payload.accountId),
      type,
      message,
      metadata
    })));

    await Promise.all(notifications.map(async (notification: any) => {
      this.emitNotification(notification.targetUser.toString(), notification, type, message, metadata);
      await notificationRepository.updateStatus(notification._id.toString(), 'Delivered');
    }));
  }

  /**
   * Send a private chat message to a user
   */
  public sendPrivateMessage(toUserId: string, fromUser: any, message: string): void {
    if (!this.io) return;
    this.io.to(toUserId.toString()).emit('private_chat', {
      fromUser,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Get all unique online user IDs in a company
   * @param companyId Company ID
   */
  public async getOnlineUsers(companyId: string): Promise<string[]> {
    if (!this.io) return [];
    const sockets = await this.io.in(companyId.toString()).fetchSockets();
    const userIds = sockets.map(s => s.data.user.id);
    return [...new Set(userIds)];
  }

  /**
   * Broadcast a notification to all connected users
   */
  public broadcast(type: string, message: string, data: any = {}): void {
    if (!this.io) return;
    this.io.emit('notification', {
      type,
      message,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Join a room (e.g., location-based room)
   */
  public joinRoom(socketId: string, roomName: string): void {
    if (!this.io) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(roomName);
    }
  }

  /**
   * Mark a notification as reached by the client
   * @param notificationId The ID of the notification
   * @param userId The ID of the user who received it
   */
  public async markAsReached(notificationId: string, userId: string): Promise<void> {
    await notificationRepository.updateStatus(notificationId, 'Reached', userId);
  }
}

export const notificationService = NotificationService.getInstance();
