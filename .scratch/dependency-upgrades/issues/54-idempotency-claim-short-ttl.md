# 54 — An idempotency claim lives five minutes until it completes

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. From `.scratch/architecture-after-upgrades/spec.md`, Further Notes ("What lands first"), fix 4.

## What to build

`runWithIdempotency` in `packages/trpc/src/idempotency-middleware.ts:128` claims an operation id with the placeholder `{ done: false }` and the full seven-day TTL. If the owning request dies before it finishes, for example in a crash or restart, the placeholder stays for seven days. Every retry of that operation, such as the Outbox replaying it, waits out the poll budget and fails for a week.

1. Claim with a five-minute TTL.
2. When the owner stores its response (`:144`), the key gets the full seven days, as today.

## Acceptance criteria

- [ ] A claim whose owner never completes expires after five minutes, and a retry then runs the operation.
- [ ] A completed response is still kept for seven days.
- [ ] The middleware's tests cover both.

## Comments

- Filed 2026-10-14 from the architecture spec's list of fixes meant for this branch; no deps ticket tracked them.
