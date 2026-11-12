# Upload, storage and authenticated file retrieval

## Local implementation

- src/upload/upload.routes.ts exports Multer and routes; multipart limits are 12 files and 5 MiB per file with .png/.jpg/.jpeg/.pdf extension filtering. This is not proof of MIME/signature validation.
- src/upload/upload.multer.ts owns destination allowlisting, naming and base64 upload/delete helpers. src/_config/storage.ts owns storage. Do not import the archive's absent upload config helper.
- src/middlewares/uploadPermission.middleware.ts supplies permission checks; src/middlewares/authenticatedStatic.ts is used by file mounts in src/app.ts. Verify ownership for each read/write/delete, beyond group authentication.
- Work-order attachments reuse the uploader and payloadCryptoMultipartMiddleware. Preserve encrypted multipart ordering.

Resolve destinations against one storage root. Check canonical containment, categories, traversal/symlink escapes; do not trust original names or caller paths. Preserve opaque names and tenant/document access checks.

Validate contents, byte/count budgets and base64 decoding separately from labels. Define cleanup for partial writes, failed metadata updates and deletes. Do not introduce unauthenticated private-file serving.

Test anonymous/wrong-account access, invalid folder, encoded traversal, spoofed/oversized/empty content, file-count limits, missing files and cleanup using a temporary test root. Do not use customer uploads as fixtures. This setup does not certify upload security.
