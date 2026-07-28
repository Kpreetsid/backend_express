import { Schema } from 'mongoose';

export function syncVersionPlugin(schema: Schema): void {
  schema.add({ sync_version: { type: Number, default: 0, min: 0 } });

  schema.post('init', function(document: any) {
    document.$locals.cmmsSyncVersion = Number(document.get('sync_version') || 0);
  });

  schema.pre('save', function() {
    if (this.isNew) {
      this.set('sync_version', 0);
      return;
    }
    if (!this.isNew && this.isModified()) {
      const current = Number(this.$locals['cmmsSyncVersion'] ?? this.get('sync_version') ?? 0);
      this.set('sync_version', current + 1);
    }
  });

  schema.post('save', function(document: any) {
    document.$locals.cmmsSyncVersion = Number(document.get('sync_version') || 0);
  });

  const incrementQueryVersion = function(this: any): void {
    const update = this.getUpdate() || {};
    if (Array.isArray(update)) {
      update.push({ $set: { sync_version: { $add: [{ $ifNull: ['$sync_version', 0] }, 1] } } });
    } else {
      delete update.sync_version;
      if (update.$set) delete update.$set.sync_version;
      if (update.$setOnInsert) delete update.$setOnInsert.sync_version;
      update.$inc = { ...(update.$inc || {}), sync_version: 1 };
    }
    this.setUpdate(update);
  };

  schema.pre(/^(findOneAndUpdate|updateOne|updateMany)$/, incrementQueryVersion);
}
