# Knowledge-base publishing and customer reading

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Ownership (observed on priority/bugs)

- **Publisher UI:** `presageInternal/src/app/pages/knowledge-base/*`.
- **Publisher API:** `Internal_ExpressJS/src/internal/knowledge-base/*` with `view/add/edit/delete` permissions.
- **Published metadata and PDF file read:** `backend_express/src/modules/knowledge-base/*`.
- **Customer reading UI:** `cmmsF/src/app/features/knowledge-base/*`.

## Contract

Publisher API: `GET /api/internal/knowledge-base/guides`, `POST /guides`, `PUT /guides/:id`, `PATCH /guides/:id/visibility`, `DELETE /guides/:id`, `GET /guides/:id/file`. Publisher requires authenticated staff and current role-menu rights.

Customer API: `GET /api/knowledge-base/guides`, `GET /api/knowledge-base/guides/:id/file` behind CMMS authentication. It offers no publishing/update/delete route.

## Storage and lifecycle

The internal publisher implementation maintains guide records and PDF files, with a documented CMMS-facing mirror. The internal module README describes same-file-name copies in internal and CMMS upload locations. File directories are deployment-sensitive; do not assume co-located servers without checking actual environment. Publisher uses revision (`updatedAt`) to reject stale updates. File upload validates PDF signature and size (20 MB from source); replace/delete must clean staged copies consistently.

## Cross-repo acceptance tests

1. Authorized publisher can create draft; customer reader cannot see it.
2. Publisher can publish; customer authenticated reader can list and open PDF.
3. Explicit denial blocks publisher read/edit/delete even if UI hides the button.
4. Concurrent edits return conflict; no corrupt metadata or orphaned files.
5. Upload with invalid signature, unsupported file, traversal, missing mirror directory or access denied does not expose bytes.
6. Revoke/unpublish removes customer visibility without requiring browser logout.

Use the exact environment's storage configuration and API base URLs; do not copy guide documents into repository source.
