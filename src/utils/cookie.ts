import { CookieOptions, Request, Response } from 'express';

type CookieHeader = string | string[] | undefined;
type CookieNames = string | string[];
type CookieRequest = Request & { cookies?: Record<string, unknown> };

class CookieService {
  get(req: Request, names: CookieNames): string {
    return this.getFromRecord((req as CookieRequest).cookies || {}, names);
  }

  has(req: Request, names: CookieNames): boolean {
    return !!this.get(req, names);
  }

  set(res: Response, name: string, value: string, options: CookieOptions): void {
    res.cookie(name, value, options);
  }

  clear(res: Response, name: string, options: CookieOptions): void {
    res.clearCookie(name, options);
  }

  clearMany(res: Response, names: string[], options: CookieOptions): void {
    Array.from(new Set(names.filter(Boolean))).forEach((name) => {
      this.clear(res, name, options);
    });
  }

  parseHeader(header: CookieHeader): Record<string, string> {
    const rawHeader = Array.isArray(header) ? header.join(';') : String(header || '');
    return rawHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return cookies;
      }

      const key = this.safeDecode(part.slice(0, separatorIndex).trim());
      const value = this.safeDecode(part.slice(separatorIndex + 1).trim());
      if (key) {
        cookies[key] = value;
      }
      return cookies;
    }, {});
  }

  getFromRecord(cookies: Record<string, unknown>, names: CookieNames): string {
    for (const name of this.normalizeNames(names)) {
      const value = cookies[name];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return '';
  }

  private normalizeNames(names: CookieNames): string[] {
    return Array.isArray(names) ? names : [names];
  }

  private safeDecode(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
}

export const cookieService = new CookieService();
