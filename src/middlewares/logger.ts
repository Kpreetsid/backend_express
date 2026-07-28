import { NextFunction, Request, RequestHandler, Response } from 'express';
import { UserLogModel } from '../models/userLogs.model';
import { get, merge, omit } from 'lodash';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';

class AppLogger {
  private logDir: string;
  private accessLogStream!: fs.WriteStream;
  private fileLogger!: RequestHandler;
  private consoleLogger: RequestHandler;
  private currentLogFile: string = '';
  private readonly sensitiveKeyPattern = /(password|passcode|token|authorization|auth|otp|secret|cookie|session|card|ssn|external_token|verificationCode|confirmNewPassword|newPassword|payloadCrypto|sessionKey|_encrypted|kid|iv|tag|ct|__cmms_crypto_fields)/i;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    this.registerMorganTokens();
    this.refreshFileLogger();
    const consoleFormat = ':date_ist | :status | :userId | :userName | :action | :method | :response-time ms | :url';
    this.consoleLogger = morgan(consoleFormat);
  }

  private getMonthlyLogFileName(): string {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const month = istDate.toLocaleString('en-US', { month: 'long' });
    const year = istDate.getFullYear();
    return `${month}_${year}.log`;
  }

  private refreshFileLogger(): void {
    const fileName = this.getMonthlyLogFileName();
    if (this.currentLogFile === fileName && this.accessLogStream) {
      return;
    }

    if (this.accessLogStream) {
      this.accessLogStream.end();
    }
    this.currentLogFile = fileName;
    const logFilePath = path.join(this.logDir, fileName);
    this.accessLogStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    const fileFormat = ':date_ist | :userId | :userName | :action | :method | :url | :module | :status | :res[content-length] | :response-time ms | IP: :remote-addr | Device: :device';
    this.fileLogger = morgan(fileFormat, { stream: this.accessLogStream });
  }

  public logMiddleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      this.refreshFileLogger();
      this.consoleLogger(req, res, () => {
      });
      this.fileLogger(req, res, () => {
      });
      this.activityLogger(req, res, next);
    };
  }

  private activityLogger = async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.on('finish', async () => {
      try {
        const headers: any = req.headers || {};
        const user: any = get(req, 'user', {});
        const userName = user?.username || 'Anonymous';
        const userId = user?._id || user.id || null;
        const accountID = headers.accountid;
        const pageUrlHeader: string = (headers['page_url'] as string) || '';
        const origin: string = (headers['origin'] as string) || '';
        const ua: string = headers['user-agent'] || '';
        const systemInfo = {
          platform: headers['sec-ch-ua-platform']?.replace(/"/g, '') || 'Unknown',
          os: this.extractOS(ua),
          architecture: ua.includes('x86_64') ? 'x86_64' : 'Unknown'
        };
        const browserInfo = {
          name: this.extractBrowserName(headers['sec-ch-ua']),
          version: this.extractBrowserVersion(ua),
          engine: this.extractEngine(ua)
        };
        const secChUaMobile = headers['sec-ch-ua-mobile'] || '';
        const secChUaTablet = headers['sec-ch-ua-tablet'] || '';
        const isMobile = secChUaMobile === '?1' || /Mobi|Android/i.test(ua);
        const isTablet = secChUaTablet === '?1' || /Tablet|iPad/i.test(ua);
        const isDesktop = !isMobile && !isTablet;
        const deviceInfo = { isMobile, isTablet, isDesktop, userAgent: ua };
        merge(req, { device: omit(deviceInfo, 'userAgent') });
        const networkInfo = {
          origin: origin || 'unknown',
          referer: headers['referer'] || '',
          host: headers['host'] || '',
          connection: headers['connection'] || '',
          contentLength: Number(headers['content-length']) || 0,
          encoding: headers['accept-encoding'] ? headers['accept-encoding'].split(',').map((x: any) => x.trim()) : [],
          language: headers['accept-language'] ? headers['accept-language'].split(',').map((lang: string) => lang.split(';')[0]!.trim()) : []
        };
        const requestMeta = {
          contentType: headers['content-type'] || '',
          accept: headers['accept'] ? headers['accept'].split(',').map((e: string) => e.trim()) : [],
          fetchMode: headers['sec-fetch-mode'] || '',
          fetchSite: headers['sec-fetch-site'] || '',
          fetchDest: headers['sec-fetch-dest'] || '',
          dnt: headers['dnt'] === '1',
          secCHUA: this.parseSecCHUA(headers['sec-ch-ua'])
        };
        const moduleBackend = this.extractModule(req.originalUrl);
        const moduleName = this.extractModule(pageUrlHeader);
        const description = `${userName} performed ${req.method} on ${moduleBackend} from ${origin || 'unknown-origin'} at ${new Date().toISOString()}`;
  
        const newLog = new UserLogModel({
          userId,
          userName,
          account_id: accountID,
          pageUrl: `${origin}${pageUrlHeader}` || '',
          moduleName: moduleName || 'general',
          systemInfo,
          browserInfo,
          deviceInfo,
          networkInfo,
          requestMeta,
          module: moduleBackend,
          description,
          method: req.method,
          statusCode: res.statusCode,
          requestUrl: req.originalUrl,
          host: req.hostname,
          hostName: headers.host || '',
          protocol: req.protocol,
          port: req.socket?.localPort || null,
          ipAddress: req.ip || (headers['x-forwarded-for'] as string) || '',
          userAgent: ua,
          additionalData: {
            correlationId: res.locals['correlationId'],
            params: this.redactSensitiveData(req.params || {}),
            body: this.redactSensitiveData(req.body || {}),
            query: this.redactSensitiveData(req.query || {}),
            durationMs: Date.now() - startTime
          }
        });
        await newLog.save();
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    });
    next();
  };

  private redactSensitiveData(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactSensitiveData(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = this.sensitiveKeyPattern.test(key) ? '[REDACTED]' : this.redactSensitiveData(nestedValue);
    }
    return redacted;
  }

  private extractOS (userAgent: string | undefined): string {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh')) return 'Mac OS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    return 'Unknown';
  }

  private extractBrowserName (ua: string | undefined): string {
    if (!ua) return 'Unknown';
    ua = ua.toLowerCase();
    if (ua.includes('edg/')) return 'Microsoft Edge';
    if (ua.includes('opr') || ua.includes('opera')) return 'Opera';
    if (ua.includes('chrome')) return 'Google Chrome';
    if (ua.includes('firefox')) return 'Mozilla Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('msie') || ua.includes('trident')) return 'Internet Explorer';
    if (ua.includes('brave')) return 'Brave';
    if (ua.includes('vivaldi')) return 'Vivaldi';
    if (ua.includes('ucbrowser')) return 'UC Browser';
    if (ua.includes('samsungbrowser')) return 'Samsung Internet';
    if (ua.includes('qqbrowser')) return 'QQ Browser';
    if (ua.includes('yabrowser')) return 'Yandex Browser';
    if (ua.includes('crios')) return 'Chrome (iOS)';
    if (ua.includes('fxios')) return 'Firefox (iOS)';
    return 'Unknown';
  }

   private extractBrowserVersion (userAgent: string | undefined): string {
    const match = userAgent?.match(/Chrome\/([\d.]+)/);
    return match?.[1] || 'Unknown';
  }
  
   private extractEngine (userAgent: string | undefined): string {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('AppleWebKit')) return 'WebKit (AppleWebKit/537.36)';
    if (userAgent.includes('Gecko')) return 'Gecko';
    return 'Unknown';
  }
  
  private parseSecCHUA (secCHUA: string | undefined): string[] {
    if (!secCHUA) return [];
    return secCHUA.replace(/"/g, '').split(',').map(val => val.trim()).map(entry => {
      const [name, version] = entry.split(';v=');
      return `${name} v${version}`;
    });
  }

  private registerMorganTokens(): void {
    morgan.token('device', (req) => req.headers['user-agent'] || 'unknown');
    morgan.token('userName', (req: any) => req.user?.username || 'Anonymous');
    morgan.token('userId', (req: any) => req.user?._id?.toString() || 'Anonymous');
    morgan.token('action', (req) => this.mapAction(req.method));
    morgan.token('module', (req) => this.extractModule(req.url));
    morgan.token('date_ist', () => {
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + istOffset);
      return istDate.toISOString().replace('Z', '+05:30');
    });
  }

  private mapAction(method: any): string {
    switch (method.toUpperCase()) {
      case 'GET': return 'READ';
      case 'POST': return 'CREATE';
      case 'PUT': return 'UPDATE';
      case 'DELETE': return 'DELETE';
      default: return method.toUpperCase();
    }
  }

  private extractModule(url: any): string {
    const segments = url.split('/').filter(Boolean);
    return segments[0] || 'general';
  }
}

export const logger = new AppLogger();
