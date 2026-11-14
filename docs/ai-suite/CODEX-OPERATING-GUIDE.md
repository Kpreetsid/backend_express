# Codex-only operating guide

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Startup commands

```powershell
Get-Location
# From CMMS-Production: inspect only repositories affected by the task.
git -C CMMS_APP status --short
git -C CMMS_APP branch --show-current
git -C CMMS_APP rev-parse HEAD
rg --files --hidden -g AGENTS.md -g SKILL.md -g package.json -g angular.json -g !node_modules -g !.git
```

Repeat the Git checks with the actual affected repository folder. CMMS-Production itself is not a Git or npm project; in a standalone checkout run Git/package commands from that checkout root.

If all four repositories are siblings, open the **parent folder as a Codex workspace**, read the parent `AGENTS.md` and `docs/ai-suite/INDEX.md`, then the scoped `AGENTS.md` for each changed repo. If only one repository is open, its own overlay contains a full copy of the suite reference docs.

## Appropriate skill invocation examples

- `$presage-cross-repo-change` - feature spans several apps.
- `$presage-contract-tracing` - mismatch between frontend call and backend handler.
- `$presage-auth-boundaries` - login, permission, account/tenant or environment.
- `$presage-feature-audit` - confirm feature is truly wired and test-covered.
- `$presage-regression-validation` - review test gaps and verification evidence.
- `$presage-email-login` - customer reusable deep links or internal support grant.
- `$presage-knowledge-base` - publisher/reader PDF flow.
- `$presage-release-readiness` - prepare integration/release checklist.

## Output expectations

Provide a scope/ownership table, branch-aware evidence, specific code/contract changes, security impact, test command outcomes and unresolved blockers. No automatic push/deploy or live data mutation. Avoid claiming simulated tests are real execution.

## Tooling

Use GitHub access for current source, Context7 or official docs for framework/version APIs, and local test commands for verification. Cross-repo documentation is a lookup map, not permission to ignore current repository instructions. Codex uses `AGENTS.md` and `.agents/skills/*/SKILL.md`; this pack intentionally excludes Claude/Cursor/Copilot-specific files.
