#!/bin/bash
set -e

echo "Installing system dependencies..."

# Update package list
apt-get update -y

# Install Node.js 20 if not already installed
if ! command -v node &> /dev/null || ! node -v | grep -q "v20"; then
    echo "Installing Node.js 20..."
    
    # Remove old nodejs if exists
    apt-get remove -y nodejs npm || true
    
    # Install Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    echo "Node.js version installed:"
    node -v
    npm -v
else
    echo "Node.js 20 is already installed"
    node -v
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2 globally..."
    npm install -g pm2
    
    # Setup PM2 to start on boot
    pm2 startup systemd -u ubuntu --hp /home/ubuntu
    
    echo "PM2 installed successfully"
else
    echo "PM2 is already installed"
fi

pm2 -v

echo "Dependencies installation completed"