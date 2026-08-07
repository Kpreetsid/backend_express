const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repositoryRoot, 'src');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const violations = [];
for (const file of walk(sourceRoot).filter((candidate) => candidate.endsWith('.ts'))) {
  if (file.endsWith('.test.ts')) continue;
  const relativeFile = path.relative(repositoryRoot, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');

  if (/\bconsole\.(?:log|info|warn|error|debug|group|groupEnd)\b/.test(source)) {
    violations.push(`${relativeFile}: use the redacted structured application logger`);
  }
  if (relativeFile !== 'src/configDB.ts' && /\bprocess\.env\b/.test(source)) {
    violations.push(`${relativeFile}: route environment access through src/configDB.ts`);
  }
}

const partsRoutes = fs.readFileSync(
  path.join(sourceRoot, 'masters', 'part', 'parts.routes.ts'),
  'utf8'
);
// Generated and developer-authored files may use either platform line ending.
// Normalize before checking the ordered multipart pipeline so the boundary gate
// enforces middleware semantics consistently on Windows and Linux CI runners.
const normalizedPartsRoutes = partsRoutes.replace(/\r\n/g, '\n');
if (normalizedPartsRoutes.includes('partRouter.use(idempotencyMiddleware)')) {
  violations.push(
    'src/masters/part/parts.routes.ts: install idempotency after multipart parsing and explicitly on each mutation'
  );
}
const importStart = normalizedPartsRoutes.indexOf("partRouter.post(\n        '/import'");
const importEnd = normalizedPartsRoutes.indexOf('partsController.importParts', importStart);
const importPipeline = importStart >= 0 && importEnd > importStart
  ? normalizedPartsRoutes.slice(importStart, importEnd)
  : '';
const importStages = [
  'importUpload.single',
  'payloadCryptoMultipartMiddleware',
  'idempotencyMiddleware'
].map((stage) => importPipeline.indexOf(stage));
if (
  importStages.some((position) => position < 0) ||
  !(importStages[0] < importStages[1] && importStages[1] < importStages[2])
) {
  violations.push(
    'src/masters/part/parts.routes.ts: parts import must parse, decrypt, then fingerprint the uploaded file'
  );
}
for (const mutationContract of [
  "partRouter.post('/cycle-counts', idempotencyMiddleware",
  "partRouter.put('/cycle-counts/:id/approve', idempotencyMiddleware",
  "partRouter.post('/', idempotencyMiddleware",
  "partRouter.put('/:id', idempotencyMiddleware",
  "partRouter.patch('/:id', idempotencyMiddleware",
  "partRouter.post('/:id/transfer', idempotencyMiddleware"
]) {
  if (!normalizedPartsRoutes.includes(mutationContract)) {
    violations.push(
      `src/masters/part/parts.routes.ts: missing mutation idempotency contract ${mutationContract}`
    );
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Runtime boundaries verified (structured logs and centralized environment access).');
