# Scoped cache, session and change-stream instructions

Follow root/src guides. Read src/_config/redis.ts, the relevant key/helper and affected producers/consumers before changing state. Redis may be disabled/unavailable; verify this consumer's actual fallback/invalidation.

Partition account/user-sensitive cache/session entries; preserve expiry, logout/revocation, permission-version invalidation and safe token hashing. A cache hit must not bypass authorization. Trace changeStream/ and explicit eviction together; model writes do not prove all caches refresh. For streams/consumers inspect shutdown and failure/retry paths. Mock or isolate Redis/Mongo in tests; do not dump credentials, keys or customer payloads.
