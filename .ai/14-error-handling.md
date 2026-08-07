# Error Handling

Domain errors are typed and mapped centrally to the existing HTTP status and response contract. Existing routes must not receive a breaking response normalization.

Every error response may add request/trace identifiers, but must not expose stacks, secrets, internal hosts, database details, or sensitive values. Validation errors use stable field identifiers and messages mirrored by Angular. Unknown errors are logged once at the boundary with redaction.

Timeouts, retries, circuit behavior, and fail-open/fail-closed decisions are explicit for each dependency. Mutations use idempotency and transactions where required; queue consumers are idempotent.

Parts mutations install idempotency explicitly. Multipart imports parse and
decrypt the upload before computing the idempotency identity, and the
fingerprint hashes actual bytes from either Multer memory buffers or
disk-backed files. Missing file bytes fail closed rather than silently
deduplicating different imports.
