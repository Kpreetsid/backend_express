#!/bin/bash
set -e

echo "Installing NPM packages..."

cd /home/ubuntu/express_cmms

# Set npm cache directory to avoid permission issues
export npm_config_cache=/home/ubuntu/.npm

# Install dependencies
npm install --production

echo "NPM packages installed successfully"

# List installed packages
npm list --depth=0 || true