import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { auth } from '../configDB';
import { notificationService } from '../utils/notification.service';
import { isOriginAllowed } from './cors';
import { TokenModel } from '../models/userToken.model';
import { UserModel } from '../models/user.model';
import { Types } from 'mongoose';

export const notificationSocketMetrics = {
  activeConnections: 0,
  pollingConnections: 0,
  websocketConnections: 0,
  totalConnections: 0,
  totalConnectionErrors: 0
};

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

  io.use(async (socket: Socket, next) => {
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
      const userId = decoded?.id;
      const tokenAccountId = decoded?.companyID;
      if (!userId || !tokenAccountId || String(tokenAccountId) !== String(accountId)
        || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(tokenAccountId)) {
        return next(new Error('Authentication error: Invalid token context'));
      }

      const [tokenRecord, user] = await Promise.all([
        TokenModel.findOne({ _id: token, userId, expiresAt: { $gt: new Date() } }).select('_id userId'),
        UserModel.findOne({ _id: userId, account_id: tokenAccountId, user_status: 'active' }).select('_id username account_id')
      ]);
      if (!tokenRecord || !user) {
        return next(new Error('Authentication error: Session is no longer active'));
      }

      socket.data.user = { ...decoded, username: user.username };
      socket.data.accountId = String(tokenAccountId);
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.engine.on('connection_error', (error) => {
    notificationSocketMetrics.totalConnectionErrors += 1;
    console.error('Notification socket transport error:', error.code, error.message);
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user.id;
    const userName = socket.data.user.username;
    const dateIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const url = socket.handshake.url;
    let transportName = socket.conn.transport.name;
    notificationSocketMetrics.activeConnections += 1;
    notificationSocketMetrics.totalConnections += 1;
    notificationSocketMetrics[transportName === 'websocket' ? 'websocketConnections' : 'pollingConnections'] += 1;
    const customLog = `${dateIst} | CONNECTED | ${userId} | ${userName} | SOCKET_CONNECT | WS | - ms | ${url}`;
    console.log(`Notification socket connected: ${userName}`);
    console.log(customLog);
    socket.join(userId.toString());
    socket.conn.once('upgrade', () => {
      if (transportName === 'polling') {
        notificationSocketMetrics.pollingConnections = Math.max(0, notificationSocketMetrics.pollingConnections - 1);
      }
      transportName = socket.conn.transport.name;
      if (transportName === 'websocket') {
        notificationSocketMetrics.websocketConnections += 1;
      }
    });

    socket.on('notification_reached', async (
      payload: { notificationId?: string },
      acknowledge?: (result: { success: boolean; message?: string }) => void
    ) => {
      try {
        const notificationId = payload?.notificationId;
        if (!notificationId || !Types.ObjectId.isValid(notificationId)) {
          acknowledge?.({ success: false, message: 'Invalid notification ID' });
          return;
        }
        const updated = await notificationService.markAsReached(notificationId, userId);
        if (!updated) {
          acknowledge?.({ success: false, message: 'Notification not found' });
          return;
        }
        const actionDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        console.log(`${actionDate} | ACKNOWLEDGED | ${userId} | ${userName} | NOTIFICATION_REACHED | WS | - ms | payload: ${notificationId}`);
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
      const disconnectDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      console.log(`${disconnectDate} | DISCONNECTED | ${userId} | ${userName} | SOCKET_DISCONNECT | ${transportName} | - ms | ${url} | reason: ${reason}`);
    });
  });
  notificationService.init(io);
  return io;
};
