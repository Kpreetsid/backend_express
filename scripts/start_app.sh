#!/bin/bash
set -e

echo "Starting Express application with PM2..."

cd /home/ubuntu/services/express

# Set Node environment
export NODE_ENV=production

# Start application with PM2
pm2 start npm --name "cmms_express" -- start

# Save PM2 process list
pm2 save

echo "Application started successfully"

# Show PM2 status
pm2 status