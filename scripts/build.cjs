'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });

const tsc = process.platform === 'win32'
  ? path.join(root, 'node_modules', '.bin', 'tsc.cmd')
  : path.join(root, 'node_modules', '.bin', 'tsc');
const result = spawnSync(tsc, [], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const sourcePublic = path.join(root, 'src', 'public');
const targetPublic = path.join(dist, 'public');
fs.mkdirSync(targetPublic, { recursive: true });
fs.cpSync(sourcePublic, targetPublic, { recursive: true });
