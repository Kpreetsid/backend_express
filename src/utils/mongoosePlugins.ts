import { Schema } from 'mongoose';

/**
 * Standardizes the 'id' field to mirror '_id' in all database results.
 * Handles recursion for nested objects inside aggregation pipelines.
 */
function standardizeObject(doc: any) {
  if (!doc || typeof doc !== 'object') return;

  // Add 'id' mirroring '_id' if not already present
  if (doc._id && !doc.hasOwnProperty('id')) {
    doc.id = typeof doc._id === 'object' ? doc._id.toString() : doc._id;
  }

  // Recurse through all properties to handle nested lookups/populate results
  for (const key in doc) {
    if (doc.hasOwnProperty(key)) {
      const value = doc[key];
      if (Array.isArray(value)) {
        value.forEach(item => standardizeObject(item));
      } else if (value && typeof value === 'object' && !(value instanceof Date)) {
        standardizeObject(value);
      }
    }
  }
}

/**
 * Global Mongoose plugin to ensure 'id' is always available as the string representation of '_id'.
 */
export const idStandardizationPlugin = (schema: Schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (doc: any, ret: any) => {
      if (ret._id && !ret.id) {
        ret.id = ret._id.toString();
      }
      return ret;
    }
  });

  schema.set('toObject', {
    virtuals: true,
    versionKey: false,
    transform: (doc: any, ret: any) => {
      if (ret._id && !ret.id) {
        ret.id = ret._id.toString();
      }
      return ret;
    }
  });

  // Handle queries using .lean() or manual results.
  // We use post hooks to ensure results handled via lean() also get the id field.
  schema.post(/^(find|findOne|findOneAndUpdate|findById)/, function(res: any) {
    if (!res) return;
    
    if (Array.isArray(res)) {
      res.forEach(standardizeObject);
    } else {
      standardizeObject(res);
    }
  });

  // Handle aggregation results with recursive object processing.
  schema.post('aggregate', function(res: any) {
    if (!res || !Array.isArray(res)) return;
    res.forEach(standardizeObject);
  });
};
