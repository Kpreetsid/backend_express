const childProcess = require('child_process');

const blockedEnvironmentKeys = new Set([
  'BASH_ENV',
  'CODEX_HOME',
  'ENV',
  'HOME',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'LD_LIBRARY_PATH',
  'LD_PRELOAD',
  'NODE_OPTIONS',
  'PATH',
  'SHELL'
]);

function parseRuntimeSecret(secretString) {
  let parsed;
  try {
    parsed = JSON.parse(secretString);
  } catch {
    throw new Error('Runtime secret must contain valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Runtime secret must contain a JSON object');
  }

  const environment = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || blockedEnvironmentKeys.has(key)) {
      throw new Error(`Runtime secret contains prohibited environment key: ${key}`);
    }
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      throw new Error(`Runtime secret value must be scalar: ${key}`);
    }
    environment[key] = String(value);
  }
  if (Object.keys(environment).length === 0) {
    throw new Error('Runtime secret cannot be empty');
  }
  return environment;
}

function loadRuntimeSecret({
  secretId = process.env.CMMS_RUNTIME_SECRET_ID,
  region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
  execFileSyncImpl = childProcess.execFileSync
} = {}) {
  if (!secretId) throw new Error('CMMS_RUNTIME_SECRET_ID is required');
  if (!region) throw new Error('AWS_REGION is required');

  const secretString = execFileSyncImpl('aws', [
    'secretsmanager',
    'get-secret-value',
    '--secret-id',
    secretId,
    '--region',
    region,
    '--query',
    'SecretString',
    '--output',
    'text'
  ], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit']
  });
  return parseRuntimeSecret(String(secretString).trim());
}

function runRuntimeCommand(command, args, {
  baseEnvironment = process.env,
  secretEnvironment = loadRuntimeSecret(),
  spawnSyncImpl = childProcess.spawnSync
} = {}) {
  if (!['node', 'pm2'].includes(command)) {
    throw new Error(`Unsupported runtime command: ${command}`);
  }
  const result = spawnSyncImpl(command, args, {
    env: {
      ...baseEnvironment,
      ...secretEnvironment,
      NODE_ENV: 'production'
    },
    shell: false,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  return Number.isInteger(result.status) ? result.status : 1;
}

function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  if (!command) {
    throw new Error('Runtime command is required');
  }
  process.exitCode = runRuntimeCommand(command, args);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Runtime secret bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  loadRuntimeSecret,
  main,
  parseRuntimeSecret,
  runRuntimeCommand
};
