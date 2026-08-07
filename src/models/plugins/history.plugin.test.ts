import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logger = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('../../observability/logger', () => ({
  applicationLogger: { error: logger.error }
}));

import { historyPlugin } from './history.plugin';

type Hook = (this: any) => Promise<void>;

const queryResult = (value: any) => {
  const exec = vi.fn().mockResolvedValue(value);
  const lean = vi.fn().mockReturnValue({ exec });
  const read = vi.fn().mockReturnValue({ lean });
  const session = vi.fn().mockReturnValue({ read });
  return { query: { session }, session, read, lean, exec };
};

function createHarness(modelName = 'ExampleModel') {
  const hooks = new Map<string, Hook>();
  const schema = {
    options: { collection: 'examples' },
    statics: {} as Record<string, any>,
    pre: vi.fn((name: string, callback: Hook) => hooks.set(name, callback))
  };
  const historyModel = {
    modelName: `${modelName}History`,
    insertMany: vi.fn().mockResolvedValue([])
  };
  historyPlugin(schema as any, { historyModel: historyModel as any });
  return { schema, hooks, historyModel };
}

describe('history plugin primary-read and audit snapshot behavior', () => {
  beforeEach(() => logger.error.mockReset());

  afterEach(() => vi.restoreAllMocks());

  it.each(['findOneAndUpdate', 'updateOne'])('%s snapshots the pre-image on the primary with its session', async hookName => {
    const { hooks, historyModel } = createHarness();
    const session = { id: 'session-1' };
    const read = queryResult({ _id: 'record-1', createdBy: 'creator-1', value: 'before' });
    const model = {
      modelName: 'ExampleModel',
      collection: { name: 'examples' },
      findOne: vi.fn().mockReturnValue(read.query)
    };
    const hook = hooks.get(hookName)!;

    await hook.call({
      model,
      getQuery: () => ({ _id: 'record-1' }),
      getUpdate: () => ({ $set: { updatedBy: 'editor-1', value: 'after' } }),
      getOptions: () => ({ session })
    });

    expect(read.session).toHaveBeenCalledWith(session);
    expect(read.read).toHaveBeenCalledWith('primary');
    expect(historyModel.insertMany).toHaveBeenCalledWith([expect.objectContaining({
      original_id: 'record-1',
      value: 'before',
      history_created_by: 'editor-1',
      userIdList: []
    })], { session });
  });

  it('snapshots every updateMany pre-image and supports top-level updatedBy', async () => {
    const { hooks, historyModel } = createHarness();
    const read = queryResult([
      { _id: 'record-1', createdBy: 'creator-1' },
      { _id: 'record-2', updatedBy: 'prior-editor' }
    ]);
    const model = {
      modelName: 'ExampleModel',
      collection: { name: 'examples' },
      find: vi.fn().mockReturnValue(read.query)
    };

    await hooks.get('updateMany')!.call({
      model,
      getQuery: () => ({ visible: true }),
      getUpdate: () => ({ updatedBy: 'bulk-editor' }),
      getOptions: () => ({})
    });

    expect(read.session).toHaveBeenCalledWith(null);
    expect(read.read).toHaveBeenCalledWith('primary');
    expect(historyModel.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ original_id: 'record-1', history_created_by: 'bulk-editor' }),
      expect.objectContaining({ original_id: 'record-2', history_created_by: 'bulk-editor' })
    ], {});
  });

  it('does not write history when an update query has no matching pre-image', async () => {
    const { hooks, historyModel } = createHarness();
    const findOneRead = queryResult(null);
    const findRead = queryResult([]);
    const model = {
      modelName: 'ExampleModel',
      findOne: vi.fn().mockReturnValue(findOneRead.query),
      find: vi.fn().mockReturnValue(findRead.query)
    };

    await hooks.get('findOneAndUpdate')!.call({
      model,
      getQuery: () => ({}),
      getUpdate: () => ({}),
      getOptions: () => ({})
    });
    await hooks.get('updateMany')!.call({
      model,
      getQuery: () => ({}),
      getUpdate: () => ({}),
      getOptions: () => ({})
    });

    expect(historyModel.insertMany).not.toHaveBeenCalled();
  });

  it('captures work-order assignments and repairs valid status actor snapshots', async () => {
    const { hooks, historyModel } = createHarness('Schema_WorkOrder');
    const workOrderRead = queryResult({
      _id: 'work-order-1',
      createdBy: 'creator-1',
      status_details: [
        { status: 'Open' },
        { status: '', createdBy: 'ignored-user' },
        null
      ]
    });
    const mappingRead = queryResult([
      { woId: 'work-order-1', userId: 'assignee-1' },
      { woId: 'other', userId: 'ignored' }
    ]);
    const mappingsModel = { find: vi.fn().mockReturnValue(mappingRead.query) };
    const mongooseModel = vi.spyOn(mongoose, 'model').mockReturnValue(mappingsModel as any);
    const model = {
      modelName: 'Schema_WorkOrder',
      collection: { name: 'work_orders' },
      findOne: vi.fn().mockReturnValue(workOrderRead.query)
    };
    const session = { id: 'session-1' };

    await hooks.get('updateOne')!.call({
      model,
      getQuery: () => ({ _id: 'work-order-1' }),
      getUpdate: () => ({ $set: { updatedBy: 'editor-1' } }),
      getOptions: () => ({ session })
    });

    expect(mongooseModel).toHaveBeenCalledWith('Schema_WorkOrderAssignee');
    expect(mappingRead.read).toHaveBeenCalledWith('primary');
    expect(historyModel.insertMany).toHaveBeenCalledWith([expect.objectContaining({
      original_id: 'work-order-1',
      userIdList: ['assignee-1'],
      status_details: [{ status: 'Open', createdBy: 'editor-1' }],
      history_created_by: 'editor-1'
    })], { session });
  });

  it('keeps work-order auditing available if assignment lookup fails', async () => {
    const { hooks, historyModel } = createHarness('Schema_WorkOrder');
    const workOrderRead = queryResult({ _id: 'work-order-1', createdBy: 'creator-1', status_details: null });
    vi.spyOn(mongoose, 'model').mockImplementation(() => {
      throw new Error('mapping model unavailable');
    });
    const model = {
      modelName: 'Schema_WorkOrder',
      collection: { name: 'work_orders' },
      findOne: vi.fn().mockReturnValue(workOrderRead.query)
    };

    await hooks.get('updateOne')!.call({
      model,
      getQuery: () => ({}),
      getUpdate: () => ({}),
      getOptions: () => ({})
    });

    expect(historyModel.insertMany).toHaveBeenCalledWith([expect.objectContaining({
      original_id: 'work-order-1',
      status_details: [],
      userIdList: [],
      history_created_by: 'creator-1'
    })], {});
  });

  it('captures existing document saves with modified values and the document session', async () => {
    const { hooks, historyModel } = createHarness();
    const session = { id: 'session-1' };
    const read = queryResult({ _id: 'record-1', createdBy: 'creator-1', name: 'before' });
    const model = {
      modelName: 'ExampleModel',
      collection: { name: 'examples' },
      findById: vi.fn().mockReturnValue(read.query)
    };

    await hooks.get('save')!.call({
      isNew: false,
      _id: 'record-1',
      constructor: model,
      $session: () => session,
      modifiedPaths: () => ['name', 'updatedBy'],
      get: (path: string) => path === 'name' ? 'after' : 'editor-1'
    });

    expect(read.read).toHaveBeenCalledWith('primary');
    expect(historyModel.insertMany).toHaveBeenCalledWith([expect.objectContaining({
      original_id: 'record-1',
      name: 'before',
      history_created_by: 'editor-1'
    })], { session });
  });

  it('skips new-document saves and prevents recursion on the history model', async () => {
    const { hooks, historyModel } = createHarness();
    await hooks.get('save')!.call({ isNew: true });
    expect(historyModel.insertMany).not.toHaveBeenCalled();

    const read = queryResult({ _id: 'history-1', createdBy: 'creator-1' });
    const model = {
      modelName: historyModel.modelName,
      findOne: vi.fn().mockReturnValue(read.query)
    };
    await hooks.get('updateOne')!.call({
      model,
      getQuery: () => ({}),
      getUpdate: () => ({}),
      getOptions: () => ({})
    });
    expect(historyModel.insertMany).not.toHaveBeenCalled();
  });

  it('logs middleware read failures without breaking the protected mutation', async () => {
    const { hooks } = createHarness();
    const failure = new Error('snapshot read failed');
    const read = queryResult(null);
    read.exec.mockRejectedValue(failure);
    const model = { modelName: 'ExampleModel', findOne: vi.fn().mockReturnValue(read.query) };

    await expect(hooks.get('findOneAndUpdate')!.call({
      model,
      getQuery: () => ({}),
      getUpdate: () => ({}),
      getOptions: () => ({})
    })).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      { err: failure },
      'History Plugin Error (findOneAndUpdate):'
    );
  });

  it('exposes the configured history model through the schema static', () => {
    const { schema, historyModel } = createHarness();
    const getHistoryModel = schema.statics['getHistoryModel'];

    expect(getHistoryModel.call({ modelName: 'ExampleModel' })).toBe(historyModel);
    expect(getHistoryModel.call({ modelName: 'ExampleModel' })).toBe(historyModel);
  });
});
