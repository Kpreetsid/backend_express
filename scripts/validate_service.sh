#!/bin/bash
set -e

echo "Validating CMMS API and worker..."

for attempt in $(seq 1 12); do
    if curl --fail --silent --show-error http://127.0.0.1:3000/health/ready > /dev/null; then
        if pm2 list | grep -q "cmms_worker.*online"; then
            echo "API readiness and worker process checks passed"
            exit 0
        fi
    fi
    sleep 5
done

echo "CMMS deployment did not become ready"
pm2 show cmms_express || true
pm2 show cmms_worker || true
pm2 logs cmms_express --lines 50 --nostream || true
pm2 logs cmms_worker --lines 50 --nostream || true
exit 1
