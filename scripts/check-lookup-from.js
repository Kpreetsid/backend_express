const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src');
const hardcodedLookupFrom = /(?<![\w$])from\s*:\s*(['"`])[^'"`$]+?\1/g;
const ignoredDirs = new Set(['node_modules', 'dist', 'public']);
const failures = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!/\.(ts|js)$/.test(entry.name)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    let match;
    while ((match = hardcodedLookupFrom.exec(content)) !== null) {
      const nearbyAggregationStage = content.slice(Math.max(0, match.index - 500), match.index).includes('$lookup');
      if (!nearbyAggregationStage) continue;

      const before = content.slice(0, match.index);
      const line = before.split(/\r?\n/).length;
      failures.push(`${path.relative(process.cwd(), fullPath)}:${line}: ${match[0]}`);
    }
  }
}

walk(root);

if (failures.length) {
  console.error('Hardcoded aggregation $lookup.from values found. Use {Model}.collection.name instead:\n');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('No hardcoded aggregation $lookup.from values found.');
