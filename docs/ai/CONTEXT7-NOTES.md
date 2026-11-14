# Version-aware framework references

The archive reported Context7 lookups for Express 5.1 and Mongoose 8.19, performed by its author for a different snapshot. Those are not current validation of CMMS_API.

This checkout declares Express ^5.3.0, Mongoose ^9.11.2 and TypeScript ^6.0.3. Inspect package.json/installed versions and matching official documentation when framework details affect a change. Use Context7 if available; these files do not configure or require it.

For the 2026-11-12 instruction audit, Context7 was queried for Mongoose 9.0.1, an available 9.x baseline; exact local 9.11.2 was not indexed. Its [official validation reference](https://github.com/automattic/mongoose/blob/9.0.1/docs/validation.md) confirms query-update validators are opt-in with runValidators, apply only to updated paths and supported update operators, and do not validate $inc. This framework evidence does not prove a local service enforces its invariants.

Keep framework guarantees separate from application evidence: promise forwarding is not validation/authorization; update validation does not cover every invariant; database transactions do not make mail/storage atomic. Test the local middleware, schema and helper behavior before claiming guarantees.
