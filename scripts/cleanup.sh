#!/bin/bash
set -e

echo "Preparing immutable deployment directory..."

deployment_dir="/home/ubuntu/express_cmms"
install -d -m 0755 -o ubuntu -g ubuntu "$deployment_dir"
cd "$deployment_dir"

# Remove node_modules and package-lock to ensure fresh install
rm -rf node_modules
rm -f package-lock.json

# Clean PM2 logs
if command -v pm2 &> /dev/null; then
    pm2 flush || true
fi

echo "Deployment directory prepared"
