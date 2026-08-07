# Project Overview

## Product

CMMS is a multi-tenant maintenance-management platform for companies, users,
roles, locations, assets, inspections, work requests, work orders, schedules,
parts/inventory, reports, uploads, and notifications. The web application is
Angular and Bootstrap; the API is an Express/Mongoose modular monolith.

## Repository boundaries

- `API`: HTTP API, authentication, authorization, MongoDB models, scheduled
  work, notifications, payload crypto, reports, and storage abstraction.
- `../APP`: Angular SPA, route guards, forms, offline/cache behavior, external
  processor integrations, and notification consumption.
- External systems: processor, data logger, MQTT/dashboard, ML, mail, MongoDB,
  Redis, S3/CloudFront, CloudWatch/OpenTelemetry, and AWS deployment services.
- No mobile source exists locally. Mobile/external consumers are protected by
  contract tests and additive-only API evolution.

## Non-functional targets

- Availability: 99.9% per calendar month.
- Recovery point objective: 15 minutes.
- Recovery time objective: 60 minutes.
- API load acceptance: less than 1% 5xx, p95 reads below 500 ms, p95 writes
  below 1 second at twice observed peak traffic.
- Security: SOC 2-ready technical controls and evidence; certification remains
  an organizational process.
- Compatibility: no breaking change to existing APIs or notification events.
- UX: no redesign; preserve Bootstrap structure, theme, responsive behavior,
  translations, and component-scoped styling.

## Architecture strategy

- Remain a modular monolith until measured scaling or ownership data justifies
  extraction.
- Use managed MongoDB first.
- Introduce managed Redis before horizontally scaling API/socket/workers.
- Move instance-local files to private S3 without changing upload routes.
- Use asynchronous workers only for work that is durable, retryable, and not
  required to complete the synchronous business transaction.

## Runtime exception

Angular 15 and Node 18 build tooling are a time-boxed risk exception. The
exception expires 90 days after handbook approval. Final production
certification requires Node 24 LTS and a supported Angular release reached one
major at a time, plus removal or formal acceptance of all critical/high
dependency findings.

