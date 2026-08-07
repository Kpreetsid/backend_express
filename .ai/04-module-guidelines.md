# Module Guidelines

## Standard module

New modules and incrementally refactored modules use:

```text
feature/
  feature.routes.ts
  feature.controller.ts
  feature.service.ts
  feature.repository.ts
  feature.validator.ts
  feature.types.ts
  feature.events.ts
  feature.permissions.ts
  feature.spec.ts
```

Only add files that have a real responsibility; small modules may combine types
and permissions without bypassing layer boundaries.

## Required behavior

- Route: stable path/method, middleware order, permission, OpenAPI operation ID.
- Controller: validated input, authenticated tenant context, service call,
  compatibility-preserving response.
- Service: business invariant, transaction, outbox event, stable error.
- Repository: tenant/account scope, projection, pagination, explicit populate,
  and query/index documentation.
- Validator: server-authoritative constraints with matching Angular rule.
- Event: versioned envelope and idempotent consumer expectation.
- Test: success, validation, permission, tenant isolation, conflict, and
  persistence failure.

## Module matrix

| Domain | API owner path | APP consumer | Critical controls |
|---|---|---|---|
| Authentication | `src/user/authentication` | login/user services | rotation, replay, expiry |
| Users/Roles | `src/masters/user` | admin panel | RBAC, tenant scope, audit |
| Company/Account | `src/masters/company` | registration/admin | tenant boundary |
| Locations/Assets | `src/masters/location`, `asset` | locations/assets | hierarchy, ownership |
| Inspections | `src/masters/inspection` | inspections | assignment, evidence |
| Work Requests | `src/work/request` | work-request | SLA, approval, idempotency |
| Work Orders | `src/work/order` | work-order | transaction, inventory, history |
| Parts/Inventory | `src/masters/part` | parts | stock integrity, cycle count |
| Schedules | `src/cron`, schedule model | preventive | single execution, locks |
| Reports | `src/reports` | report module | projection, export access |
| Notifications | `src/notification`, `src/utils/notification.service.ts` | notification service | durable delivery |
| Uploads | `src/upload`, storage provider | shared upload flows | validation, tenant access |

