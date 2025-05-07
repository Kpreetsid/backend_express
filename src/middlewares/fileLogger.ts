import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import { Request } from 'express';

const logDir = path.join(__dirname, '../../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const accessLogStream = fs.createWriteStream(path.join(logDir, 'access.log'), { flags: 'a' });

morgan.token('device', (req: Request) => req.headers['user-agent'] || 'unknown');
morgan.token('userName', (req: Request) => {
  return (req as any).user?.username || 'Anonymous';
});
morgan.token('userId', (req: Request) => {
  return (req as any).user?._id?.toString() || 'Anonymous';
});
morgan.token('action', (req: Request) => {
  return mapAction(req.method);
});
morgan.token('module', (req: Request) => {
  return extractModule(req.originalUrl);
});
morgan.token('description', (req: Request) => {
  const userName = (req as any).user?.username || 'Anonymous';
  const action = mapAction(req.method);
  const module = extractModule(req.originalUrl);
  return `${userName} performed ${action} on ${module}`;
});

const format = ':userId | :userName | :action | :method | :url | :module | :status | :res[content-length] - :response-time ms | IP: :remote-addr | Device: :device | Time: :date[iso]';
export const fileLogger = morgan(format, { stream: accessLogStream });

function mapAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return 'READ';
    case 'POST': return 'CREATE';
    case 'PUT': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return method.toUpperCase();
  }
}

function extractModule(url: string): string {
  const segments = url.split('/');
  return segments[1] || 'general';
}
