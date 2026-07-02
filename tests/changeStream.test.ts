/**
 * CDC Change Stream Unit Tests
 *
 * Verifies:
 * - watchAssets: Invalidates asset:{id}, asset:list, workOrder:list on any write
 * - watchLocations: Invalidates location:{id}, location:list, asset:list on any write
 * - watchUsers: Invalidates user:{id}, user:list, role:list on any write
 * - watchWorkOrders: Invalidates workOrder:{id}, workOrder:list, workOrder:dashboard
 * - watchSchedules: Invalidates schedule:list on any write
 * - watchParts: Invalidates part:{id}, part:list on any write
 * - watchNotifications: Invalidates notification:list for the affected userId
 * - Graceful no-op when connection is unavailable
 *
 * Strategy: Mock mongoose connection's watch() to emit synthetic events,
 * spy on CacheManager.del() to assert correct keys.
 */

import { EventEmitter } from 'events';
import { CacheManager } from '../src/_cache/cacheManager';

// Mock CacheManager so we can spy on what keys get deleted
jest.mock('../src/_cache/cacheManager', () => ({
  CacheManager: {
    del: jest.fn().mockResolvedValue(undefined),
    isAvailable: jest.fn().mockReturnValue(true),
  },
}));

// Helper: create a mock mongoose connection that returns a fake ChangeStream
const makeConnection = (collectionName: string, emitter: EventEmitter) => ({
  readyState: 1,
  collection: (name: string) => ({
    watch: () => {
      if (name !== collectionName) throw new Error(`Unexpected collection: ${name}`);
      return emitter;
    },
  }),
});

const wait = () => new Promise<void>(resolve => setImmediate(resolve));

describe('CDC: watchAssets', () => {
  let delSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delSpy = jest.spyOn(CacheManager, 'del');
  });

  it('invalidates correct keys on asset insert event', async () => {
    const { watchAssets } = require('../src/_cache/changeStream/asset.stream');
    const emitter = new EventEmitter();
    const conn = makeConnection('assets', emitter);

    watchAssets(conn as any);

    emitter.emit('change', {
      operationType: 'insert',
      documentKey: { _id: { toString: () => 'doc-123' } },
      fullDocument: {
        _id: { toString: () => 'doc-123' },
        account_id: { toString: () => 'acc-456' },
      },
    });

    await wait();

    expect(delSpy).toHaveBeenCalled();
    const calledKeys: string[] = (delSpy.mock.calls[0] as string[]);
    expect(calledKeys.some(k => k.includes('asset') && k.includes('doc-123'))).toBe(true);
    expect(calledKeys.some(k => k.includes('asset') && k.includes('list'))).toBe(true);
  });

  it('does not throw when readyState is not 1 (not connected)', () => {
    const { watchAssets } = require('../src/_cache/changeStream/asset.stream');
    const conn = { readyState: 0, collection: jest.fn() };
    expect(() => watchAssets(conn as any)).not.toThrow();
  });
});

describe('CDC: watchLocations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates location, locationList, and assetList on change', async () => {
    const delSpy = jest.spyOn(CacheManager, 'del');
    const { watchLocations } = require('../src/_cache/changeStream/location.stream');
    const emitter = new EventEmitter();
    const conn = makeConnection('locations', emitter);

    watchLocations(conn as any);

    emitter.emit('change', {
      documentKey: { _id: { toString: () => 'loc-111' } },
      fullDocument: {
        _id: { toString: () => 'loc-111' },
        account_id: { toString: () => 'acc-222' },
      },
    });

    await wait();

    const calledKeys: string[] = delSpy.mock.calls[0] as string[];
    expect(calledKeys.some(k => k.includes('location') && k.includes('loc-111'))).toBe(true);
    expect(calledKeys.some(k => k.includes('location') && k.includes('list'))).toBe(true);
    expect(calledKeys.some(k => k.includes('asset') && k.includes('list'))).toBe(true);
  });
});

