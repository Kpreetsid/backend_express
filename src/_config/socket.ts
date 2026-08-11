import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { cookieAuth } from '../configDB';
import { notificationService } from '../utils/notification.service';
import { isOriginAllowed } from './cors';
import { authenticateTokenContext } from './auth';
import { LEGACY_ACCESS_COOKIE_NAME, LEGACY_ACCOUNT_COOKIE_NAME } from '../user/authentication/authCookie.service';
import { cookieService } from '../utils/cookie';

let socketServer: Server | null = null;

const accountRoom = (accountId: string): string => `account:${accountId}`;

export const emitAccountPermissionsChanged = (accountId: string, accountPermissionVersion: number): boolean => {
  if (!socketServer) {
    return false;
  }
  socketServer.to(accountRoom(accountId)).emit('account_permissions_changed', { accountPermissionVersion });
  return true;
};

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
  socketServer = io;

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
    const userName = socket.data.user.username || socket.data.user.email || userId;
    const connectionUrl = socket.handshake.url;
    const connectedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    console.log(`Notification socket connected: ${userName} (Account: ${accountId})`);
    console.log(`${connectedAt} | CONNECTED | ${userId} | ${userName} | SOCKET_CONNECT | WS | - ms | ${connectionUrl}`);

    // Notification delivery is user-scoped. Account-wide events are expanded to user rooms
    // by NotificationService when a server-side API action creates notifications.
    socket.join(userId.toString());
    socket.join(accountRoom(String(accountId)));

    // Handle "Notification Reached" acknowledgment from client
    socket.on('notification_reached', async (payload: { notificationId: string }) => {
      try {
        const userId = socket.data.user.id;
        await notificationService.markAsReached(payload.notificationId, userId);
        const acknowledgedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        console.log(`${acknowledgedAt} | ACKNOWLEDGED | ${userId} | ${userName} | NOTIFICATION_REACHED | WS | - ms | payload: ${payload.notificationId}`);
      } catch (err) {
        console.error('Error marking notification as reached:', err);
      }
    });

    socket.on('disconnect', () => {
      const disconnectedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      console.log(`${disconnectedAt} | DISCONNECTED | ${userId} | ${userName} | SOCKET_DISCONNECT | WS | - ms | ${connectionUrl}`);
    });
  });

  // Initialize the singleton service with this io instance
  notificationService.init(io);

  return io;
};
