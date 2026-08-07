const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repositoryRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repositoryRoot, 'src');
const baselinePath = path.join(repositoryRoot, '.ai', 'baselines', 'api-routes.sha256');
const routeFilePattern = /\.(routes?|controller)\.ts$/i;
const routePattern = /\b(?:app|router|outer|apiRouter|healthRouter|metricsRouter|cryptoRouter|[A-Za-z_$][\w$]*Router)\s*\.\s*(get|post|put|patch|delete|options|head|use)\s*\(\s*(\[[^\]]+\]|`[^`]+`|'[^']+'|"[^"]+")/g;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(absolute) : [absolute];
    });
}

function normalizePathExpression(expression) {
  return expression.replace(/\s+/g, ' ').trim();
}

function inventory() {
  const candidates = walk(sourceRoot)
    .filter((file) => routeFilePattern.test(file) || path.basename(file) === 'app.ts')
    .sort();
  const entries = [];

  for (const file of candidates) {
    const relativeFile = path.relative(repositoryRoot, file).replaceAll('\\', '/');
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = routePattern.exec(source)) !== null) {
      entries.push(`${relativeFile} ${match[1].toUpperCase()} ${normalizePathExpression(match[2])}`);
    }
  }

  return [...new Set(entries)].sort().join('\n') + '\n';
}

const actual = inventory();
if (process.argv.includes('--print')) {
  process.stdout.write(actual);
  process.exit(0);
}
const actualHash = crypto.createHash('sha256').update(actual).digest('hex');
if (process.argv.includes('--hash')) {
  process.stdout.write(`${actualHash} ${actual.trim().split('\n').length}\n`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error(`Missing API route baseline: ${baselinePath}`);
  console.error('Run with --print, review the inventory, and update the approved baseline.');
  process.exit(1);
}

const [expectedHash] = fs.readFileSync(baselinePath, 'utf8').trim().split(/\s+/);
if (actualHash !== expectedHash) {
  console.error('API route declarations changed. Existing route contracts are immutable.');
  console.error('Review the diff and update the baseline only after compatibility approval.');
  console.error(`Expected ${expectedHash}; received ${actualHash}.`);
  console.error('Run `npm run check:api-contract -- --print` to inspect the current inventory.');
  process.exit(1);
}

console.log(`API route contract baseline verified (${actual.trim().split('\n').length} declarations).`);
