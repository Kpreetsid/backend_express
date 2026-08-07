#!/bin/bash
set -e

echo "Applying idempotent production index migrations..."

cd /home/ubuntu/express_cmms

test -f dist/operations/apply-production-indexes.js
source scripts/load_runtime_secret_context.sh
node scripts/run-with-runtime-secret.cjs \
  node dist/operations/apply-production-indexes.js

echo "Production index migrations completed"
