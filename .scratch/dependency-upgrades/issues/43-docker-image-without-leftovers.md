# 43 — Docker image without leftovers

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 16. Found in the branch review on 2026-10-13.

## What to build

`docker/Dockerfile`:

- **`rm -rf .pnpm` after `pnpm deploy` (`:123`).**
  - The deploy writes a virtual store of about 880 MB despite `nodeLinker: hoisted`, and this line deletes it again.
  - Find out why the deploy writes it, so the deploy writes only what the image ships. Start by trying `--config.node-linker=hoisted` on the deploy and reading pnpm 12's `deploy` docs.
  - If pnpm can't, report it upstream with a repro.
- **A native toolchain nothing uses.** The deps stage installs `python3 make g++ pkgconfig libpq-dev` (`:39`), another stage installs `pkgconfig libpq-dev` (`:83`), and the runtime installs `libpq` (`:204`).
  - The lockfile has no node-gyp, pg-native or libpq.
  - The packages that could compile (cpu-features, ssh2, msgpackr-extract) are denied in `allowBuilds`.
  - Remove all three installs. This is the same case as the libvips removal (46ba3a36).
- **Stale comment (`:94-97`).** It says `injectWorkspacePackages` is enabled, but nothing sets it. The second install is still needed, because it recreates the `packages/*/node_modules` that aren't copied from the deps stage. Say that instead.

## Acceptance criteria

- [ ] The image builds and the image smoke test passes.
- [ ] The image is no larger than before.
- [ ] The Dockerfile has no `rm -rf .pnpm`, no compiler toolchain and no libpq.

## Comments

- Filed 2026-10-13 from the branch review.
