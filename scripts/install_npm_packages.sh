#!/bin/bash
set -e

echo "Verifying immutable production dependencies..."

cd /home/ubuntu/express_cmms

test -f dist/server.js
test -d node_modules
npm list --omit=dev --depth=0

echo "Production artifact verified; no TypeScript compilation or dependency install performed"
