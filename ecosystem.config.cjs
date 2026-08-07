module.exports = {
  apps: [
    {
      name: 'cmms_express',
      script: 'dist/server.js',
      node_args: '--require ./dist/instrumentation.js',
      cwd: '/home/ubuntu/express_cmms',
      instances: 1,
      exec_mode: 'fork',
      out_file: '/var/log/cmms/api.log',
      error_file: '/var/log/cmms/api-error.log',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
      kill_timeout: 30000,
      listen_timeout: 30000,
      env_production: {
        NODE_ENV: 'production',
        OTEL_SERVICE_NAME: 'cmms-api'
      }
    },
    {
      name: 'cmms_worker',
      script: 'dist/worker.js',
      node_args: '--require ./dist/instrumentation.js',
      cwd: '/home/ubuntu/express_cmms',
      instances: 1,
      exec_mode: 'fork',
      out_file: '/var/log/cmms/worker.log',
      error_file: '/var/log/cmms/worker-error.log',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
      kill_timeout: 30000,
      env_production: {
        NODE_ENV: 'production',
        OTEL_SERVICE_NAME: 'cmms-worker'
      }
    }
  ]
};
