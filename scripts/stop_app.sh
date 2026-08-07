#!/bin/bash
set -e

echo "Stopping CMMS API and worker..."

if ! command -v pm2 &> /dev/null; then
    echo "PM2 not installed yet, skipping stop"
    exit 0
fi

if pm2 list | grep -Eq "cmms_express|cmms_worker"; then
    pm2 delete cmms_express cmms_worker || true
    pm2 save
    echo "CMMS processes stopped"
else
    echo "CMMS processes are not running"
fi
