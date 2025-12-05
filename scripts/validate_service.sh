#!/bin/bash
set -e

echo "Validating Express application..."

# Wait for application to start
sleep 5

# Check if PM2 process is running
if pm2 list | grep -q "cmms_express.*online"; then
    echo "✓ Application is running"
    
    # Get application details
    pm2 show cmms_express
    
    echo "Validation successful"
    exit 0
else
    echo "✗ Application is not running"
    pm2 logs cmms_express --lines 50 --nostream
    exit 1
fi