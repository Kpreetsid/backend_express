# Mongoose persistence, tenancy and concurrency

## Local boundaries

- Models in src/models/ own collections, references, indexes, visible soft deletion, statuses and transforms. Inspect src/models/workOrder.model.ts before changing enums/relationships.
- src/_db/mongoosePlugins.ts installs global id standardization from server startup. Tests importing models directly may not reproduce that setup. Inspect per-schema transforms and aggregate/lean output rather than assuming identical shapes.
- src/models/plugins/sync-version.plugin.ts maintains sync_version on covered saves/queries. src/utils/sync-concurrency.ts reads If-Match and emits ETag/stale-version errors; concurrent writes still need appropriate atomic predicates.
- src/utils/transaction.helper.ts is the withTransaction wrapper. On unsupported Mongo topology it can rerun the callback without a session, then remember that mode. Do not promise rollback/atomicity on that path or assume mail/file side effects are retry-safe.
- Account-sensitive cache/session/change-stream consumers live in src/_cache/. Mutations may need explicit eviction and downstream events as well as model updates.

## Development rules

1. Enforce verified account/object ownership in reads, writes, nested lookups, population and aggregates. Check related asset/location/user records too.
2. Validate IDs and allowlist update, sort, populate and projection fields. Preserve visible semantics; do not replace soft deletion with hard deletion incidentally.
3. Check save and query-update validation; query validators require runValidators where suitable and only cover updated paths and supported operators. They do not validate $inc. The [checked official reference](https://github.com/automattic/mongoose/blob/9.0.1/docs/validation.md) is Mongoose 9.0.1, a 9.x baseline rather than an exact match for local ^9.11.2; recheck version-specific details and test service invariants beyond schemas.
4. Preserve id/_id output, collection names, references, version/history plugins and indexes. Schema evolution needs defaults, compatibility, backfill and rollback decisions.
5. Bound lists/aggregations, inspect indexes and avoid N+1 reads. Review cache keys/invalidation when queries change.
6. Test wrong-account/malformed/missing/deleted records, duplicate keys, stale versions, races and partial failures with isolated dependencies.

The archive's historical queryBuilder claims are not current evidence. Choose helpers actually present in src/utils/ and the affected domain.
