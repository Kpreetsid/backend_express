# Production-Readiness Roadmap

| Gate | Outcome | Exit criteria |
|---|---|---|
| G0 Baseline | Handbook and compatibility evidence | owners, route baseline, risk register, measurable backlog reviewed |
| G1 Safety net | deterministic CI and tests | lockfiles, API/APP build, scans, SBOM, signed artifacts, coverage baseline |
| G2 Runtime controls | validated config and observability | fail-fast production config, request/trace IDs, structured logs, readiness/metrics |
| G3 State externalization | safe horizontal scale | managed MongoDB/Redis, distributed limits/socket adapter, queues/outbox, S3 |
| G4 HA release | multi-AZ blue-green | Terraform, ALB/ASG, alarms, smoke and rollback evidence |
| G5 Modernization | supported runtimes | Node 24 and sequential Angular 15→22 gates |
| G6 Certification | enterprise production approval | no critical findings, no expired exceptions, SLO/RPO/RTO and SOC 2 evidence |

Angular 15 and legacy Node 18 CI are permitted only by a named 90-day risk acceptance starting at handbook approval. They do not qualify for G6.
