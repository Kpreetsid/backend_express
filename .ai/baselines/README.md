# Compatibility Baselines

`api-routes.sha256` is the reviewed SHA-256 digest of the normalized route-declaration inventory. It covers the method/path declarations and router mount points in `src/app.ts` and all route/controller files without coupling the baseline to source line numbers.

Commands:

```powershell
npm run check:api-contract -- --print
npm run check:api-contract -- --hash
npm run check:api-contract
```

The printed inventory is the human-review artifact. Any digest update requires explicit API compatibility approval and evidence that existing paths, methods, payloads, status codes, headers, and socket events remain compatible.

`response-contracts.json` inventories 319 Express response call sites. It
records status expressions, payload kinds, top-level object keys, and a call
hash so an accidental status or response-shape change fails CI.

```powershell
npm run check:response-contracts
npm run generate:response-contracts
```

Regeneration is an approval action, not a routine formatting step. Review the
diff alongside route-level compatibility evidence before accepting it.

On 2026-07-29 the response baseline was regenerated after internal
work-request tenant-service calls moved source lines. A multiset comparison
excluding line numbers proved `318 -> 318` call sites with zero semantic
additions or removals across file, method, status, payload, expression, and
call hash before the line metadata was accepted.

On 2026-07-30 one additive `401` response was reviewed for the newly protected
operational `/metrics` endpoint. No existing business-route response was
normalized or removed.
