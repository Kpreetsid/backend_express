# Repo guide: Kpreetsid/backend_express (customer CMMS API)

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Purpose and domains

Customer backend: authentication, accounts/subscriptions/role permissions, assets and locations, equipment, work orders/requests, preventive schedules/inspections, parts/inventory, reports, notifications, uploads, knowledge-base published reader, processor integrations and jobs.

## `priority/bugs` source map

- `src/app.ts`: Express API mounts, middleware order, static ACL and error handler.
- `src/routes/v1/public.routes.ts`, `master.routes.ts`: route compositions.
- `src/modules`: auth, assets, users, company, locations, work-orders, maintenance, inventory, mappings, reports, communications, knowledge-base, upload, settings.
- `src/core`: auth, config, database, cache, messaging, scheduler, socket.
- `src/common`: middleware, request context, permission, validation and utilities.

## Other branches

`main`: earlier `src/user`, `src/masters`, `src/work`, `src/reports`, `src/_config`. `feature/email-login-links`: another older-generation structure including email-login functionality. Always inspect checked-out branch and package scripts before editing.

## High-risk integrations

- CMMS deep links: customer UI email-login inspect/exchange; observed priority TTL is 7 days, product policy must be confirmed.
- Local service support issuer: GET/POST `/api/internal/support-login-tokens`. The legacy external-token GET under `/api/users/create_external_token/:email` is a separate current route; do not apply the remote POST contract to it.
- Published knowledge-base PDFs: customer API reads, internal publisher API writes.
- Account/role updates: enforce backend authorization, company and resource scope on each route, invalidate stale client access.

## Commands

On priority: `npm run typecheck`, `npm run build`, targeted `npm run test:cmms`, `npm run test:email-login`, `npm run test:password-security`, `npm run catalog:check`. No generic `npm test` script observed in priority package. Never use a real production DB for regression tests.
