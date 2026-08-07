import { describe, expect, it, vi } from 'vitest';
import { idStandardizationPlugin } from './mongoosePlugins';

const createSchema = () => ({
  set: vi.fn(),
  post: vi.fn()
});

describe('idStandardizationPlugin', () => {
  it('configures JSON/object transforms without overwriting an existing id', () => {
    const schema = createSchema();
    idStandardizationPlugin(schema as any);

    expect(schema.set.mock.calls.map(([name]) => name)).toEqual(['toJSON', 'toObject']);
    const options = schema.set.mock.calls[0]![1];
    expect(options).toMatchObject({ virtuals: true, versionKey: false });
    expect(options.transform({}, { _id: 123 })).toEqual({ _id: 123, id: '123' });
    expect(options.transform({}, { _id: 123, id: 'stable' })).toEqual({
      _id: 123,
      id: 'stable'
    });
  });

  it('standardizes nested lean query results while leaving document-like values untouched', () => {
    const schema = createSchema();
    idStandardizationPlugin(schema as any);
    const queryHook = schema.post.mock.calls[0]![1];
    const documentLike = { _id: 'document-id', toObject: () => ({}) };
    const internalDocument = { _id: 'internal-id', $__: {} };
    const result: any[] = [{
      _id: 'root-id',
      nested: { _id: 'nested-id' },
      children: [{ _id: 'child-id' }],
      date: new Date('2026-08-01T00:00:00.000Z'),
      buffer: Buffer.from('data'),
      documentLike,
      internalDocument
    }];

    queryHook(result);

    expect(result[0].id).toBe('root-id');
    expect(result[0].nested.id).toBe('nested-id');
    expect(result[0].children[0].id).toBe('child-id');
    expect((documentLike as any).id).toBeUndefined();
    expect((internalDocument as any).id).toBeUndefined();
    expect(() => queryHook(null)).not.toThrow();
  });

  it('standardizes aggregate arrays and ignores non-array aggregate results', () => {
    const schema = createSchema();
    idStandardizationPlugin(schema as any);
    const aggregateHook = schema.post.mock.calls[1]![1];
    const result = [{ _id: 'aggregate-id', nested: { _id: 'nested-id' } }];

    aggregateHook(result);

    expect(result[0]).toMatchObject({ id: 'aggregate-id', nested: { id: 'nested-id' } });
    expect(() => aggregateHook(null)).not.toThrow();
    expect(() => aggregateHook({ _id: 'not-an-array' })).not.toThrow();
  });

  it('handles a single lean result and an absent query result', () => {
    const schema = createSchema();
    idStandardizationPlugin(schema as any);
    const queryHook = schema.post.mock.calls[0]![1];
    const result = { _id: 'single-id' };

    queryHook(result);

    expect(result).toEqual({ _id: 'single-id', id: 'single-id' });
    expect(() => queryHook(undefined)).not.toThrow();
  });
});
