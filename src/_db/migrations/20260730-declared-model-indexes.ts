import mongoose from 'mongoose';

export interface DeclaredIndexMigrationResult {
  model: string;
  collection: string;
  indexCount: number;
}

interface IndexableModel {
  modelName: string;
  collection: { collectionName: string };
  schema: { indexes: () => unknown[] };
  createIndexes: () => Promise<void>;
}

export const applyDeclaredModelIndexes = async (
  models: IndexableModel[] = mongoose.modelNames()
    .sort()
    .map((modelName) => mongoose.model(modelName) as unknown as IndexableModel)
): Promise<DeclaredIndexMigrationResult[]> => {
  const results: DeclaredIndexMigrationResult[] = [];
  for (const model of models) {
    try {
      await model.createIndexes();
      results.push({
        model: model.modelName,
        collection: model.collection.collectionName,
        indexCount: model.schema.indexes().length
      });
    } catch (error) {
      throw Object.assign(
        new Error(`Declared index migration failed for ${model.modelName}`),
        { cause: error, model: model.modelName }
      );
    }
  }
  return results;
};
