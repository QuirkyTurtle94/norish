# 38 — Overrides and allowBuilds hold only what is needed

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, tickets 03 and 28. Found in the branch review on 2026-10-13.

## What to build

The branch added these entries to `pnpm-workspace.yaml`. None of them is needed for anything to work.

- **`"@prisma/client"`, `prisma` and `mysql2` set to `"-"`.**
  - They are optional peers of Better Auth's adapters, and the comment says they "only carried advisories".
  - Optional peers are not installed unless something asks for them.
  - To prove it, delete them and run `pnpm install --lockfile-only`. An unchanged lockfile means they were dead.
- **`drizzle-kit>@esbuild-kit/esm-loader: "-"`.** The comment calls this an optional peer, which is wrong.
  - It is a regular dependency of drizzle-kit 0.31.11 (npm `latest`). It is deprecated ("merged into tsx") and drizzle-kit never loads it: its `bin.cjs` and `api.js` contain no reference to it.
  - The override deletes it only to clear the esbuild 0.18 dev-server advisory (GHSA-67mh-4wv8-2f99, medium) that it brings in.
  - Remove the override. The advisory then shows in `pnpm audit` until drizzle-kit 1.0, which is a held line, drops the dependency.
- **`allowBuilds` entries `@heroui/shared-utils` and `unrs-resolver`.** Neither package is in the lockfile.

## Acceptance criteria

- [ ] Those four overrides and two `allowBuilds` entries are gone.
- [ ] `pnpm install --frozen-lockfile` and `pnpm audit --audit-level=high` pass.
- [ ] Every remaining override has a comment that says why it is there (ticket 03's rule).

## Comments

- Filed 2026-10-13 from the branch review.
