import mongoose, { Schema } from 'mongoose';

function standardizeObject(doc: any) {
  if (!doc || typeof doc !== 'object') return;
  if (doc instanceof Date || Buffer.isBuffer(doc) || doc instanceof mongoose.Types.ObjectId || doc instanceof mongoose.Types.Decimal128 || (doc.constructor && doc.constructor.name === 'ObjectID')) {
    return;
  }
  if (typeof doc.toObject === 'function' || doc.$__) {
    return;
  }
  if (doc._id && !Object.prototype.hasOwnProperty.call(doc, 'id')) {
    doc.id = doc._id.toString();
  }
  if (Array.isArray(doc)) {
    for (let i = 0; i < doc.length; i++) {
      standardizeObject(doc[i]);
    }
  } else if (doc.constructor && doc.constructor.name === 'Object') {
    for (const key in doc) {
      if (Object.prototype.hasOwnProperty.call(doc, key)) {
        standardizeObject(doc[key]);
      }
    }
  }
}

export const idStandardizationPlugin = (schema: Schema) => {
  const options = {
    virtuals: true,
    versionKey: false,
    transform: (doc: any, ret: any) => {
      if (ret._id && !ret.id) {
        ret.id = ret._id.toString();
      }
      return ret;
    }
  };

  schema.set('toJSON', options);
  schema.set('toObject', options);

  schema.post(/^(find|findOne|findOneAndUpdate|findById)/, function(res: any) {
    if (!res) return;
        if (Array.isArray(res)) {
      res.forEach(item => standardizeObject(item));
    } else {
      standardizeObject(res);
    }
  });

  schema.post('aggregate', function(res: any) {
    if (!res || !Array.isArray(res)) return;
    res.forEach(item => standardizeObject(item));
  });
};
