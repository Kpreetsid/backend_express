# CMMS operations: asset, work-order, preventive, inspection, inventory

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Asset and location management

**Customer UI:** `cmmsF/src/app/features/assets`, `equipment`, `locations`, `devices`, `dashboard`, `alarms`. **CMMS API:** `backend_express/src/modules/assets`, `locations`, `mappings`, `settings` and related `src/routes/v1/master.routes.ts` registration. A user list of accessible assets or locations is not sufficient to authorize every write: check account ID and individual mappings on service writes.

## Work-order lifecycle

- Customer UI: `src/app/features/work-orders` includes list, board, planner, calendar, execution, status and comments components.
- API: `src/modules/work-orders` handles work-order routes, service, comments, requests, instruction, templates, conversion and state changes.
- Confirm allowed status transitions from actual work-order service/model. Preserve labor, timestamps, assignment, parts quantity, SOP forms, attachments and activity history.
- Verify server-side creation/update permissions, resource scope, duplicate requests, concurrent edits, assignment changes and closure preconditions.

## Work requests

- Frontend: `src/app/features/work-requests`.
- Backend: `src/modules/work-orders/routes/request.routes.ts`, `services/request.service.ts` and request-conversion tests.
- Check that converted request references source request and does not double-create work orders when retried.

## Preventive maintenance

- Frontend: `src/app/features/preventive`.
- Backend: `src/modules/maintenance/routes/schedule.routes.ts`, scheduler under `src/core/scheduler`.
- Validate time zones, next-run rule, duplicate triggers, job restart/retry, missing assignees, disabled schedule and correct account.

## Inspection and corrective maintenance

- Frontend: `src/app/features/inspections`.
- Backend: `src/modules/maintenance/routes/inspection.routes.ts`, related tests and models.
- Validate observed failures, evidence handling, mapped assets, corrective work reference and expected visibility after state change.

## Inventory and parts

- Frontend: `src/app/features/parts`; backend: `src/modules/inventory` and work-order inventory operations.
- Track estimated versus actual quantity, availability and consumption. Plan rollback when multi-document writes partially fail.
- Protect all paths against cross-account parts/asset assignment.

## Other customer feature families

The checked-out customer UI includes folders for alarms, notifications, assets, devices, equipment, locations, dashboards, posts, procedures, SOPs, library and reports. Corresponding backend modules include communications, assets, locations, maintenance, inventory, reports, knowledge-base and upload. Name similarity is a *discovery hint*, not an API match; trace caller URLs and router composition for every feature.
