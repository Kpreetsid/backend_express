const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const tests = [];
function collect(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.test\.(ts|cjs)$/.test(entry.name) && !/\.vitest\.test\.ts$/.test(entry.name)) tests.push(file);
  }
}
collect(path.join(root, 'src'));
collect(path.join(root, 'test'));
const env = { ...process.env, NODE_ENV: 'test', REDIS_ENABLED: 'false', TZ: 'UTC',
  AUTH_ISSUER: 'cmms-regression', AUTH_AUDIENCE: 'cmms-regression', AUTH_ALGORITHM: 'HS256' };
for (const key of ['AUTH_SECRET', 'EXTERNAL_AUTH_SECRET', 'REFRESH_TOKEN_SECRET']) env[key] = randomBytes(48).toString('hex');
const result = spawnSync(process.execPath, ['--require', 'ts-node/register/transpile-only', '--test', ...tests], { cwd: root, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
