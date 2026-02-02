import mongoose from 'mongoose';

class HelperService {
  validateObjectId(id: unknown): mongoose.Types.ObjectId {
    if (typeof id !== 'string' || !id.trim() || !mongoose.Types.ObjectId.isValid(id)) {
      throw Object.assign(new Error('Invalid ID'), { status: 400 });
    }
    return new mongoose.Types.ObjectId(id);
  }

  validateObjectIds(ids: unknown): mongoose.Types.ObjectId[] {
    if (typeof ids !== 'string') {
      throw Object.assign(new Error('Invalid IDs'), { status: 400 });
    }
    const idsArray = ids.split(',').map(id => id.trim()).filter(Boolean);
    if (!idsArray.length) {
      throw Object.assign(new Error('Invalid IDs'), { status: 400 });
    }
    return idsArray.map(id => this.validateObjectId(id));
  }
}

export const helperService = new HelperService();
