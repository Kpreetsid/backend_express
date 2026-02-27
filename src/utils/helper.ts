import mongoose from 'mongoose';

class HelperService {
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
}

export const helperService = new HelperService();
