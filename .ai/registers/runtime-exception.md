# Unsupported Runtime Exception

- Status: Accepted by explicit user direction; named governance approval pending
- Created: 2026-07-28
- Expires: 2026-10-26
- Scope: Angular 15 and its Node 18-compatible build job only
- Owner: Web platform role; named individual required
- Approver: Security and engineering leadership; names required

## Reason

Angular supports sequential major upgrades. Jumping directly from 15 to 22 would bypass supported migrations and make behavioral regressions difficult to isolate.
The user has explicitly prohibited Angular and Angular Material upgrades in the
current implementation scope.

## Compensating controls

- deterministic lockfile, TypeScript 4.9.5 pin, and production build on every change;
- critical vulnerability gate;
- Playwright login smoke gate;
- CSP/CORS and destination-aware authentication review;
- no new Angular 15-only dependencies;
- one-major-at-a-time upgrade evidence.

## Exit criteria

Retirement requires explicit user authorization followed by sequential upgrade
evidence. Until then, Angular 15.2.10, Material/CDK 14.2.7, Node 18 CI and
TypeScript 4.9.5 remain frozen. This exception cannot authorize critical
vulnerabilities and blocks final production certification when unapproved by
named governance owners or expired.
