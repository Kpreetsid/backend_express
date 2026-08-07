const assert = require('node:assert/strict');
const test = require('node:test');
const {
  loadRuntimeSecret,
  parseRuntimeSecret,
  runRuntimeCommand
} = require('./run-with-runtime-secret.cjs');

test('parses scalar CMMS configuration without exposing shell execution', () => {
  assert.deepEqual(
    parseRuntimeSecret(JSON.stringify({
      MONGO_URI: 'mongodb://managed.example/cmms',
      REDIS_ENABLED: true,
      SERVER_PORT: 3000
    })),
    {
      MONGO_URI: 'mongodb://managed.example/cmms',
      REDIS_ENABLED: 'true',
      SERVER_PORT: '3000'
    }
  );
  assert.throws(
    () => parseRuntimeSecret('{"NODE_OPTIONS":"--require /tmp/attack.js"}'),
    /prohibited environment key/
  );
  assert.throws(
    () => parseRuntimeSecret('{"AUTH_SECRET":{"nested":true}}'),
    /must be scalar/
  );
});

test('loads one Secrets Manager JSON document with explicit region and identifier', () => {
  const calls = [];
  const result = loadRuntimeSecret({
    secretId: 'arn:aws:secretsmanager:ap-south-1:123:secret:cmms',
    region: 'ap-south-1',
    execFileSyncImpl: (...args) => {
      calls.push(args);
      return '{"AUTH_SECRET":"secure-value"}';
    }
  });

  assert.deepEqual(result, { AUTH_SECRET: 'secure-value' });
  assert.equal(calls[0][0], 'aws');
  assert.deepEqual(calls[0][1], [
    'secretsmanager',
    'get-secret-value',
    '--secret-id',
    'arn:aws:secretsmanager:ap-south-1:123:secret:cmms',
    '--region',
    'ap-south-1',
    '--query',
    'SecretString',
    '--output',
    'text'
  ]);
});

test('runs only approved commands with secret values and production mode', () => {
  let invocation;
  const status = runRuntimeCommand('node', ['dist/server.js'], {
    baseEnvironment: { SAFE_BASE: 'value' },
    secretEnvironment: { AUTH_SECRET: 'secret-value' },
    spawnSyncImpl: (command, args, options) => {
      invocation = { command, args, options };
      return { status: 0 };
    }
  });

  assert.equal(status, 0);
  assert.equal(invocation.command, 'node');
  assert.deepEqual(invocation.args, ['dist/server.js']);
  assert.deepEqual(invocation.options.env, {
    SAFE_BASE: 'value',
    AUTH_SECRET: 'secret-value',
    NODE_ENV: 'production'
  });
  assert.equal(invocation.options.shell, false);
  assert.throws(
    () => runRuntimeCommand('bash', ['-c', 'echo unsafe'], {
      secretEnvironment: { AUTH_SECRET: 'secret-value' }
    }),
    /Unsupported runtime command/
  );
});
