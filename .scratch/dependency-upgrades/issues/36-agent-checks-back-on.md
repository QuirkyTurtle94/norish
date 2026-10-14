# 36 — Next and Turborepo agent checks back on

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md` decision 9. Found in the branch review on 2026-10-13.

## What to build

Three settings switch the coding-agent checks off:

- `experimental.agentUpgrade: false` in `apps/web/next.config.js:66` and `apps/landing/next.config.ts:29`. The comment says that otherwise `next build` fails under a coding agent whenever the installed Next has an advisory.
- `"agentGuidance": false` in `turbo.json:3`. It arrived with the lockfile refresh (3dae889c), and no ticket asked for it.

The maintainer wants them on. A build that stops because Next has an advisory is the signal to upgrade Next.

1. Remove the three settings and their comments.
2. Record in this ticket what each check does on the current versions, so the next agent knows what to expect.
3. ~~Update spec decision 9.~~ Done on 2026-10-14 with the plan fix.

## Acceptance criteria

- [ ] None of the three settings remain.
- [ ] `pnpm build` passes both from a coding agent and in CI.
- [x] Spec decision 9 says the checks are on.

## Comments

- Filed 2026-10-13 from the branch review. The maintainer thinks the checks can be on.
- 2026-10-14 — The maintainer confirmed the reversal; spec decision 9 now says the checks are on.
