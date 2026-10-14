# 48 — tRPC's typecheck without rewriting dist

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 25. Found in the branch review on 2026-10-13.

## What to build

Ticket 25 says: "trpc keeps a separate script for its dist refresh." It didn't happen:

- `packages/trpc/package.json`'s `typecheck` is still `rm -rf dist .cache && tsc -p tsconfig.json`, so a type check deletes and re-emits `dist`.
- The emit is deliberate. Dependent workspaces read tRPC's types through `dist/`, about 33% cheaper than through source, and turbo's `typecheck` runs `^typecheck` first, so that run is what keeps `dist` fresh.

**The fix:**

1. Make `typecheck` a pure check (`tsc --noEmit`).
2. Leave the dist refresh to `build`, which already exists.
3. Make the dependents' `typecheck` depend on `@norish/trpc#build` in turbo, rather than on tRPC's type check.

## Acceptance criteria

- [ ] tRPC's `typecheck` writes nothing.
- [ ] `pnpm typecheck` from a clean checkout (no `dist`) passes.
- [ ] Its wall time is recorded before and after, and is no worse.

## Comments

- Filed 2026-10-13 from the branch review.
