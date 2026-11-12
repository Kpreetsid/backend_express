---
name: cmms-backend-testing-debugging
description: "Use when reproducing CMMS_API errors, writing isolated backend tests or diagnosing route, auth, data, build or test failures."
---

# Backend testing and fault diagnosis

Apply these instructions to the **current checked-out repository branch**, not a remembered branch. Read repository-root `AGENTS.md` and the affected scoped guides when present. In a cross-project CMMS-Production task, also read the workspace and frontend guides explicitly; a standalone API clone does not require them. Bundled references remain usable with this skill outside the repository, but their snapshots never replace current source. Scale the procedure to the request: for read-only review inspect and report rather than edit; instruction-only work uses static metadata/link/reference/whitespace checks rather than runtime tests.

## Procedure

1. Inspect branch, `package.json`, error reproduction and surrounding route/controller/service/model. Use [testing](references/testing.md), not remembered npm commands.
2. Classify symptoms: transport mount, auth/permission, validation, DB lookup, data contract, file/cron/mail side effect or deployment.
3. Reproduce in a safe environment with mock/test DB; do not start production-dependent `npm start` just to check compilation.
4. Write focused positive/negative tests, including wrong-account and invalid-token cases; isolate time, mail, network and storage.
5. Run only supported checks; distinguish failure from test-environment prerequisites. Record full command and actual exit/result.
6. Fix root cause and any adjacent contract regression, rerun relevant checks, then report `PASS`, `FAIL`, `NOT RUN` and unresolved risks.

## Completion contract

Report inspected branch/commit, changed paths or findings, relevant contract/data/auth impact, actual checks with `PASS/FAIL/NOT RUN`, and material unresolved decisions. Include affected methods/routes/models only when applicable. Do not invent an endpoint exercise for a docs-only task or imply a push, deployment, test execution or API verification without evidence.

## Reference material

Load only what this task needs:

- [BRANCH-TRUTH.md](references/branch-truth.md)

- [ERROR-VALIDATION.md](references/error-validation.md)

- [KNOWN-UNVERIFIED.md](references/known-unverified.md)

- [TESTING.md](references/testing.md)
