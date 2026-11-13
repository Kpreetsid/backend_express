# Scoped upload instructions

Treat filenames, MIME, base64 data, `:folderName` and retrieval paths as hostile. Enforce a fixed storage root, folder allowlist, normalized-path containment, content-type signature/byte limits, auth and tenant access, safe deletion and orphan cleanup. Review `src/app.ts` static mounts and branch-specific `authenticatedStatic`. Do not use real customer uploads as fixtures. See `docs/ai/UPLOAD-FILES.md`.
