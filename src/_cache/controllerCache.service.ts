import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { redisConfig } from '../configDB';
import { canUseRedisForRequest, getRequestAccountId } from '../settings/redisStatus.service';
import { RedisUtils } from '../utils/redis.service';

type CacheScope = 'account' | 'user';
type ControllerMethod = (req: Request, res: Response, next: NextFunction) => Promise<any> | any;

interface ControllerCacheOptions {
  namespace: string;
  tags: string[];
  ttlSeconds?: number;
  scope?: CacheScope;
  readMethods?: string[];
  mutationMethods?: string[];
  skipMethods?: string[];
  mutationTags?: string[];
}

interface CachePayload {
  statusCode: number;
  body: unknown;
}

const READ_PREFIXES = ['get'];
const MUTATION_PREFIXES = [
  'create',
  'update',
  'remove',
  'delete',
  'set',
  'approve',
  'transfer',
  'like',
  'dislike',
  'make',
  'upload',
  'import',
  'generate',
  'statusupdate',
  'partialupdate'
];

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => {
    const record = value as Record<string, unknown>;
    return `${JSON.stringify(key)}:${stableStringify(record[key])}`;
  }).join(',')}}`;
};

const hashValue = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

const getRequestUserId = (req: Request): string => {
  const requestData = req as any;
  return String(requestData.user?._id || requestData.user?.id || requestData.user_id || 'anonymous');
};

const buildTagKey = (accountId: string, tag: string): string => {
  return `${redisConfig.keyPrefix}:tag:${accountId || 'unknown-account'}:${tag}`;
};

const buildCacheKey = (
  req: Request,
  namespace: string,
  operation: string,
  scope: CacheScope,
  keyParts: unknown[]
): string => {
  const accountId = getRequestAccountId(req) || 'unknown-account';
  const userId = scope === 'user' ? getRequestUserId(req) : 'account';
  const keyHash = hashValue(stableStringify(keyParts));
  return `${redisConfig.keyPrefix}:${accountId}:${userId}:${namespace}:${operation}:${keyHash}`;
};

const defaultKeyParts = (req: Request): unknown[] => [
  req.params || {},
  req.query || {},
  req.body || {}
];

class ControllerCacheService {
  withCache<TController extends Record<string, any>>(controller: TController, options: ControllerCacheOptions): TController {
    const readMethods = new Set(options.readMethods || []);
    const mutationMethods = new Set(options.mutationMethods || []);
    const skipMethods = new Set(options.skipMethods || []);

    return new Proxy(controller, {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver);
        if (typeof property !== 'string' || typeof value !== 'function' || skipMethods.has(property)) {
          return value;
        }

        if (readMethods.has(property) || this.isReadMethod(property)) {
          return this.wrapReadMethod(target, value as ControllerMethod, property, options);
        }

        if (mutationMethods.has(property) || this.isMutationMethod(property)) {
          return this.wrapMutationMethod(target, value as ControllerMethod, options);
        }

        return (value as ControllerMethod).bind(target);
      }
    });
  }

  async getOrSet<T>(req: Request, options: {
    namespace: string;
    operation: string;
    ttlSeconds?: number;
    scope?: CacheScope;
    tags?: string[];
    keyParts?: unknown[];
    loader: () => Promise<T>;
  }): Promise<{ value: T; hit: boolean; bypass: boolean }> {
    const ttlSeconds = options.ttlSeconds ?? redisConfig.defaultTtlSeconds;
    const scope = options.scope ?? 'user';
    const tags = options.tags || [];

    if (!(await canUseRedisForRequest(req))) {
      return { value: await options.loader(), hit: false, bypass: true };
    }

    const cacheKey = buildCacheKey(req, options.namespace, options.operation, scope, options.keyParts || defaultKeyParts(req));

    const cached = await RedisUtils.get<T>(cacheKey);
    if (cached !== null) {
      return { value: cached, hit: true, bypass: false };
    }

    const value = await options.loader();
    void this.set(cacheKey, value, req, tags, ttlSeconds);
    return { value, hit: false, bypass: false };
  }

  async invalidate(req: Request, tags: string[]): Promise<void> {
    if (!tags.length || !(await canUseRedisForRequest(req))) {
      return;
    }

    const accountId = getRequestAccountId(req);
    await Promise.all(tags.map(async (tag) => {
      const tagKey = buildTagKey(accountId, tag);
      const keys = await RedisUtils.getSet<string>(tagKey);
      await RedisUtils.deleteMany(keys);
      await RedisUtils.delete(tagKey);
    }));
  }

  private wrapReadMethod<TController extends Record<string, any>>(
    controller: TController,
    method: ControllerMethod,
    operation: string,
    options: ControllerCacheOptions
  ): ControllerMethod {
    return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
      const cacheResult = await this.getCachedPayload(req, operation, options);
      if (cacheResult.hit) {
        res.setHeader('X-CMMS-Cache', 'HIT');
        return res.status(cacheResult.payload.statusCode).json(cacheResult.payload.body);
      }

      res.setHeader('X-CMMS-Cache', cacheResult.bypass ? 'BYPASS' : 'MISS');
      this.captureSuccessfulResponse(req, res, operation, options, cacheResult.cacheKey);
      return method.apply(controller, [req, res, next]);
    };
  }

  private wrapMutationMethod<TController extends Record<string, any>>(
    controller: TController,
    method: ControllerMethod,
    options: ControllerCacheOptions
  ): ControllerMethod {
    return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
      res.once('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          void this.invalidate(req, options.mutationTags || options.tags);
        }
      });
      return method.apply(controller, [req, res, next]);
    };
  }

  private async getCachedPayload(req: Request, operation: string, options: ControllerCacheOptions): Promise<{
    hit: boolean;
    bypass: boolean;
    cacheKey: string;
    payload: CachePayload;
  }> {
    const scope = options.scope || 'user';
    const cacheKey = buildCacheKey(req, options.namespace, operation, scope, defaultKeyParts(req));
    const emptyPayload: CachePayload = { statusCode: 200, body: undefined };

    if (!(await canUseRedisForRequest(req))) {
      return { hit: false, bypass: true, cacheKey, payload: emptyPayload };
    }

    const cached = await RedisUtils.get<CachePayload>(cacheKey);
    if (cached !== null) {
      return { hit: true, bypass: false, cacheKey, payload: cached };
    }

    return { hit: false, bypass: false, cacheKey, payload: emptyPayload };
  }

  private captureSuccessfulResponse(
    req: Request,
    res: Response,
    operation: string,
    options: ControllerCacheOptions,
    cacheKey: string
  ): void {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const ttlSeconds = options.ttlSeconds || redisConfig.defaultTtlSeconds;
    let persisted = false;

    const persistPayload = (body: unknown): void => {
      if (persisted) {
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }
      persisted = true;
      const payload: CachePayload = { statusCode: res.statusCode, body };
      void this.set(cacheKey, payload, req, options.tags, ttlSeconds);
    };

    res.json = ((body?: unknown): Response => {
      persistPayload(body);
      return originalJson(body);
    }) as Response['json'];

    res.send = ((body?: unknown): Response => {
      persistPayload(body);
      return originalSend(body as any);
    }) as Response['send'];
    void operation;
  }

  private async set(cacheKey: string, value: unknown, req: Request, tags: string[], ttlSeconds: number): Promise<void> {
    await RedisUtils.set(cacheKey, value, ttlSeconds);
    const accountId = getRequestAccountId(req);
    await Promise.all(tags.map(async (tag) => {
      const tagKey = buildTagKey(accountId, tag);
      await RedisUtils.addToSet(tagKey, cacheKey);
      await RedisUtils.expire(tagKey, ttlSeconds + 86400);
    }));
  }

  private isReadMethod(methodName: string): boolean {
    const normalized = methodName.toLowerCase();
    return READ_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }

  private isMutationMethod(methodName: string): boolean {
    const normalized = methodName.toLowerCase();
    return MUTATION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }
}

export const controllerCache = new ControllerCacheService();

export const __controllerCacheTestUtils = {
  buildCacheKey,
  buildTagKey,
  stableStringify
};
