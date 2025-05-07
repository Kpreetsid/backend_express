import { NextFunction, Request, Response } from 'express';
import { UserLog, IUserLog } from '../_models/userLogs.model';
import mongoose from 'mongoose';

export const activityLogger = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  res.on('finish', async () => {
    try {
      const userName = req.user?.username || 'Anonymous';
      const userId: mongoose.Types.ObjectId = new mongoose.Types.ObjectId(req.user._id);
      const action = mapAction(req.method);
      const module = extractModule(req.originalUrl);
      const description = `${userName} performed ${action} on ${module}`;

      const log: Partial<IUserLog> = {
        userId,
        userName,
        action,
        module,
        description,
        method: req.method,
        statusCode: res.statusCode,
        requestUrl: req.originalUrl,
        host: req.hostname,
        hostName: req.headers.host || '',
        protocol: req.protocol,
        port: req.socket.localPort,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date(),
        additionalData: {
          params: req.params,
          body: req.body,
          query: req.query,
          durationMs: Date.now() - startTime
        }
      };
      await UserLog.create(log);
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  });

  next();
};

// Helper to map HTTP methods to actions
function mapAction(method: string): string {
  switch (method) {
    case 'GET': return 'READ';
    case 'POST': return 'CREATE';
    case 'PUT': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return method;
  }
}

// Extract top-level module name from the route
function extractModule(url: string): string {
  const segments = url.split('/');
  return segments[1] || 'general';
}