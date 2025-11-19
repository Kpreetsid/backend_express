#!/bin/bash
set -e

echo "Installing NPM packages..."

cd /home/ubuntu/services/express

# Set npm cache directory to avoid permission issues
export npm_config_cache=/home/ubuntu/.npm

# Install all dependencies (including TypeScript and dev dependencies)
npm install

echo "NPM packages installed successfully"

# List installed packages
npm list --depth=0 || true