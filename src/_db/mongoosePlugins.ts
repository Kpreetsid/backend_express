import mongoose, { Schema } from 'mongoose';

/**
 * Standardizes the 'id' field to mirror '_id' in database results.
 * Only processes plain JavaScript objects (POJOs) for deep recursion to avoid corrupting internal types like ObjectId or Buffer.
 */
function standardizeObject(doc: any) {
  // 1. Basic type check: Only proceed for actual objects
  if (!doc || typeof doc !== 'object') return;

  // 2. Safety filter: Skip sensitive or pre-typed objects that shouldn't be recursed or modified
  if (
    doc instanceof Date || 
    Buffer.isBuffer(doc) || 
    doc instanceof mongoose.Types.ObjectId ||
    doc instanceof mongoose.Types.Decimal128 ||
    (doc.constructor && doc.constructor.name === 'ObjectID')
  ) {
    return;
  }

  // 3. Document check: Mongoose documents handle virtuals natively, so we don't manually touch them or recurse internals.
  if (typeof doc.toObject === 'function' || doc.$__) {
    return;
  }

  // 4. Mirror _id to id if it exists and hasn't been added yet
  if (doc._id && !Object.prototype.hasOwnProperty.call(doc, 'id')) {
    doc.id = doc._id.toString();
  }

  // 5. Deep Recursion: ONLY for plain objects or arrays
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

/**
 * Global Mongoose plugin to ensure 'id' is always available as the string representation of '_id'.
 * Handles documents via serialization transforms and POJOs (lean/aggregate) via safe recursive post-hooks.
 */
export const idStandardizationPlugin = (schema: Schema) => {
  const options = {
    virtuals: true,
    versionKey: false,
    transform: (doc: any, ret: any) => {
      // Standardize the top level
      if (ret._id && !ret.id) {
        ret.id = ret._id.toString();
      }
      return ret;
    }
  };

  schema.set('toJSON', options);
  schema.set('toObject', options);

  // Handle results from find/findOne/etc. (specifically lean() queries)
  schema.post(/^(find|findOne|findOneAndUpdate|findById)/, function(res: any) {
    if (!res) return;
    
    if (Array.isArray(res)) {
      res.forEach(item => standardizeObject(item));
    } else {
      standardizeObject(res);
    }
  });

  // Handle results from aggregation pipelines
  schema.post('aggregate', function(res: any) {
    if (!res || !Array.isArray(res)) return;
    res.forEach(item => standardizeObject(item));
  });
};
