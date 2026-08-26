import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { cookieAuth } from '../configDB';
import { notificationService } from '../utils/notification.service';
import { isOriginAllowed } from './cors';
import { authenticateTokenContext } from './auth';
import { LEGACY_ACCESS_COOKIE_NAME, LEGACY_ACCOUNT_COOKIE_NAME } from '../user/authentication/authCookie.service';
import { cookieService } from '../utils/cookie';

export const notificationSocketMetrics = {
  activeConnections: 0,
  pollingConnections: 0,
  websocketConnections: 0,
  totalConnections: 0,
  totalConnectionErrors: 0
};

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
    serveClient: false,
    maxHttpBufferSize: 100_000,
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
      socket.data.user = { ...context.decoded, username: context.userData.username || context.decoded.username };
      socket.data.accountId = context.accountId;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.engine.on('connection_error', (error: any) => {
    notificationSocketMetrics.totalConnectionErrors += 1;
    console.error('Notification socket transport error:', error.code, error.message);
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user.id;
    const accountId = socket.data.accountId;
    const userName = socket.data.user.username || socket.data.user.email || userId;
    const connectionUrl = socket.handshake.url;
    let transportName = socket.conn.transport.name;
    notificationSocketMetrics.activeConnections += 1;
    notificationSocketMetrics.totalConnections += 1;
    notificationSocketMetrics[transportName === 'websocket' ? 'websocketConnections' : 'pollingConnections'] += 1;

    const connectedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`Notification socket connected: ${userName} (Account: ${accountId})`);
    console.log(`${connectedAt} | CONNECTED | ${userId} | ${userName} | SOCKET_CONNECT | WS | - ms | ${connectionUrl}`);

    // Notification delivery is user-scoped. Account-wide events are expanded to user rooms
    // by NotificationService when a server-side API action creates notifications.
    socket.join(userId.toString());
    socket.join(accountRoom(String(accountId)));

    socket.conn.once('upgrade', () => {
      if (transportName === 'polling') {
        notificationSocketMetrics.pollingConnections = Math.max(0, notificationSocketMetrics.pollingConnections - 1);
      }
      transportName = socket.conn.transport.name;
      if (transportName === 'websocket') {
        notificationSocketMetrics.websocketConnections += 1;
      }
    });

    // Handle "Notification Reached" acknowledgment from client
    socket.on('notification_reached', async (
      payload: { notificationId?: string },
      acknowledge?: (result: { success: boolean; message?: string }) => void
    ) => {
      try {
        const notificationId = payload?.notificationId;
        if (!notificationId) {
          acknowledge?.({ success: false, message: 'Invalid notification ID' });
          return;
        }
        const updated = await notificationService.markAsReached(notificationId, userId);
        if (!updated) {
          acknowledge?.({ success: false, message: 'Notification not found' });
          return;
        }
        const acknowledgedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        console.log(`${acknowledgedAt} | ACKNOWLEDGED | ${userId} | ${userName} | NOTIFICATION_REACHED | WS | - ms | payload: ${notificationId}`);
        acknowledge?.({ success: true });
      } catch (err) {
        console.error('Error marking notification as reached:', err);
        acknowledge?.({ success: false, message: 'Unable to acknowledge notification' });
      }
    });

    socket.on('disconnect', (reason) => {
      notificationSocketMetrics.activeConnections = Math.max(0, notificationSocketMetrics.activeConnections - 1);
      const metricKey = transportName === 'websocket' ? 'websocketConnections' : 'pollingConnections';
      notificationSocketMetrics[metricKey] = Math.max(0, notificationSocketMetrics[metricKey] - 1);

      const disconnectedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      console.log(`${disconnectedAt} | DISCONNECTED | ${userId} | ${userName} | SOCKET_DISCONNECT | ${transportName} | - ms | ${connectionUrl} | reason: ${reason}`);
    });
  });

  // Initialize the singleton service with this io instance
  notificationService.init(io);

  return io;
};
