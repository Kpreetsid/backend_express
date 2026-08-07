# CMMS AWS HA Infrastructure

This Terraform root creates the production target topology: two-AZ VPC
networking, public ALB, private API Auto Scaling, blue/green target groups and
CodeDeploy, managed Redis, private upload storage, a versioned Angular
S3/CloudFront origin, WAF, encrypted API/worker logs, ALB access evidence,
dashboards, alarms, and CPU target tracking.

Use separate state backends and variable files for development, staging, and production. Never commit secret values or a Terraform state file.
Reviewed examples live under `environments/`. Copy them outside version
control, replace every placeholder, and supply `redis_auth_token` through an
approved encrypted environment/CI secret.

```powershell
terraform init -backend-config=environments/production.backend.hcl
terraform plan -var-file=environments/production.tfvars
terraform apply -var-file=environments/production.tfvars
```

Prerequisites are a Node 24/CodeDeploy-enabled immutable AMI, ACM certificate,
Route 53/DNS change, MongoDB managed connection secret, Redis auth token,
`PROCESSOR_API_URL` plus a processor-only `PROCESSOR_API_TOKEN` supplied by the
approved secret workflow, and the GitHub OIDC roles. Include the processor
secret ARN in `runtime_secret_arns`; do not reuse a CMMS user JWT. Desired
capacity must remain one until managed Redis, S3 migration, and two-instance
tests are approved.

The first `runtime_secret_arns` entry must contain one JSON object whose keys
match `configDB.ts`. Launch templates persist only its base64-encoded ARN and
region in a root-owned context file. CodeDeploy retrieves the secret immediately
before index migration and PM2 startup, passes it through an argument-safe Node
wrapper, and never writes secret values to disk. If the secret uses a
customer-managed KMS key, list that key in `runtime_secret_kms_key_arns`. The
immutable AMI must include the AWS CLI as well as Node 24, PM2, CodeDeploy, and
the telemetry/logging agent.

The secret must include the production-only `METRICS_TOKEN` used to protect
`/metrics`, distinct access/external/refresh signing secrets, payload-key
sealing material, mail credentials with certificate verification, and the OTLP
collector endpoint. `alarm_notification_arns` connects CloudWatch alarm and
recovery notifications to approved SNS topics. API and worker JSON output is
written to fixed `/var/log/cmms` paths and shipped to separate KMS-encrypted
CloudWatch log groups; ALB access logs are versioned and retained for 400 days.

CloudFront applies HSTS, frame denial, MIME protection, referrer policy, and
`spa_content_security_policy`. The default policy disallows inline JavaScript
while permitting the existing same-origin application and explicit Google
Translate sources. Review any environment override as a security change.

CodeDeploy explicitly creates every index declared by the 43-model reviewed
manifest, plus the specialized upload/quota/PDF indexes, during `AfterInstall`
before the API and worker start. The migration is create-only and fails the
deployment on a conflicting definition; it never drops an index. Runtime
configuration and the MongoDB credential must therefore be available to the
deployment user before this hook runs. The S3 upload bucket separately expires
`generated-report-inputs/` after two days and `generated-reports/` after eight
days.

CI and the 2026-07-30 local gate format and provider-validate this root with
Terraform 1.15.8. A successful validation is not an approved plan or applied
environment.
