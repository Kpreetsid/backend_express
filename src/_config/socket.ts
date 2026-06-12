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

    console.log(`Notification socket connected: ${userId} (Account: ${accountId})`);

    // Notification delivery is user-scoped. Account-wide events are expanded to user rooms
    // by NotificationService when a server-side API action creates notifications.
    socket.join(userId.toString());

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

    socket.on('disconnect', () => {
      console.log(`Notification socket disconnected: ${userId}`);
    });
  });

  // Initialize the singleton service with this io instance
  notificationService.init(io);

  return io;
};
