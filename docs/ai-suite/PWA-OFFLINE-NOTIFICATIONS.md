# PWA, offline and notifications across applications

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Confirmed PWA artifacts

- `cmmsF/ngsw-config.json` defines application and asset cache groups, translation/json data group, and navigation URL exclusions for API/WebSocket paths on `priority/bugs`.
- `cmmsF/src/app/app.module.ts` registers the Angular service worker only when `environment.production`.
- Offline UI and offline navigation service exist (`src/app/features/offline`, `src/app/shared/services/offline-navigation.service.ts`).
- Browser notification and notification services exist in `src/app/features/notifications`; backend notification routes exist in `backend_express/src/modules/communications`.

## Important non-guarantees

- Service-worker registration does **not** prove app installability on every browser or a successfully built service worker.
- Cached shell/assets/translation files do **not** mean all domain APIs work offline; the checked `ngsw-config.json` did not demonstrate private API data caching.
- An offline banner or queue-state message does **not** prove persisted, secure, replay-safe offline mutations.
- A browser notification component or Socket.IO dependency does **not** prove push subscription, background delivery, permission revocation or end-to-end delivery.

## Codex verification scenarios

1. Production build contains generated manifest/service worker files; inspect service-worker registration and path scope for `/cmms/`.
2. Login as A, cache site, logout, login B on same device; ensure no A-only API payload is accessible as B.
3. Go offline with app shell preloaded; verify intended navigation and informative blocked actions.
4. For any implemented mutation queue: validate serialization, encryption/privacy, account/user affinity, idempotency key, status, conflict resolution and cleanup on logout.
5. With notification permission denied, revoked or unsupported, no crash; with granted, ensure unsubscribe/opt-out and server scope.
6. Retry failures should never blindly replay destructive POST/PUT/PATCH/DELETE; distinguish transient network error from 401/403/409.

PresageInternal is not established as the same PWA. Do not add service-worker behavior to the internal admin UI unless requested.
