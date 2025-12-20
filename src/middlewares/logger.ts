import { NextFunction, Request, Response } from 'express';
import { UserLogModel } from '../models/userLogs.model';
import { get, merge, omit } from 'lodash';

export const activityLogger = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const startTime = Date.now();
  res.on('finish', async () => {
    try {
      const headers: any = req.headers || {};
      const user: any = get(req, 'user', {});
      const userName = user?.username || 'Anonymous';
      const userId = user?._id || null;
      const accountID = headers.accountid;
      const pageUrlHeader: string = (headers['page_url'] as string) || '';
      const origin: string = (headers['origin'] as string) || '';
      const ua: string = headers['user-agent'] || '';
      const systemInfo = {
        platform: headers['sec-ch-ua-platform']?.replace(/"/g, '') || 'Unknown',
        os: extractOS(ua),
        architecture: ua.includes('x86_64') ? 'x86_64' : 'Unknown'
      };
      const browserInfo = {
        name: extractBrowserName(headers['sec-ch-ua']),
        version: extractBrowserVersion(ua),
        engine: extractEngine(ua)
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
        language: headers['accept-language'] ? headers['accept-language'].split(',').map((lang: string) => lang.split(';')[0].trim()) : []
      };
      const requestMeta = {
        contentType: headers['content-type'] || '',
        accept: headers['accept'] ? headers['accept'].split(',').map((e: string) => e.trim()) : [],
        fetchMode: headers['sec-fetch-mode'] || '',
        fetchSite: headers['sec-fetch-site'] || '',
        fetchDest: headers['sec-fetch-dest'] || '',
        dnt: headers['dnt'] === '1',
        secCHUA: parseSecCHUA(headers['sec-ch-ua'])
      };
      const moduleBackend = extractModule(req.originalUrl);
      const moduleName = extractModule(pageUrlHeader);
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
          params: req.params || {},
          body: req.body || {},
          query: req.query || {},
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

const extractModule = (pageUrl: string | undefined): string => {
  if (typeof pageUrl !== 'string' || !pageUrl.trim()) return 'general';
  const segments = pageUrl.split('/').filter(Boolean);
  if (segments.length === 0) return 'general';
  if (segments.length === 1) return segments[0];
  return `${segments[0]}-${segments[1]}`;
}

const extractOS = (userAgent: string | undefined): string => {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Macintosh')) return 'Mac OS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  return 'Unknown';
}

const extractBrowserName = (ua: string | undefined): string => {
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

const extractBrowserVersion = (userAgent: string | undefined): string => {
  const match = userAgent?.match(/Chrome\/([\d.]+)/);
  return match ? match[1] : 'Unknown';
}

const extractEngine = (userAgent: string | undefined): string => {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('AppleWebKit')) return 'WebKit (AppleWebKit/537.36)';
  if (userAgent.includes('Gecko')) return 'Gecko';
  return 'Unknown';
}

const parseSecCHUA = (secCHUA: string | undefined): string[] => {
  if (!secCHUA) return [];
  return secCHUA.replace(/"/g, '').split(',').map(val => val.trim()).map(entry => {
    const [name, version] = entry.split(';v=');
    return `${name} v${version}`;
  });
}