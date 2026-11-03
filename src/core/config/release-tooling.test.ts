import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('development inspector is loopback-only and production start is inspector-free', () => {
  assert.match(packageJson.scripts.dev, /--inspect=127\.0\.0\.1:9229/);
  assert.doesNotMatch(packageJson.scripts.dev, /--inspect=0\.0\.0\.0/);
  assert.doesNotMatch(packageJson.scripts.start, /--inspect/);
});

test('build does not depend on on-demand npx package execution', () => {
  assert.equal(packageJson.scripts.build, 'node scripts/build.cjs');
  assert.doesNotMatch(packageJson.scripts.build, /npx/);
});
