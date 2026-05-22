import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { auth } from '../configDB';
import { notificationService } from '../utils/notification.service';
import { isOriginAllowed } from './cors';

/**
 * Initialize Socket.io server
 * @param httpServer The HTTP server instance
 */
export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin is not allowed by Socket.io CORS policy'));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true
    }
  });

  // Authentication Middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
    const accountId = socket.handshake.auth.accountId || socket.handshake.headers['accountid'];

    if (!token || !accountId) {
      return next(new Error('Authentication error: Token and Account ID required'));
    }

    try {
      const decoded: any = jwt.verify(token, auth.secret, {
        algorithms: [auth.algorithm as jwt.Algorithm],
        issuer: auth.issuer,
        audience: auth.audience
      });

      // Attach user info to socket
      socket.data.user = decoded;
      socket.data.accountId = accountId;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user.id;
    const accountId = socket.data.accountId;

    console.log(`User connected: ${userId} (Account: ${accountId})`);

    // Join User-specific room
    socket.join(userId.toString());
    
    // Join Company-specific room (Account-based)
    socket.join(accountId.toString());

    // Send initial list of online users to the connecting user
    notificationService.getOnlineUsers(accountId.toString()).then(userIds => {
      socket.emit('initial_online_users', userIds);
    });

    // Broadcast "User Online" to others in the same company
    socket.to(accountId.toString()).emit('user_status', { userId, status: 'online' });

    // Handle Company Chat
    socket.on('company_chat', (payload: { message: string }) => {
      io.to(accountId.toString()).emit('company_chat', {
        fromUser: socket.data.user,
        message: payload.message,
        timestamp: new Date()
      });
    });

    // Handle "Notification Reached" acknowledgment from client
    socket.on('notification_reached', async (payload: { notificationId: string }) => {
      try {
        const userId = socket.data.user.id;
        await notificationService.markAsReached(payload.notificationId, userId);
        console.log(`Notification ${payload.notificationId} reached user ${userId}`);
      } catch (err) {
        console.error('Error marking notification as reached:', err);
      }
    });

    // Handle Collaborative Editing
    socket.on('start_editing', (payload: { entityType: string, entityId: string }) => {
      socket.to(accountId.toString()).emit('editing_status', {
        userId,
        status: 'editing',
        entityType: payload.entityType,
        entityId: payload.entityId
      });
    });

    socket.on('stop_editing', (payload: { entityType: string, entityId: string }) => {
      socket.to(accountId.toString()).emit('editing_status', {
        userId,
        status: 'idle',
        entityType: payload.entityType,
        entityId: payload.entityId
      });
    });

    // Handle Location-Scoped Alerting
    socket.on('join_location_room', (locationId: string) => {
      socket.join(`location_${locationId}`);
      console.log(`User ${userId} joined location room: location_${locationId}`);
    });

    socket.on('leave_location_room', (locationId: string) => {
      socket.leave(`location_${locationId}`);
      console.log(`User ${userId} left location room: location_${locationId}`);
    });

    // Handle Live Asset Telemetry
    socket.on('asset_telemetry_update', (payload: { assetId: string, data: any }) => {
      io.to(`asset_${payload.assetId}`).emit('telemetry_data', {
        assetId: payload.assetId,
        data: payload.data,
        timestamp: new Date()
      });
    });

    // Handle Interactive Checklists
    socket.on('checklist_update', (payload: { workOrderId: string, taskId: string, completed: boolean }) => {
      io.to(`wo_${payload.workOrderId}`).emit('checklist_sync', {
        userId,
        taskId: payload.taskId,
        completed: payload.completed
      });
    });

    // Handle Technician Tracking
    socket.on('update_location', (payload: { lat: number, lng: number }) => {
      io.to(accountId.toString()).emit('technician_location_update', {
        userId,
        lat: payload.lat,
        lng: payload.lng,
        timestamp: new Date()
      });
    });

    // Handle Admin Broadcasts
    socket.on('admin_broadcast', (payload: { message: string, priority: 'high' | 'medium' | 'low' }) => {
      // Verify if user is admin (simplified check)
      if (socket.data.user.role === 'admin') {
        io.emit('system_announcement', {
          message: payload.message,
          priority: payload.priority,
          timestamp: new Date()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      // Broadcast "User Offline" to others in the same company
      io.to(accountId.toString()).emit('user_status', { userId, status: 'offline' });
    });
  });

  // Initialize the singleton service with this io instance
  notificationService.init(io);

  return io;
};
