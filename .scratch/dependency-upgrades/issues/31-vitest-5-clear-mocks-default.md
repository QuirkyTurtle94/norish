# 31 — Vitest 5's clearMocks default

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

Ticket 13 kept `clearMocks: false` in all 11 Vitest configs ("kept off so the upgrade changes no test"). Vitest 5 defaults it to `true`, so the option turns the new behaviour back off. The configs are in `apps/web`, `tooling/nutrition`, and `packages/{api,auth,config,db,queue,shared,shared-react,shared-server,trpc}`.

1. Delete the option from every config.
2. Fix the tests that relied on mock calls surviving into a test, for example calls recorded in `beforeAll` or at module scope.
3. Delete the hand-written `vi.clearAllMocks()` calls that now only repeat the default. About 173 test files have one, mostly in `beforeEach`.

## Acceptance criteria

- [ ] No Vitest config sets `clearMocks`.
- [ ] No `vi.clearAllMocks()` remains that only repeats what the default already does.
- [ ] `pnpm test:run` passes, and a second run passes too.

## Comments

- Filed 2026-10-13 from the branch review. The maintainer did not accept the opt-out: adopt the default.
