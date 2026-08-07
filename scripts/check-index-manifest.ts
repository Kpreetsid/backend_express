import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import '../src/app';

const repositoryRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repositoryRoot, '.ai', 'baselines', 'mongoose-indexes.json');

const models = mongoose.modelNames().sort().map((modelName) => {
  const model = mongoose.model(modelName);
  const indexes = model.schema.indexes()
    .map(([fields, options]) => ({
      fields,
      options: Object.fromEntries(
        Object.entries(options)
          .filter(([key]) => key !== 'background')
          .sort(([left], [right]) => left.localeCompare(right))
      )
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return {
    model: modelName,
    collection: model.collection.collectionName,
    indexes
  };
});

const manifest = {
  version: 1,
  generatedFrom: 'Mongoose schemas loaded by src/app.ts',
  productionAutoIndex: false,
  modelCount: models.length,
  models
};
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, serialized);
  process.stdout.write(`Wrote ${manifestPath}\n`);
  process.exit(0);
}

if (!fs.existsSync(manifestPath)) {
  process.stderr.write(`Missing Mongoose index manifest: ${manifestPath}\n`);
  process.exit(1);
}
if (fs.readFileSync(manifestPath, 'utf8') !== serialized) {
  process.stderr.write('Mongoose index manifest drift detected. Generate and review an explicit index migration.\n');
  process.exit(1);
}

process.stdout.write(`Mongoose index manifest verified (${models.length} models).\n`);
