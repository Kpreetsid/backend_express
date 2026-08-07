#!/bin/bash
set -euo pipefail

context_file="/etc/cmms/runtime.conf"
if [[ ! -r "$context_file" ]]; then
  echo "Runtime secret context is unavailable"
  exit 1
fi

# The root-owned context contains identifiers only, never secret values.
source "$context_file"

if [[ -z "${CMMS_RUNTIME_SECRET_ID_B64:-}" || -z "${AWS_REGION:-}" ]]; then
  echo "Runtime secret identifier or AWS region is missing"
  exit 1
fi

export CMMS_RUNTIME_SECRET_ID
CMMS_RUNTIME_SECRET_ID="$(printf '%s' "$CMMS_RUNTIME_SECRET_ID_B64" | base64 --decode)"
export AWS_REGION

if [[ -z "$CMMS_RUNTIME_SECRET_ID" ]]; then
  echo "Runtime secret identifier is empty"
  exit 1
fi
