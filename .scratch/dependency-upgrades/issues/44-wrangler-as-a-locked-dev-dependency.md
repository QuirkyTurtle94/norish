# 44 — wrangler as a locked devDependency

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 22. Found in the branch review on 2026-10-13.

## What to build

`docs-deploy.yml:57` and `landing-deploy.yml:49` run `pnpm dlx wrangler@4.149.0`.

- The version lives in a `run:` string, outside every lockfile and without an integrity hash, so CI downloads whatever the registry serves under that version.
- `pnpm outdated` and `pnpm audit` can't see it, and neither could Renovate without a regex manager. The workflow comments say Renovate bumps it; nothing does (ticket 07 is wontfix).

**The fix:**

1. Make wrangler a devDependency of `apps/docs` (which has its own lockfile) and of `apps/landing`.
2. Run it with `pnpm exec wrangler`.
3. Delete the comments that say Renovate bumps the pin.

## Acceptance criteria

- [ ] Both workflows run `pnpm exec wrangler`, and wrangler's version is recorded in a lockfile.
- [ ] A deploy run, or a `wrangler --version` step in CI, passes.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — Reason reworded now that ticket 07 is wontfix: the case is the lockfile and integrity hash, not Renovate.
