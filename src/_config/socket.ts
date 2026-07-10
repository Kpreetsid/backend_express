import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { cookieAuth } from '../configDB';
import { notificationService } from '../utils/notification.service';
import { isOriginAllowed } from './cors';
import { authenticateTokenContext } from './auth';
import { LEGACY_ACCESS_COOKIE_NAME, LEGACY_ACCOUNT_COOKIE_NAME } from '../user/authentication/authCookie.service';
import { cookieService } from '../utils/cookie';

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
  io.use(async (socket: Socket, next) => {
    const cookies = cookieService.parseHeader(socket.handshake.headers.cookie);
    const authHeader = String(socket.handshake.headers.authorization || '');
    const token = socket.handshake.auth.token
      || (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '')
      || cookieService.getFromRecord(cookies, [cookieAuth.accessCookieName, LEGACY_ACCESS_COOKIE_NAME]);
    const accountId = socket.handshake.auth.accountId
      || socket.handshake.headers['accountid']
      || cookieService.getFromRecord(cookies, [cookieAuth.accountCookieName, LEGACY_ACCOUNT_COOKIE_NAME]);

    if (!token || !accountId) {
      return next(new Error('Authentication error: Token and Account ID required'));
    }

    try {
      const context = await authenticateTokenContext(String(token), String(accountId));

      // Attach user info to socket
      socket.data.user = context.decoded;
      socket.data.accountId = context.accountId;
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
