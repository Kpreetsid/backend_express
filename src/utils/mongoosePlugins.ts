import { Schema } from 'mongoose';

/**
 * Standardizes the 'id' field to mirror '_id' in database results.
 * Only processes plain JavaScript objects (POJOs) for deep recursion to avoid corrupting internal types.
 */
function standardizeObject(doc: any) {
  // Exit if null, primitive, or not a "standard" JavaScript object
  if (!doc || typeof doc !== 'object' || doc instanceof Date || Buffer.isBuffer(doc)) return;

  // Add 'id' mirroring '_id' if not already present
  if (doc._id && !Object.prototype.hasOwnProperty.call(doc, 'id')) {
    doc.id = doc._id.toString();
  }

  // ONLY recurse into plain objects or arrays
  // This prevents corrupting Mongoose Internal types, Buffers, or other complex objects
  if (doc.constructor === Object || Array.isArray(doc)) {
    for (const key in doc) {
      if (Object.prototype.hasOwnProperty.call(doc, key)) {
        const value = doc[key];
        if (Array.isArray(value)) {
          value.forEach(item => standardizeObject(item));
        } else if (value && typeof value === 'object') {
          standardizeObject(value);
        }
      }
    }
  }
}

/**
 * Global Mongoose plugin to ensure 'id' is always available as the string representation of '_id'.
 */
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

  // Handle lean find() queries
  schema.post(/^(find|findOne|findOneAndUpdate|findById)/, function(res: any) {
    if (!res) return;
    
    // In post-find, if it's not lean, it's a document. If lean, it's a POJO.
    // We only need to manually standardize if it's Not a document (POJO).
    if (Array.isArray(res)) {
      res.forEach(doc => {
        if (doc && typeof doc.toObject !== 'function') {
           standardizeObject(doc);
        }
      });
    } else {
      if (res && typeof res.toObject !== 'function') {
         standardizeObject(res);
      }
    }
  });

  // Handle aggregation results with safe recursive object processing.
  schema.post('aggregate', function(res: any) {
    if (!res || !Array.isArray(res)) return;
    res.forEach(standardizeObject);
  });
};
