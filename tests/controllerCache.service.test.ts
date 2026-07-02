import express, { Request, Response } from 'express';
import RedisMock from 'ioredis-mock';
import request from 'supertest';
import { controllerCache } from '../src/_cache/controllerCache.service';
import { canUseRedisForRequest } from '../src/settings/redisStatus.service';
import { getRedisClient } from '../src/_config/redis';

jest.mock('../src/settings/redisStatus.service', () => ({
  canUseRedisForRequest: jest.fn(),
  getRequestAccountId: jest.fn((req: Request) => String((req as any).companyID || req.headers.accountid || ''))
}));

jest.mock('../src/_config/redis', () => ({
  getRedisClient: jest.fn()
}));

class DemoController {
  public calls = 0;

  getList = async (_req: Request, res: Response): Promise<void> => {
    this.calls += 1;
    res.status(200).json({ calls: this.calls });
  };

  getSearch = async (req: Request, res: Response): Promise<void> => {
    this.calls += 1;
    res.status(200).json({ calls: this.calls, body: req.body });
  };

  createItem = async (_req: Request, res: Response): Promise<void> => {
    res.status(201).json({ status: true });
  };

  createFail = async (_req: Request, res: Response): Promise<void> => {
    res.status(500).json({ status: false });
  };

  makeCopy = async (_req: Request, res: Response): Promise<void> => {
    res.status(201).json({ copied: true });
  };
}

const redis = new RedisMock();

const flushPromises = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve));
};

const buildApp = (): { app: express.Express; controller: DemoController } => {
  const app = express();
  const controller = new DemoController();
  const cachedController = controllerCache.withCache(controller, {
    namespace: 'demo',
    ttlSeconds: 60,
    tags: ['demo']
  });

  app.use(express.json());
  app.use((req: Request, _res: Response, next) => {
    (req as any).companyID = req.header('x-account') || 'account-1';
    (req as any).user = { _id: req.header('x-user') || 'user-1' };
    next();
  });
  app.get('/items', cachedController.getList);
  app.post('/search', cachedController.getSearch);
  app.post('/items', cachedController.createItem);
  app.post('/fail', cachedController.createFail);
  app.get('/copy', cachedController.makeCopy);
  return { app, controller };
};

describe('controllerCache', () => {
  beforeEach(async () => {
    await redis.flushall();
    (getRedisClient as jest.Mock).mockReturnValue(redis);
    (canUseRedisForRequest as jest.Mock).mockResolvedValue(true);
  });

  afterAll(() => {
    redis.disconnect();
  });

  it('bypasses Redis when redis status gate returns false', async () => {
    const { app } = buildApp();
    (canUseRedisForRequest as jest.Mock).mockResolvedValue(false);

    await request(app).get('/items').expect('X-CMMS-Cache', 'BYPASS').expect(200, { calls: 1 });
    await request(app).get('/items').expect('X-CMMS-Cache', 'BYPASS').expect(200, { calls: 2 });
  });

  it('stores a controller read response on miss and returns it on hit', async () => {
    const { app, controller } = buildApp();

    await request(app).get('/items').expect('X-CMMS-Cache', 'MISS').expect(200, { calls: 1 });
    await flushPromises();
    await request(app).get('/items').expect('X-CMMS-Cache', 'HIT').expect(200, { calls: 1 });
    expect(controller.calls).toBe(1);
  });

  it('falls back to the controller when Redis read fails', async () => {
    const { app } = buildApp();
    jest.spyOn(redis, 'get').mockRejectedValueOnce(new Error('redis unavailable'));

    await request(app).get('/items').expect('X-CMMS-Cache', 'MISS').expect(200, { calls: 1 });
  });

  it('treats falsy cached getOrSet values as cache hits', async () => {
    const req = {
      companyID: 'account-1',
      user: { _id: 'user-1' },
      params: {},
      query: {},
      body: {}
    } as Request;
    const loader = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(controllerCache.getOrSet(req, {
      namespace: 'demo',
      operation: 'flag',
      ttlSeconds: 60,
      tags: ['demo'],
      loader
    })).resolves.toEqual({ value: false, hit: false, bypass: false });
    await flushPromises();

    await expect(controllerCache.getOrSet(req, {
      namespace: 'demo',
      operation: 'flag',
      ttlSeconds: 60,
      tags: ['demo'],
      loader
    })).resolves.toEqual({ value: false, hit: true, bypass: false });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('uses different cache keys for different users', async () => {
    const { app, controller } = buildApp();

    await request(app).get('/items').set('x-user', 'user-1').expect(200, { calls: 1 });
    await flushPromises();
    await request(app).get('/items').set('x-user', 'user-2').expect(200, { calls: 2 });
    await flushPromises();
    await request(app).get('/items').set('x-user', 'user-1').expect(200, { calls: 1 });
    expect(controller.calls).toBe(2);
  });

  it('uses params, query, and read-style body in cache keys', async () => {
    const { app } = buildApp();

    await request(app).get('/items?filter=a').expect(200, { calls: 1 });
    await flushPromises();
    await request(app).get('/items?filter=b').expect(200, { calls: 2 });
    await request(app).post('/search').send({ filter: 'a' }).expect(200, { calls: 3, body: { filter: 'a' } });
    await flushPromises();
    await request(app).post('/search').send({ filter: 'b' }).expect(200, { calls: 4, body: { filter: 'b' } });
  });

  it('invalidates cache after successful mutation', async () => {
    const { app } = buildApp();

    await request(app).get('/items').expect(200, { calls: 1 });
    await flushPromises();
    await request(app).get('/items').expect('X-CMMS-Cache', 'HIT').expect(200, { calls: 1 });
    await request(app).post('/items').send({}).expect(201, { status: true });
    await flushPromises();
    await request(app).get('/items').expect('X-CMMS-Cache', 'MISS').expect(200, { calls: 2 });
  });

  it('does not invalidate cache after failed mutation', async () => {
    const { app } = buildApp();

    await request(app).get('/items').expect(200, { calls: 1 });
    await flushPromises();
    await request(app).post('/fail').send({}).expect(500, { status: false });
    await flushPromises();
    await request(app).get('/items').expect('X-CMMS-Cache', 'HIT').expect(200, { calls: 1 });
  });

  it('treats side-effect GET methods as mutations instead of cached reads', async () => {
    const { app } = buildApp();

    await request(app).get('/items').expect(200, { calls: 1 });
    await flushPromises();
    await request(app).get('/copy').expect(201, { copied: true });
    await flushPromises();
    await request(app).get('/items').expect('X-CMMS-Cache', 'MISS').expect(200, { calls: 2 });
  });
});
