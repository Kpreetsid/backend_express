#!/bin/bash
set -e

echo "Stopping Express application..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not installed yet, skipping stop"
    exit 0
fi

# Stop the application if it's running
if pm2 list | grep -q "cmms_express"; then
    echo "Stopping cmms_express..."
    pm2 stop cmms_express || true
    pm2 delete cmms_express || true
    echo "Application stopped"
else
    echo "Application not running"
fi

exit 0