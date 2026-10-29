# CMMS Authentication and Authorization Hardening Plan

> **Execution rule:** Work only on `priority/bugs`. Never write, merge, rebase, or push to any other branch.
> **Method:** Superpowers TDD + verification-before-completion. Each module is committed independently after its targeted checks.
> **Resume rule:** On restart, fetch `priority/bugs` HEAD, read this checklist, inspect the last checked checkpoint, and re-verify that module before continuing.

## Goal

Provide secure, consistent authentication and authorization for every CMMS module/action in frontend and backend, including complete administrator permissions and a trusted first-account-user owner override.

## Security model

- Backend is authoritative; frontend guards are UX enforcement only.
- Unknown/missing permissions deny by default.
- Permission vocabulary is module/action based and shared between backend and frontend.
- First account user is a trusted bootstrap owner and receives all in-account CMMS permissions without explicit grants.
- Bootstrap-owner bypass never bypasses authentication, account/tenant boundaries, subscription/account feature boundaries, input validation, CSRF, upload security, workflow invariants, or object-level authorization.
- Client payloads can never set or change bootstrap-owner / first-user security state.
- Ordinary administrators receive complete applicable permissions from the canonical permission catalogue; they do not rely on scattered role-name bypasses.
- Role/status/identity/permission changes revoke or invalidate stale sessions.

## Canonical actions

`view`, `add`, `edit`, `delete`, `import`, `export`, plus explicit workflow actions such as `assign`, `approve`, `close`, `manage` only where the module genuinely exposes them.

## Checklist

### Phase 0 — Branch and recovery safety
- [x] Verify backend `priority/bugs` exists and is writable.
- [x] Verify frontend `priority/bugs` exists and is writable.
- [x] Confirm no writes target the repository default branch.
- [ ] Record current branch SHAs below after each completed module.

### Phase 1 — Inventory and matrix
- [ ] Inventory all Express route groups and HTTP actions on `priority/bugs`.
- [ ] Inventory all Angular routes, navigation entries and action controls on `priority/bugs`.
- [ ] Inventory backend permission catalogue/default role menu/platform-control mappings.
- [ ] Inventory frontend permission keys and guards.
- [ ] Produce module/action matrix and identify keys present on only one side.
- [ ] Identify admin omissions and unprotected backend actions.
- [ ] Identify routes whose permission middleware order is incorrect.
- [ ] Identify object/account scoping gaps and direct-API bypasses.

### Phase 2 — Backend authorization core
- [ ] Add tests for bootstrap-owner authorization bypass.
- [ ] Implement server-derived bootstrap-owner helper/policy.
- [ ] Add tests proving client payload cannot claim owner state.
- [ ] Add tests for deny-by-default unknown module/action.
- [ ] Centralize module/action permission catalogue.
- [ ] Add complete administrator defaults for all applicable catalogue entries.
- [ ] Preserve account feature/subscription caps independently of owner/role authorization.
- [ ] Add security logging for authorization failures and privilege changes where existing audit infrastructure supports it.

### Phase 3 — Backend modules
For every discovered module:
- [ ] Route declares correct permission for list/detail/view actions.
- [ ] Route declares correct permission for create/add actions.
- [ ] Route declares correct permission for edit/update/status actions.
- [ ] Route declares correct permission for delete/deactivate actions.
- [ ] Import/export/custom workflow actions use explicit matching permissions.
- [ ] Object-level/account-level filter is enforced in the service/controller.
- [ ] Sensitive payload fields use explicit allowlists.
- [ ] Direct API negative tests exist.
- [ ] Bootstrap owner positive test exists where generic permission middleware is used.
- [ ] Admin positive test exists.
- [ ] Ordinary denied-role negative test exists.

### Phase 4 — Role and user administration
- [ ] First user cannot be demoted from bootstrap-owner through normal profile/user endpoints.
- [ ] Non-owner admins cannot create another bootstrap owner.
- [ ] Role assignment cannot exceed actor authority.
- [ ] Permission edits cannot grant outside account-enabled feature/action caps.
- [ ] Role/status/email/username/permission changes invalidate stale sessions.
- [ ] User deletion/deactivation invalidates sessions.
- [ ] Existing user role-menu state is synchronized on role changes.

### Phase 5 — Frontend enforcement
- [ ] Central authorization service exposes one canonical `can(module, action)` decision.
- [ ] Bootstrap owner receives effective all-access from trusted authenticated profile state.
- [ ] Parent/child routes declare permission metadata and guard navigation.
- [ ] Navigation/menu visibility uses the same authorization service.
- [ ] Add/edit/delete/import/export/action buttons use the same authorization service.
- [ ] Forbidden direct navigation redirects safely.
- [ ] UI never treats hidden buttons as security enforcement.
- [ ] Unknown permission keys fail closed.
- [ ] Frontend permission constants align exactly with backend catalogue.

### Phase 6 — Compatibility / backfill
- [ ] Existing admin role menus are backfilled with newly discovered applicable permissions.
- [ ] Existing first account users are deterministically recognized/migrated without trusting client data.
- [ ] Migration/backfill is idempotent.
- [ ] Legacy role-menu documents keep compatible shape where required.

### Phase 7 — Verification
- [ ] Backend typecheck.
- [ ] Backend security/authorization targeted tests.
- [ ] Backend full CMMS regression tests.
- [ ] Backend production build.
- [ ] Frontend typecheck.
- [ ] Frontend spec typecheck.
- [ ] Frontend authorization/security tests.
- [ ] Frontend full headless unit tests.
- [ ] Frontend production build.
- [ ] Review final diff against this checklist.
- [ ] Verify all commits exist only on `priority/bugs`.

