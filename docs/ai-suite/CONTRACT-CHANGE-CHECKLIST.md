# Checklist for any cross-repository contract change

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

- [ ] Name the producer repository, consumer repository and specific branch of each.
- [ ] Capture full composed URL (including gateway/base prefix) and HTTP verb.
- [ ] Document identity type (staff/customer/service), cookies, bearer token and CSRF rules.
- [ ] Document `account_id`, assigned company and staging/production resolution.
- [ ] Record request types, optional/required fields, query parameters, enums and validation.
- [ ] Record response envelope, binary streaming, pagination, field casing and `id` aliases.
- [ ] Record 400/401/403/404/409/410/429 and rate-limit/retry behavior.
- [ ] Record side effects, file writes, notifications, job scheduling and audit logs.
- [ ] Confirm backward compatibility; if breaking, agree deploy sequence or version route.
- [ ] Add consumer and producer tests, including denied and invalid cases.
- [ ] Check stale frontend cache/session and version propagation.
- [ ] Run documented commands; provide exit status and evidence.
- [ ] Approve secret/config changes separately; do not log tokens in docs.
- [ ] Specify rollback method and data compatibility.
