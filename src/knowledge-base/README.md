# Knowledge Base

The customer app reads published guides from `/api/knowledge-base`. The internal tool manages the same catalog through `/api/internal/knowledge-base`. Both routes are mounted under the backend's normal API base path, including `/cmms_express/api` in production.

## Internal publishing

Publishing requests require the internal tool's bearer token and an active internal user with Knowledge Base permissions. The CMMS backend verifies that session against `https://app.presageinsights.ai/internal_express/api/internal/users/:id`; it does not accept customer-app sessions for publishing. It also reads the user's current saved role menu from `/api/internal/role-menu?user_id=:id` on every request. View is required for catalog and preview; Add for upload; Edit for updating or publishing; Delete for permanent removal. Explicit role-menu denials apply to administrators too. `KNOWLEDGE_BASE_INTERNAL_API_URL` can override the verifier's base URL when needed.

- `GET /guides`: all guides, including drafts, and the supported categories.
- `GET /guides/:id/file`: authenticated PDF preview, including drafts.
- `POST /guides`: multipart upload with `title`, `description`, `category`, `published`, and one `file`.
- `PUT /guides/:id`: the same fields plus the current `updatedAt`; `file` is optional when keeping the existing PDF.
- `PATCH /guides/:id/visibility`: JSON containing `published` and the current `updatedAt`.
- `DELETE /guides/:id`: JSON containing the current `updatedAt`; removes the guide record and its PDF.

PDFs must have a `.pdf` filename, a PDF signature, and a size of at most 20 MB. New guides are drafts by default. Publishing makes them available to every signed-in customer-app user. Unpublishing removes them from the customer catalog and blocks customer file access, while retaining the guide in the internal tool. Conflicting updates return 409 rather than overwriting a newer edit.

## Storage and deployment

Metadata is stored in the backend's connected MongoDB database in `knowledge_base_guides`. Files are stored in the backend root's `knowledge_base/` directory, outside public upload folders. `KNOWLEDGE_BASE_FILES_DIR` can select another absolute directory. Preserve and back up this directory alongside the metadata; the backend process must be able to write to it. A failed metadata save removes its newly written PDF. A successful replacement removes the old file.

Deploy the CMMS backend routes before using the new internal screen. No seed records or existing-customer-data migrations are required. The first upload creates its metadata record. The internal UI uses `environment.productionImageUrl` for every guide request, independently of the staging selector. The production environment points to `https://app.presageinsights.ai/cmms_express`; a development-only environment override can point to a local backend for testing. The reverse proxy must allow the supported multipart upload size.