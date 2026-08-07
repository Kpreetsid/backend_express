import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { auth } from '../configDB';
import { notificationService } from '../utils/notification.service';
import { isOriginAllowed } from './cors';

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
      socket.data.user = decoded;
      socket.data.accountId = accountId;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user.id;
    const userName = socket.data.user.username;
    const dateIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const url = socket.handshake.url;
    const customLog = `${dateIst} | CONNECTED | ${userId} | ${userName} | SOCKET_CONNECT | WS | - ms | ${url}`;
    console.log(`Notification socket connected: ${userName}`);
    console.log(customLog);
    socket.join(userId.toString());
    socket.on('notification_reached', async (payload: { notificationId: string }) => {
      try {
        await notificationService.markAsReached(payload.notificationId, userId);
        const actionDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        console.log(`${actionDate} | ACKNOWLEDGED | ${userId} | ${userName} | NOTIFICATION_REACHED | WS | - ms | payload: ${payload.notificationId}`);
      } catch (err) {
        console.error('Error marking notification as reached:', err);
      }
    });
    socket.on('disconnect', () => {
      const disconnectDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      console.log(`${disconnectDate} | DISCONNECTED | ${userId} | ${userName} | SOCKET_DISCONNECT | WS | - ms | ${url}`);
    });
  });
  notificationService.init(io);
  return io;
};