## Role expectations

| Identity | Authorization expectation |
|---|---|
| Bootstrap owner / first account user | All in-account CMMS module/actions; still subject to authentication, account/tenant, feature/subscription, object/business-rule and input-security constraints |
| Admin | Complete applicable module/action permissions from the catalogue |
| Manager | Explicit delegated permissions only; cannot self-escalate or assign privileged roles |
| Employee | Explicit operational permissions only |
| Customer | Explicit customer-facing permissions only |
| User | Explicit minimal permissions only |
| Unauthenticated | Denied for all private CMMS operations |

## TDD acceptance cases

- Missing/unknown permission -> 403.
- Valid permission for wrong module/action -> 403.
- Direct API call without permission -> 403.
- Bootstrap owner with no stored permission row -> permission middleware allows the operation, but tenant/object constraints still apply.
- Ordinary admin with complete generated defaults -> allowed for every applicable module/action.
- Manager attempting admin/manager escalation -> 403.
- Cross-account object ID -> 404/403 without data disclosure.
- Privilege change -> old session/token cannot continue with stale privilege.
- Client-provided owner flags -> ignored/rejected.
- Frontend direct URL without permission -> route rejected/redirected.
- Frontend and backend permission key sets remain aligned.

## Checkpoints

| Checkpoint | Repository | Commit | Verification | Status |
|---|---|---|---|---|
| P0 | CMMS-ExpressJS | b2ad6fdf464daa2c7ff0f35648ad58bf819c1ae6 | Previous role/session hardening checkpoint | baseline |
| P0 | CMMS-Angular | a7e14c77821ca7a3e501636367c94de0cd9b1fc1 | Previous auth guard/interceptor checkpoint | baseline |
| P1 | both | pending | Inventory + canonical permission catalogue | pending |
| P2 | backend | 6d3b4129ad0b8e71ae40d38d94bb3400b7c16250 | Source invariants inspected; local test execution blocked by sandbox DNS; GitHub status checks not exposed | code complete / runtime verification pending |
| P3 | backend | 3298f4e90f4e204b172f4a78c46207abb4de2a81 | Source coverage verified for core, maintenance, work-order, inventory, communications, mappings, admin settings, company and reports; runtime test/build pending | code complete / runtime verification pending |
| P4 | frontend | pending | Route/menu/action authorization | pending |
| P5 | both | pending | Full verification and final review | pending |

## Restart procedure

1. Fetch `priority/bugs` HEAD in both repositories.
2. Confirm the branch contains this plan.
3. Compare each HEAD with the last non-pending checkpoint commit above.
4. Re-run or inspect the targeted verification evidence for that checkpoint.
5. If the checkpoint is intact, continue with the next unchecked item; do not repeat completed changes.
6. If a checkpoint is incomplete, repair it before proceeding.


### Resume note — backend authorization core
- Test-first commits: `73a1cfd8`, `9b4e3c92`.
- Implementation commits: `2b323a8e`, `6d3b4129`.
- Trusted first-user bypass exists only in `hasRolePermission`; account-feature checks are unchanged.
- Admin platform-control now includes missing routed modules/actions; lower roles receive the same keys with denied defaults.
- Verification limitation: this harness cannot resolve github.com for local checkout, and connector status checks are currently empty. Re-run `npm run typecheck && npm run test:cmms && npm run build` when executable CI/local access is available.


### Resume note — backend module authorization
- Current backend checkpoint: `3298f4e90f4e204b172f4a78c46207abb4de2a81`.
- Owner model: first user receives current admin defaults during authentication, then normal account feature caps are applied; route middleware has no unconditional owner bypass.
- Legacy role documents inherit missing current-role defaults while preserving explicit stored overrides.
- Assets/Locations, Maintenance/Library, Work Orders/Requests, Inventory, Posts/Comments, mappings, analysis settings, user logs, company lifecycle, and location report updates now declare function-level permissions.
- Company ruling: list/detail remain authenticated + tenant-scoped; account update requires `admin_panel.edit`; account create/delete are first-user-only; delete additionally validates target account equals authenticated account.
- Troubleshooting guides and work instructions use the existing `procedures` permission because they are shared procedure/library content and no separate account feature exists.
- Runtime verification remains pending because the sandbox cannot resolve github.com for a local checkout and commit status checks are empty. Required backend verification when executable: `npm run typecheck && npm run test:cmms && npm run build`.


### Resume checkpoint — current execution (2026-10-29)
- Backend live HEAD at resume: `d566392297d814205f70e21ba88a2d8e554dd76c` (`priority/bugs`).
- Frontend live HEAD at resume: `11f3510467d910e7b1d586128317a26ac09cdb2d` (`priority/bugs`).
- Revalidated: owner/first-user effective permissions are generated from current admin defaults server-side and still capped by account features; role middleware itself does not bypass account caps.
- Revalidated: role administration protects first-user permission rows, prevents privilege delegation above actor effective access, and revokes sessions after permission changes.
- Revalidated frontend: one central `AuthorizationService.can(...)`, guarded routes, shared permission directive, and permission-aware navigation are already present.
- Newly identified backend gaps to close next, in order:
  1. Floor-map routes: protect coordinate create/read/detail endpoints with the existing `floorMap` action permissions.
  2. Generic upload route: apply the existing upload permission policy to the root upload endpoint, not only folder-specific variants.
  3. Re-scan all remaining private routes for explicit role permission or documented authenticated-self/all-user policy.
- Runtime verification remains mandatory after each module. Do not mark a module complete from source inspection alone.
