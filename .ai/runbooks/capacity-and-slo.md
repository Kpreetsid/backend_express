# Capacity and SLO Certification

The executable harness is `scripts/load/enterprise-capacity.cjs`. It generates
HTTP load and authenticated notification-only Socket.IO connections without
emitting presence, chat, or collaboration events.

Run from an approved private load-generator host against staging:

```powershell
$env:CMMS_LOAD_BASE_URL='https://staging-api.example.test'
$env:CMMS_LOAD_HTTP_PATH='/api/<representative-read-route>'
$env:CMMS_LOAD_HTTP_METHOD='GET'
$env:CMMS_LOAD_BEARER_TOKEN='<short-lived-load-user-token>'
$env:CMMS_LOAD_ACCOUNT_ID='<isolated-load-tenant-id>'
$env:CMMS_LOAD_REQUESTS_PER_SECOND='250'
$env:CMMS_LOAD_SOCKET_CONNECTIONS='2000'
$env:CMMS_LOAD_DURATION_SECONDS='300'
npm.cmd run load:capacity
```

Use a dedicated tenant and short-lived credentials. Never commit tokens or raw
output containing production payloads. Repeat with representative writes at
the approved test route/body. The harness fails when server/network errors are
1% or more, read p95 exceeds 500 ms, write p95 exceeds 1 second, socket errors
are 1% or more, or the generator completes under 95% of scheduled requests.

During the run retain ALB/API latency and errors, Mongo pool/query health,
Redis latency, queue lag, worker saturation, socket count, CPU/memory, and
Auto Scaling changes. Re-run at twice observed peak traffic and 1.5 times
observed socket concurrency when production telemetry becomes available.
