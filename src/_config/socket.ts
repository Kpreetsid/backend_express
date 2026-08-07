import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { auth } from '../configDB';
import { notificationService } from '../utils/notification.service';
import { isOriginAllowed } from './cors';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedisClient } from './redis';
import { applicationLogger } from '../observability/logger';
import type { RedisClientType } from 'redis';
import { redisKeys } from './redis-keys';
import {
  authenticationAnomalyCounter,
  notificationSocketConnectionsGauge
} from '../observability/metrics';

let socketServer: Server | undefined;
let socketSubscriber: RedisClientType | undefined;

/**
 * Initialize Socket.io server
 * @param httpServer The HTTP server instance
 */
export const initSocket = async (httpServer: HttpServer): Promise<Server> => {
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

  const redis = getRedisClient();
  if (redis) {
    const subscriber = redis.duplicate();
    subscriber.on('error', (error: unknown) =>
      applicationLogger.error({ err: error }, 'Socket.IO Redis subscriber error')
    );
    await subscriber.connect();
    io.adapter(createAdapter(redis, subscriber, {
      key: redisKeys.socketAdapterPrefix()
    }));
    socketSubscriber = subscriber as RedisClientType;
  }

  // Authentication Middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth['token'] || socket.handshake.headers['authorization']?.split(' ')[1];
    const accountId = socket.handshake.auth['accountId'] || socket.handshake.headers['accountid'];

    if (!token || !accountId) {
      authenticationAnomalyCounter.inc({ reason: 'socket_missing_credentials' });
      return next(new Error('Authentication error: Token and Account ID required'));
    }

    try {
      const decoded: any = jwt.verify(token, auth.secret, {
        algorithms: [auth.algorithm as jwt.Algorithm],
        issuer: auth.issuer,
        audience: auth.audience
      });

      if (!decoded?.id || !decoded?.companyID || String(decoded.companyID) !== String(accountId)) {
        authenticationAnomalyCounter.inc({ reason: 'socket_tenant_mismatch' });
        return next(new Error('Authentication error: Account ID mismatch'));
      }

      // Attach user info to socket
      socket.data.user = decoded;
      socket.data.accountId = accountId;
      next();
    } catch (err) {
      authenticationAnomalyCounter.inc({ reason: 'socket_invalid_token' });
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user.id;
    const accountId = socket.data.accountId;

    applicationLogger.info({ userId, accountId }, 'Notification socket connected');
    notificationSocketConnectionsGauge.inc();

    // Notification delivery is user-scoped. Account-wide events are expanded to user rooms
    // by NotificationService when a server-side API action creates notifications.
    socket.join(userId.toString());

    // Handle "Notification Reached" acknowledgment from client
    socket.on('notification_reached', async (payload: { notificationId: string }) => {
      try {
        const userId = socket.data.user.id;
        await notificationService.markAsReached(payload.notificationId, userId);
        applicationLogger.info(
          { notificationId: payload.notificationId, userId, accountId },
          'Notification reached acknowledgement'
        );
      } catch (err) {
        applicationLogger.error({ err, userId, accountId }, 'Error marking notification as reached');
      }
    });

    socket.on('disconnect', () => {
      notificationSocketConnectionsGauge.dec();
      applicationLogger.info({ userId, accountId }, 'Notification socket disconnected');
    });
  });

  // Initialize the singleton service with this io instance
  notificationService.init(io);
  socketServer = io;

  return io;
};

export const closeSocket = async (): Promise<void> => {
  if (socketServer) {
    await new Promise<void>((resolve) => socketServer!.close(() => resolve()));
    socketServer = undefined;
  }
  if (socketSubscriber?.isOpen) {
    await socketSubscriber.close();
  }
  socketSubscriber = undefined;
};
