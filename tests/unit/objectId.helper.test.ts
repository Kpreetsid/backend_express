import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { helperService } from '../../src/common/utils/object-id.helper';

describe('HelperService ObjectId Validation', () => {
  it('should validate and return a valid mongoose.Types.ObjectId', () => {
    const validHex = '507f1f77bcf86cd799439011';
    const result = helperService.validateObjectId(validHex);
    expect(result).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(result.toString()).toBe(validHex);
  });

  it('should return existing ObjectId if already an instance', () => {
    const objId = new mongoose.Types.ObjectId();
    const result = helperService.validateObjectId(objId);
    expect(result).toBe(objId);
  });

  it('should throw 400 error for invalid ObjectId string', () => {
    expect(() => helperService.validateObjectId('invalid-id')).toThrowError();
  });

  it('should validate array of ObjectIds', () => {
    const id1 = '507f1f77bcf86cd799439011';
    const id2 = '507f1f77bcf86cd799439012';
    const result = helperService.validateObjectIds([id1, id2]);
    expect(result).toHaveLength(2);
    expect(result[0].toString()).toBe(id1);
    expect(result[1].toString()).toBe(id2);
  });
});
