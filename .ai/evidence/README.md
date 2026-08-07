# Evidence Index

CI must retain immutable, access-controlled evidence by commit and environment:

- API and APP dependency locks, scan results, test/coverage reports, build logs, SBOMs, checksums, and provenance attestations;
- route compatibility digest and approved response-shape changes;
- Terraform format/validate/plan and approval records;
- CodeDeploy deployment ID, target health, alarms, smoke output, approval, and rollback result;
- backup timestamp, restore drill timeline, measured RPO/RTO, and data validation;
- load/failover results against the SLO thresholds;
- security access reviews, risk acceptances, vulnerability remediation, incidents, and postmortems.

Do not store secrets, tokens, production payloads, or restricted file contents as evidence.
