---
name: cmms-backend-upload-security
description: "Use when working on CMMS_API uploads, base64 images, Multer, private file retrieval, storage paths or attachment access."
---

# Secure uploads and file access

Apply these instructions to the **current checked-out repository branch**, not a remembered branch. Read repository-root `AGENTS.md` and the affected scoped guides when present. In a cross-project CMMS-Production task, also read the workspace and frontend guides explicitly; a standalone API clone does not require them. Bundled references remain usable with this skill outside the repository, but their snapshots never replace current source. Scale the procedure to the request: for read-only review inspect and report rather than edit; instruction-only work uses static metadata/link/reference/whitespace checks rather than runtime tests.

## Procedure

1. Read [file handling](references/upload-files.md); inspect `src/app.ts` static routes and branch-specific upload/auth middleware.
2. Identify storage root and all sources of `filename`, `folderName`, MIME and base64 content; treat all as untrusted.
3. Enforce allowlisted categories, canonical path containment, MIME+signature checks, count/byte budgets, random filenames and tenant access.
4. Define cleanup for failed writes and deletes; verify privacy for public/static retrieval endpoints.
5. Test traversal encodings, spoofed content, oversize, too many files, anonymous/wrong-account access and orphan cleanup without real customer files.
6. Report confirmed coverage, risky patterns and source evidence; never claim a vulnerability was exploited without proof.

## Completion contract

Report inspected branch/commit, changed paths or findings, relevant contract/data/auth impact, actual checks with `PASS/FAIL/NOT RUN`, and material unresolved decisions. Include affected methods/routes/models only when applicable. Do not invent an endpoint exercise for a docs-only task or imply a push, deployment, test execution or API verification without evidence.

## Reference material

Load only what this task needs:

- [AUTH-RBAC-SECURITY.md](references/auth-rbac-security.md)

- [BRANCH-TRUTH.md](references/branch-truth.md)

- [TESTING.md](references/testing.md)

- [UPLOAD-FILES.md](references/upload-files.md)