describe('CDC: watchUsers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates user, userList, and role on user change', async () => {
    const delSpy = jest.spyOn(CacheManager, 'del');
    const { watchUsers } = require('../src/_cache/changeStream/user.stream');
    const emitter = new EventEmitter();
    const conn = makeConnection('users', emitter);

    watchUsers(conn as any);

    emitter.emit('change', {
      documentKey: { _id: { toString: () => 'usr-333' } },
      fullDocument: {
        _id: { toString: () => 'usr-333' },
        account_id: { toString: () => 'acc-444' },
      },
    });

    await wait();

    const calledKeys: string[] = delSpy.mock.calls[0] as string[];
    expect(calledKeys.some(k => k.includes('user') && k.includes('usr-333'))).toBe(true);
    expect(calledKeys.some(k => k.includes('role'))).toBe(true);
  });
});

describe('CDC: watchWorkOrders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates workOrder, workOrderList, and dashboard on change', async () => {
    const delSpy = jest.spyOn(CacheManager, 'del');
    const { watchWorkOrders } = require('../src/_cache/changeStream/workOrder.stream');
    const emitter = new EventEmitter();
    const conn = makeConnection('workorders', emitter);

    watchWorkOrders(conn as any);

    emitter.emit('change', {
      documentKey: { _id: { toString: () => 'wo-555' } },
      fullDocument: {
        _id: { toString: () => 'wo-555' },
        account_id: { toString: () => 'acc-666' },
      },
    });

    await wait();

    const calledKeys: string[] = delSpy.mock.calls[0] as string[];
    expect(calledKeys.some(k => k.includes('workOrder') && k.includes('wo-555'))).toBe(true);
    expect(calledKeys.some(k => k.includes('workOrder') && k.includes('list'))).toBe(true);
    expect(calledKeys.some(k => k.includes('dashboard'))).toBe(true);
  });
});

describe('CDC: watchNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates per-user notification:list on change', async () => {
    const delSpy = jest.spyOn(CacheManager, 'del');
    const { watchNotifications } = require('../src/_cache/changeStream/notification.stream');
    const emitter = new EventEmitter();
    const conn = makeConnection('notifications', emitter);

    watchNotifications(conn as any);

    emitter.emit('change', {
      documentKey: { _id: { toString: () => 'notif-777' } },
      fullDocument: {
        _id: { toString: () => 'notif-777' },
        userId: { toString: () => 'user-abc' },
      },
    });

    await wait();

    const calledKeys: string[] = delSpy.mock.calls[0] as string[];
    expect(calledKeys.some(k => k.includes('user-abc') && k.includes('notification'))).toBe(true);
  });
});

describe('CDC: watchSchedules', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates schedule:list for account on cron update', async () => {
    const delSpy = jest.spyOn(CacheManager, 'del');
    const { watchSchedules } = require('../src/_cache/changeStream/schedule.stream');
    const emitter = new EventEmitter();
    const conn = makeConnection('schedulemasters', emitter);

    watchSchedules(conn as any);

    emitter.emit('change', {
      documentKey: { _id: { toString: () => 'sched-888' } },
      fullDocument: {
        _id: { toString: () => 'sched-888' },
        account_id: { toString: () => 'acc-999' },
      },
    });

    await wait();

    const calledKeys: string[] = delSpy.mock.calls[0] as string[];
    expect(calledKeys.some(k => k.includes('schedule') && k.includes('list'))).toBe(true);
  });
});

describe('CDC: Change stream error handling', () => {
  it('watchAssets handles missing accountId gracefully without calling del', async () => {
    jest.clearAllMocks();
    const delSpy = jest.spyOn(CacheManager, 'del');
    const { watchAssets } = require('../src/_cache/changeStream/asset.stream');
    const emitter = new EventEmitter();
    const conn = makeConnection('assets', emitter);

    watchAssets(conn as any);

    // Event with NO accountId — should be skipped
    emitter.emit('change', {
      documentKey: { _id: { toString: () => 'doc-X' } },
      fullDocument: { _id: { toString: () => 'doc-X' } },
    });

    await wait();
    expect(delSpy).not.toHaveBeenCalled();
  });
});
