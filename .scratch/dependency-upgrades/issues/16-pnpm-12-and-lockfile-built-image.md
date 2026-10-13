# 16 — pnpm 12, and the image installs what the lockfile says

Status: ready-for-agent
Blocked by: 15 (Node 26)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Two linked changes.

**1. The image stops re-resolving dependencies at build time.**

- **The problem.** `docker/Dockerfile` runs `pnpm deploy --legacy --filter @norish/web --prod`. That prints "A pnpm-lock.yaml file exists. The current configuration prohibits to read or write a lockfile." and resolves every dependency from its semver range on each build. This was reproduced in a scratch deploy.
- **Why it matters.** A published image contains whatever versions were current on the day it was built, not what CI tested. Two builds of the same commit can differ.
- **The Dockerfile comment is half right.** It calls legacy deploy "equivalent here", which is true for the workspace copies it deletes, but not for versions.

**2. pnpm 12 removes the reason for `--legacy`.**

- pnpm 10's default deploy needs `injectWorkspacePackages`, which the repo deliberately doesn't set. pnpm 11's deploy no longer requires it; confirm that pnpm 12 keeps that before relying on it.
- So: move to pnpm 12 and deploy from the lockfile without `--legacy`.

**pnpm 11 and 12 changes that touch Norish** (12 is a native CLI; read its CHANGELOG for anything beyond 11's list):

- **`onlyBuiltDependencies` is removed** in favour of an `allowBuilds` map (`pnpm-workspace.yaml`). Seed it with `pnpm ignored-builds` on pnpm 10 first.
- **`strictDepBuilds` is true.** Dependencies whose build scripts are silently ignored today would fail the install.
- **Unknown keys in `pnpm-workspace.yaml` become errors** in pnpm 12.
- **New defaults:** a `minimumReleaseAge` of one day, `blockExoticSubdeps`, and `verifyDepsBeforeRun: install`. Keep them; ticket 07 matches Renovate's release age to them.
- **Every place that names the pnpm version:**
  - `packageManager` in `package.json`;
  - the pnpm line in `docker/Dockerfile`;
  - `.devcontainer/default/Dockerfile`.
- **The CI action.** `pnpm/action-setup` v6.1.0 supports pnpm 12 (`tooling/github/setup/action.yml`). Its README points to the successor `pnpm/setup`; moving to it is optional.

**In the same PR, so the image is auditable:**

- **Stop copying nested `node_modules`.** Exclude `packages/*/node_modules` from the runtime `COPY /app/packages/`. It carries the build stage's nested copies, such as `packages/shared-server/node_modules/undici`.
- **Widen the deploy clean-up.** Add `vite`, `rolldown` / `@rolldown` (about 20 MB) and `@types`. They leak in through better-auth's optional `vitest` peer.
- **Pin Node exactly.** `node:26.x.y-alpine3.24` on both `FROM` lines, not the floating `node:26-alpine3.24`, so two builds of the same commit use the same Node. Renovate bumps it (ticket 07).

**Not in scope** (decided 2026-10-13): an image scan.

## Acceptance criteria

- [ ] **Reproducible.** Two image builds of the same commit, a day apart, contain identical `node_modules` versions.
- [ ] **Matches the lockfile.** The deployed tree's lock matches `pnpm-lock.yaml` for production dependencies.
- [ ] **Size.** Image size before and after is recorded.
- [ ] **Exact Node.** Both `FROM` lines name an exact Node version.
- [ ] **pnpm 12 everywhere.** `pnpm install --frozen-lockfile` passes on pnpm 12 in CI, the devcontainer and Docker.
- [ ] **Gates and E2E.** The gates pass, and `pnpm test:e2e` passes against the image build.

## Comments

- Filed 2026-10-12 with the spec.
- Sources:
  - the pnpm 11.28.2 and 12.11.2 CHANGELOGs;
  - the pnpm 10.34.5 bundle;
  - a scratch `pnpm deploy --legacy` run.
- 2026-10-13 — pnpm 12 instead of 11: `pnpm/action-setup` v6.1.0 (2026-09-05) supports it. The image scan is dropped (no scans or blocking audits, per the maintainer). The exact Node pin moved here from ticket 04.
