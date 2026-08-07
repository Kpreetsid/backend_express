#!/bin/bash
set -e

echo "Starting CMMS API and worker with PM2..."

cd /home/ubuntu/express_cmms

# Start the pre-built JavaScript artifacts with telemetry preloaded.
# Production never compiles TypeScript.
source scripts/load_runtime_secret_context.sh
node scripts/run-with-runtime-secret.cjs \
  pm2 start ecosystem.config.cjs --env production

# Save PM2 process list
pm2 save

echo "Application started successfully"

# Show PM2 status
pm2 status
