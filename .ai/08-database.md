# Database Standard

- Production MongoDB is a managed, private, multi-AZ replica set with encryption, alerting, point-in-time recovery, and tested restores.
- Critical writes use majority durability. Transactions run with primary read preference.
- Automatic index creation is disabled in production. Index changes use reviewed, versioned manifests.
- `.ai/baselines/mongoose-indexes.json` is generated from all application
  Mongoose models. CI rejects schema/index drift until the manifest and a
  compatible migration are reviewed together.
- Every query includes tenant scope unless the operation is an explicitly reviewed platform operation.
- Migrations remain backward-compatible throughout blue-green overlap.

## Release evidence

Each release records migration compatibility, backup status, index-plan validation for changed high-volume queries, and rollback behavior. Quarterly restore drills must demonstrate RPO of 15 minutes or less and RTO of 60 minutes or less.
