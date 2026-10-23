import mongoose from 'mongoose';

class HelperService {
  hasValue(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.some((item) => this.hasValue(item));
    }
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized !== '' && normalized !== 'null' && normalized !== 'undefined';
  }

  validateObjectId(id: unknown): mongoose.Types.ObjectId {
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (typeof id !== 'string' || !id.trim() || !mongoose.Types.ObjectId.isValid(id)) {
      throw Object.assign(new Error(`Invalid ObjectId: ${id}`), { status: 400 });
    }
    return new mongoose.Types.ObjectId(id);
  }

  validateObjectIds(ids: unknown): mongoose.Types.ObjectId[] {
    let idsArray: string[] = [];
    if (typeof ids === 'string') {
      idsArray = ids.split(',').map(id => id.trim()).filter(Boolean);
    } else if (Array.isArray(ids)) {
      idsArray = ids.map(id => String(id).trim()).filter(Boolean);
    } else {
      throw Object.assign(new Error('Invalid ObjectIds format'), { status: 400 });
    }

    if (!idsArray.length) {
      throw Object.assign(new Error('No ObjectIds provided'), { status: 400 });
    }
    return idsArray.map(id => this.validateObjectId(id));
  }

  validateOptionalObjectId(id: unknown): mongoose.Types.ObjectId | null {
    return this.hasValue(id) ? this.validateObjectId(String(id)) : null;
  }

  validateOptionalObjectIds(ids: unknown): mongoose.Types.ObjectId[] {
    if (!this.hasValue(ids)) {
      return [];
    }
    return this.validateObjectIds(ids);
  }

  toPlainObject<T = any>(doc: any): T {
    if (!doc || typeof doc !== 'object') {
      return doc;
    }
    if (typeof doc.toObject === 'function') {
      return doc.toObject();
    }
    return { ...doc };
  }

  parseDurationSeconds(value: string | number | undefined, fallbackSeconds: number = 7 * 24 * 60 * 60): number {
    if (!value) {
      return fallbackSeconds;
    }
    if (typeof value === 'number') {
      return value;
    }
    const match = /^(\d+)([smhd])?$/i.exec(String(value).trim());
    if (!match) {
      const parsed = Number.parseInt(String(value), 10);
      return Number.isNaN(parsed) ? fallbackSeconds : parsed;
    }
    const amount = Number(match[1]);
    const unit = match[2]?.toLowerCase();
    switch (unit) {
      case 's': return amount;
      case 'm': return amount * 60;
      case 'h': return amount * 60 * 60;
      case 'd': return amount * 24 * 60 * 60;
      default: return amount;
    }
  }
}

export const helperService = new HelperService();
