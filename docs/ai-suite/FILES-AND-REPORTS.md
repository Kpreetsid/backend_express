# Files, exports, reports and document security

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## CMMS customer side

- Customer frontend has report screens, download dialogs, report filters and asset/location report views.
- Customer backend exposes `/api/reports`, domain report services and generated PDFs. Binary responses must preserve MIME and headers; do not assume JSON envelopes for downloads.
- Uploaded work-order and asset files must be authorized by account/resource at the **file retrieval** boundary, not merely at their parent API route.

## Internal administration side

- `presageInternal/pages/invoice-tracker`, sales lead analytics, knowledge-base and other administrative screens produce/read exports.
- `Internal_ExpressJS/internal/invoice`, `sales-lead`, `upload`, `knowledge-base` own related endpoints and validations.
- KB publisher's PDF path is a separate, documented mirrored-file workflow; not an arbitrary public file-upload directory.

## Security checklist

1. Allowlist file type, check extension + content signature and request size; sanitize storage filename.
2. Resolve real paths against approved root and reject symlink/path traversal or `../`/encoded path segments.
3. Ensure authorized principal and specific account/resource has access before sending bytes.
4. Use `Cache-Control: private, no-store` for sensitive resources and safe `Content-Disposition` filename.
5. Verify upload cleanup after failure and old-file removal after successful replacement.
6. Apply authorization to exports and bulk downloads, not just individual read routes.
7. Test empty report, concurrent generation, long-running report, pagination and timeout/stream cancellation.
8. Never include user PDF, access tokens, secrets, database dumps or actual production PII in AI agent docs or test fixtures.
