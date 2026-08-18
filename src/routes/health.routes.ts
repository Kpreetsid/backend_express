import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { notificationSocketMetrics } from '../_config/socket';

const mongoState = () => {
  switch (mongoose.connection.readyState) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'unknown';
  }
};

export const healthRouter = Router();
export const metricsRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/startup', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

healthRouter.get('/ready', (_req: Request, res: Response) => {
  const mongodb = mongoState();
  const ready = mongodb === 'connected';

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    checks: {
      mongodb
    },
    timestamp: Date.now()
  });
});

metricsRouter.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send([
    '# HELP cmms_process_uptime_seconds Process uptime in seconds.',
    '# TYPE cmms_process_uptime_seconds gauge',
    `cmms_process_uptime_seconds ${process.uptime()}`,
    '# HELP cmms_mongodb_ready MongoDB readiness, 1 when connected.',
    '# TYPE cmms_mongodb_ready gauge',
    `cmms_mongodb_ready ${mongoose.connection.readyState === 1 ? 1 : 0}`,
    '# HELP cmms_notification_socket_connections Active notification Socket.IO connections.',
    '# TYPE cmms_notification_socket_connections gauge',
    `cmms_notification_socket_connections ${notificationSocketMetrics.activeConnections}`,
    '# HELP cmms_notification_socket_transport_connections Active notification connections by transport.',
    '# TYPE cmms_notification_socket_transport_connections gauge',
    `cmms_notification_socket_transport_connections{transport="websocket"} ${notificationSocketMetrics.websocketConnections}`,
    `cmms_notification_socket_transport_connections{transport="polling"} ${notificationSocketMetrics.pollingConnections}`,
    '# HELP cmms_notification_socket_connections_total Notification socket connections accepted since process start.',
    '# TYPE cmms_notification_socket_connections_total counter',
    `cmms_notification_socket_connections_total ${notificationSocketMetrics.totalConnections}`,
    '# HELP cmms_notification_socket_connection_errors_total Notification socket transport errors since process start.',
    '# TYPE cmms_notification_socket_connection_errors_total counter',
    `cmms_notification_socket_connection_errors_total ${notificationSocketMetrics.totalConnectionErrors}`
  ].join('\n'));
});
