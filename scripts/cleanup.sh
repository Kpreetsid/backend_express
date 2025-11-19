#!/bin/bash
set -e

echo "Cleaning up old deployment..."

cd /home/ubuntu/services/express

# Remove node_modules and package-lock to ensure fresh install
rm -rf node_modules
rm -f package-lock.json

# Clean PM2 logs
if command -v pm2 &> /dev/null; then
    pm2 flush || true
fi

echo "Cleanup completed"