import { describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

describe('audit activity middleware', () => {
  it.each(['/health', '/health/ready', '/metrics', '/metrics/'])(
    'does not create database audit work for operational endpoint %s',
    (path) => {
      const req = { path } as any;
      const res = { on: vi.fn() } as any;
      const next = vi.fn();

      logger.logMiddleware()(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.on).not.toHaveBeenCalled();
    }
  );

  it('registers completion auditing for application routes', () => {
    const req = { path: '/api/master/assets' } as any;
    const res = { on: vi.fn() } as any;
    const next = vi.fn();

    logger.logMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });
});
