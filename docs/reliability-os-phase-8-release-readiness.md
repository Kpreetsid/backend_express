# Reliability OS Phase 8 Release Readiness

Status: implementation-ready validation checklist
Branch: reliability
Scope: cmmsF, backend_express, data_processors

## Release Scope

Phase 8 closes the migration with operational hardening:

- Reliability role permissions are present in both platform-control and role-menu defaults.
- Existing role records can be refreshed through the existing user role refresh helper.
- Reliability workflow notifications route to the correct case detail screen.
- Reliability Insights exposes an attention queue for approval, feedback, high-risk, and stale cases.
- Build/type validation passes for Express and Angular.

## Required Pre-Release Role Refresh

New users receive Reliability permissions from the updated role templates automatically.

Existing users need their role documents refreshed before non-admin Reliability access is tested. Use the existing `usersService.updateNewRoleMenu()` maintenance path after deployment, or run an equivalent account-scoped update that refreshes both fields on `platform-control`:

- `roleMenu`: from `RoleManager.getRoleMenuData(user.user_role)`
- `data`: from `PlatformControlManager.getRoleMenuData(user.user_role)`

Expected default behavior:

- `admin`: full Reliability access.
- `manager`: full Reliability workflow access, including recommendation approval.
- `employee`: view cases and add technician feedback.
- `customer` / `user`: view cases only.

## API Smoke Matrix

Run with an authenticated admin and manager where noted.

| Area | Request | Expected |
| --- | --- | --- |
| Case list | `GET /api/reliability/cases` | Returns visible role-scoped cases. |
| Alarm promotion | `POST /api/reliability/cases/group-alerts` | Creates or groups a case from `AlarmHistoryMaster` evidence. |
| Asset report promotion | `POST /api/reliability/cases/from-asset-report` | Creates or returns an existing open case for the report. |
| Recommendation | `POST /api/reliability/cases/:id/recommendation` | Moves eligible case to `recommendation_ready`. |
| Approval | `POST /api/reliability/cases/:id/approval` | Admin/manager with permission can approve or reject. |
| Spares | `GET /api/reliability/cases/:id/spares` | Returns availability rows and summary. |
| Work order | `POST /api/reliability/cases/:id/create-work-order` | Creates and links a work order when approval rules pass. |
| Feedback | `POST /api/reliability/cases/:id/feedback` | Stores technician feedback and moves to `feedback_pending`. |
| Closure | `POST /api/reliability/cases/:id/close` | Requires feedback, stores closure learning, moves to `closed`. |
| Insights | `GET /api/reliability/insights/summary` | Returns totals, attention queue, and learning summaries. |
| Failure library | `GET /api/reliability/insights/failure-library` | Returns closed-case learning grouped by failure/root cause/asset type. |

## Frontend Smoke Matrix

- `/reliability/cases`: list loads, filters apply, quick filters open approval/feedback/high-risk queues.
- `/reliability/cases/:id`: evidence, diagnosis, recommendations, spares, linked alarms, linked asset reports, approval, feedback, closure, and activity render without console errors.
- `/reliability/insights`: metrics, attention queue, failure library, and recent learning render and rows navigate to case detail.
- Asset Report detail menu: `Create Reliability Case` creates or opens the linked case.
- Notification bell: Reliability notification clicks route to `/reliability/cases/:id`.

## Validation Commands

Backend:

```powershell
cd D:\presage\development\backend_express
npm run typecheck
npm run check:lookup-from
npm run build
```

Frontend:

```powershell
cd D:\presage\development\cmmsF
npx tsc --noEmit
npm run build
```

Django:

```powershell
cd D:\presage\development\data_processors
   python -m py_compile app\urls.py app\dashboard\views.py
```

Full Django `manage.py check` requires the project Django runtime to be installed in the active Python environment.

## Release Notes

- Cases remain owned by Express/MongoDB.
- Sensor evidence remains owned by Django/Postgres.
- Raw waveform/time-series data is not duplicated into Reliability cases.
- Notifications are best-effort and do not block workflow writes.
- Existing work order and asset report workflows continue to function independently.
