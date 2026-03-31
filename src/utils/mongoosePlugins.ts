import { Schema } from 'mongoose';

/**
 * Standardizes the 'id' field to mirror '_id' in database results.
 * Optimized to safely handle both plain objects and Mongoose documents.
 */
function standardizeObject(doc: any) {
  // Only process standard objects, exclude null, primitives, and Mongoose internal types like Buffers/ObjectIds
  if (!doc || typeof doc !== 'object' || doc instanceof Date || Buffer.isBuffer(doc)) return;

  // Add 'id' mirroring '_id' if not already present
  if (doc._id && !doc.hasOwnProperty('id')) {
    // Keep it a string representation for the 'id' field
    doc.id = doc._id.toString();
  }

  // If this is a Mongoose document, we should not recurse into its internal structure.
  // The virtuals/transformers will handle documents.
  // We only recurse into POJOs (like from .lean() or aggregation).
  if (typeof doc.toObject === 'function') return;

  // Recurse through all properties to handle nested lookups/populate results (for POJOs only)
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

/**
 * Global Mongoose plugin to ensure 'id' is always available as the string representation of '_id'.
 */
export const idStandardizationPlugin = (schema: Schema) => {
  // Handle documents during serialization
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

  // Handle queries using .lean() or manual results.
  schema.post(/^(find|findOne|findOneAndUpdate|findById)/, function(res: any) {
    if (!res) return;
    
    if (Array.isArray(res)) {
      res.forEach(standardizeObject);
    } else {
      standardizeObject(res);
    }
  });

  // Handle aggregation results with safe recursive object processing.
  schema.post('aggregate', function(res: any) {
    if (!res || !Array.isArray(res)) return;
    res.forEach(standardizeObject);
  });
};
