'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });

// Run the local compiler with Node; Windows .cmd shims require a shell.
const tsc = require.resolve('typescript/bin/tsc');
const result = spawnSync(process.execPath, [tsc], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

// Node does not resolve tsconfig aliases; emit relative paths for production.
const aliasResult = spawnSync(process.execPath, [require.resolve('tsc-alias/dist/bin/index.js')], {
  cwd: root,
  stdio: 'inherit',
});
if (aliasResult.error) throw aliasResult.error;
if (aliasResult.status !== 0) process.exit(aliasResult.status || 1);

const sourcePublic = path.join(root, 'src', 'public');
const targetPublic = path.join(dist, 'public');
fs.mkdirSync(targetPublic, { recursive: true });
fs.cpSync(sourcePublic, targetPublic, { recursive: true });
