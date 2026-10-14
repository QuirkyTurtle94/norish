# 35 — Shutdown closes BullMQ within its budget after a Redis restart

Status: ready-for-agent
Blocked by: 34
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

c148d6a1 moved the realtime E2E's server-restart scenario ahead of its Redis-restart scenario (`apps/web/__tests__/e2e/realtime/realtime.e2e.ts`).

- The reason: after the Redis restart, a half-open connection makes BullMQ's `close()` overrun the shutdown budget.
- Changing the order hides real behaviour. A server stopped after a Redis blip still overruns its shutdown.

**The fix:**

1. Bound the close. Options are a command timeout on the BullMQ connections, or force-closing the workers once the budget runs out.
2. Put the scenarios back in their original order.

## Acceptance criteria

- [ ] `realtime.e2e.ts` runs the Redis restart before the server restart again, and passes with `--repeat-each=5`.
- [ ] In that run, the shutdown log names no step over budget (the slow-step log from 0259640c).

## Comments

- Filed 2026-10-13 from the branch review.
