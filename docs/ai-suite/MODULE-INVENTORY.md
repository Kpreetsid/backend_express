# Source module index: all four application repositories

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

**Status:** verified directory inventory from `priority/bugs` trees on 2026-11-12. A directory suggests code ownership but does not prove each exposed feature is complete. Start with the source tree in your active branch.

## cmmsF - customer Angular frontend

`src/app/features/` domain directories:

| Folder | Feature intent |
|---|---|
| `admin` | Customer-level administration and notifications/feature UI |
| `alarms` | Alarm configuration and diagnostic thresholds |
| `assets`, `equipment` | Asset hierarchy, components, sensor/equipment setup |
| `auth` | Login, register, recovery, external and email-link flows |
| `dashboard` | Customer monitoring dashboards |
| `devices` | Device and gateway user-facing monitoring |
| `inspections` | Inspection forms and results |
| `knowledge-base` | Read published PDF guides |
| `library` | CMMS user library |
| `locations` | Location and floor-map features |
| `notifications` | Inbox and browser notifications |
| `offline` | Offline screen/navigation |
| `parts` | Inventory and part UI |
| `posts` | Posts and feed |
| `preventive` | Schedule/preventive work management |
| `procedures`, `sops` | Procedure and standard operating instruction UI |
| `reports` | Reports, filter, downloads, analytics |
| `user-profile` | Customer user profile and account preferences |
| `work-orders`, `work-requests` | Maintenance work execution and requests |

Shared framework code is in `src/app/core` (guards, auth, services and interceptors), `src/app/shared` (components, services, directives, pipes, validators) and `src/app/layout`. On `master` search `src/app/default` and `_services` instead.

## backend_express - CMMS TypeScript API

`src/modules/` domain directories:

| Folder | Backend ownership |
|---|---|
| `assets` | Equipment, assets, component trains/catalog |
| `auth` | Login, token, recovery, email-login and support grant |
| `communications` | Notifications, posts and communications |
| `company` | Account details, plans, subscriptions and features |
| `inventory` | Parts, part types, stock and work-order quantities |
| `knowledge-base` | Published read-only guide endpoints |
| `locations` | Locations, floors and related resources |
| `maintenance` | Inspections, schedules, forms, SOPs, troubleshoot guides |
| `mappings` | User-to-resource mappings and related notifications |
| `reports` | Asset/location and CMMS report generation |
| `settings` | Analysis feature configuration |
| `upload` | Authenticated upload and file policy |
| `users` | Customer users, role menus, audit/logs |
| `work-orders` | Orders, requests, templates, instructions, comments and procedures |

Core runtime is in `src/core` (auth, database, caching, config, scheduler, messaging, socket) and `src/common` (middleware). `src/routes/v1` composes outer domain routes. On `main`, use `src/masters`, `src/work`, `src/user`, `src/_config` instead.

## presageInternal - staff Angular frontend

`src/app/pages/` directories observed:

| Domain grouping | Page folders |
|---|---|
| Accounts and authorization | `account-management`, `admin-panel`, `user-management`, `user-control`, `register`, `login` |
| Business/CRM | `sales-lead-tracker`, `invoice-tracker`, `sap-mapping`, `blog`, `knowledge-base` |
| Technical data/operations | `devices`, `gateway`, `sensor`, `alarm`, `assets-details`, `cron-job`, `loc-testing-report`, `data-look`, `data-lookup`, `rms-results`, `rsm-data`, `mac-id` (branch-dependent) |

Service and auth wrappers: `src/app/services`; routing: `src/app/app-routing.module.ts`; SSR bootstrap: `src/main.server.ts`, `src/app/app.module.server.ts`. Feature routes can be lazy standalone components in an NgModule root.

## Internal_ExpressJS - staff and privileged CMMS API

| Root/folder | Backend responsibilities |
|---|---|
| `src/internal/user` | Staff user lifecycle |
| `src/internal/role-menu` | Internal staff action permissions |
| `src/internal/assigned-companies` | Staff access to assigned customer companies |
| `src/internal/blog` | Blog/content |
| `src/internal/invoice` | Invoice and finance |
| `src/internal/sales-lead` | CRM/sales leads |
| `src/internal/sap-mapping` | SAP integration mapping |
| `src/internal/knowledge-base` | PDF guide publisher |
| `src/internal/upload` | Internal file uploads |
| `src/cmms/master` | Privileged customer account/assets/CMMS administration |
| `src/cmms/users` | Privileged customer users/role menus |
| `src/cmms/work` | CMMS work-order admin |
| `src/cmms/mapping` | Privileged user-resource mappings |
| `src/cmms/support-login` | Support-login grant orchestration |
| `src/_db` | Website and multiple CMMS DB connections |
| `src/middlewares` | Internal and CMMS auth, CSRF, role/env, validation and errors |
| `src/security` | Security auditing and related controls (priority branch) |

## Cross-module quick search

Run `rg --files src | rg '(work-order|role|account|knowledge-base|email-login|support-login|inspection|invoice|sales-lead|notification)'` in each relevant checkout. Verify route registration in the top-level router instead of assuming a folder is mounted.
