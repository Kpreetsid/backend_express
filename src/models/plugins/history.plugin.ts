import mongoose, { Schema } from 'mongoose';

export interface IHistoryOptions {
  historyCollectionName?: string;
  historyModelName?: string;
  historyModel?: mongoose.Model<any>;
}

/**
 * Mongoose plugin to automatically create a history log of documents before they are updated.
 * It simulates a "before-update trigger" by fetching existing documents and storing a snapshot
 * in a corresponding history collection.
 */
export function historyPlugin(schema: Schema, options: IHistoryOptions = {}) {
  let HistoryModel: mongoose.Model<any>;

  const getHistoryActor = (doc: any, updatedBy: any) => updatedBy || doc.updatedBy || doc.createdBy;

  const normalizeHistorySnapshot = (model: mongoose.Model<any>, doc: any, updatedBy: any) => {
    if (model.modelName !== 'Schema_WorkOrder') {
      return { ...doc };
    }

    const fallbackCreatedBy = getHistoryActor(doc, updatedBy);
    const statusDetails = Array.isArray(doc.status_details)
      ? doc.status_details.map((entry: any) => ({
        ...entry,
        createdBy: entry?.createdBy || fallbackCreatedBy
      })).filter((entry: any) => !!entry?.status && !!entry?.createdBy)
      : [];

    return {
      ...doc,
      status_details: statusDetails
    };
  };

  // Lazy initialization of the History model to ensure we have access to the original model's details
  const getHistoryModel = (model: mongoose.Model<any>) => {
    if (HistoryModel) return HistoryModel;
    
    if (options.historyModel) {
      HistoryModel = options.historyModel;
      return HistoryModel;
    }

    // Determine collection name
    const originalCollectionName = model.collection?.name || schema.options.collection || `${model.modelName}s`.toLowerCase();
    const historyCollectionName = options.historyCollectionName || `hst_${originalCollectionName}`;
    const historyModelName = options.historyModelName || `${model.modelName}History`;

    // Check if it's already registered
    if (mongoose.models[historyModelName]) {
      HistoryModel = mongoose.models[historyModelName];
    } else {
      const HistorySchema = new Schema({
        original_id: { type: Schema.Types.ObjectId, required: true, index: true },
        history_created_at: { type: Date, default: Date.now, index: true }
      }, {
        collection: historyCollectionName,
        versionKey: false,
        strict: false // Allow any fields from the original document to be stored at the root
      });

      HistoryModel = mongoose.model(historyModelName, HistorySchema);
    }
    return HistoryModel;
  };

  /**
   * Helper function to save history logs.
   * Uses insertMany to handle batching smoothly.
   */
  const logHistory = async (model: mongoose.Model<any>, docs: any[], update: any, action: string, session?: mongoose.ClientSession | null) => {
    if (!docs || docs.length === 0) return;
    const HModel = getHistoryModel(model);

    // Try to extract updatedBy from the update query if it exists
    let updatedBy = null;
    if (update && update.$set && update.$set.updatedBy) {
      updatedBy = update.$set.updatedBy;
    } else if (update && update.updatedBy) {
      updatedBy = update.updatedBy;
    }

    // Fetch mapped users if it's a work order to store assignment snapshot
    let mappings: any[] = [];
    if (model.modelName === 'Schema_WorkOrder') {
      try {
        const MappingsModel = mongoose.model('Schema_WorkOrderAssignee');
        mappings = await MappingsModel.find({ woId: { $in: docs.map(d => d._id) } }).session(session || null).lean().exec();
      } catch (err) {
        // Silently fail if model not registered or query fails to avoid breaking main update
      }
    }

    const historyDocs = docs.map(doc => {
      const normalizedDoc = normalizeHistorySnapshot(model, doc, updatedBy);
      const { _id, ...rest } = normalizedDoc;
      const docMappings = mappings.filter(m => String(m.woId) === String(_id)).map(m => m.userId);
      
      return {
        ...rest,
        original_id: _id,
        userIdList: docMappings,
        history_created_by: getHistoryActor(doc, updatedBy)
      };
    });

    // Avoid infinite loop if somehow this plugin is applied to the history model
    if (model.modelName === HModel.modelName) return;

    await HModel.insertMany(historyDocs, session ? { session } : {});
  };

  schema.pre('findOneAndUpdate', async function () {
    const query = this.getQuery();
    const update = this.getUpdate();
    const options = this.getOptions();
    
    try {
      const doc = await this.model.findOne(query).session(options.session || null).lean().exec();
      if (doc) {
        await logHistory(this.model, [doc], update, 'UPDATE', options.session);
      }
    } catch (error) {
      console.error(`History Plugin Error (findOneAndUpdate):`, error);
    }
  });

  schema.pre('updateOne', async function () {
    const query = this.getQuery();
    const update = this.getUpdate();
    const options = this.getOptions();
    
    try {
      const doc = await this.model.findOne(query).session(options.session || null).lean().exec();
      if (doc) {
        await logHistory(this.model, [doc], update, 'UPDATE', options.session);
      }
    } catch (error) {
      console.error(`History Plugin Error (updateOne):`, error);
    }
  });

  schema.pre('updateMany', async function () {
    const query = this.getQuery();
    const update = this.getUpdate();
    const options = this.getOptions();
    
    try {
      // For large datasets, this might consume memory, but .lean() helps. 
      // A more robust solution for huge datasets would involve streams.
      const docs = await this.model.find(query).session(options.session || null).lean().exec();
      if (docs && docs.length > 0) {
        await logHistory(this.model, docs, update, 'UPDATE', options.session);
      }
    } catch (error) {
      console.error(`History Plugin Error (updateMany):`, error);
    }
  });

  // Optional: capture save() for existing documents
  schema.pre('save', async function () {
    if (!this.isNew) {
      try {
        const model = this.constructor as mongoose.Model<any>;
        // We only have the session if it's explicitly passed, we'll try to retrieve it if possible
        const session = this.$session();
        
        const doc = await model.findById(this._id).session(session || null).lean().exec();
        if (doc) {
          const update = this.modifiedPaths().reduce((acc, path) => {
            acc[path] = this.get(path);
            return acc;
          }, {} as any);
          
          await logHistory(model, [doc], { $set: update }, 'UPDATE_SAVE', session);
        }
      } catch (error) {
        console.error(`History Plugin Error (save):`, error);
      }
    }
  });

  // Add static method to the original schema to allow easy access to the history model
  schema.statics['getHistoryModel'] = function() {
    return getHistoryModel(this);
  };
}
