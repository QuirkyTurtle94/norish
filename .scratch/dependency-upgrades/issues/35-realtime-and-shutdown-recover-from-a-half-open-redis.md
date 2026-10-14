# 35 — Realtime and shutdown recover from a half-open Redis

Status: ready-for-agent
Blocked by: 34
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13. Absorbs `.scratch/architecture-after-upgrades/` ticket 05 (Redis section of that spec).

## What to build

After a Redis restart that leaves a half-open socket, Norish notices the dead connection within seconds and reconnects. Readers' realtime subscriptions see Lagged, refetch what they missed, and keep receiving Realtime Events. A server stopped after that restart shuts down within its budget.

**Today:**

- The Realtime Hub can listen on a dead socket for minutes, missing every Realtime Event without a Lagged signal, until the operating system's keep-alive gives up.
- Shutdown overruns its budget: BullMQ's `close()` and the hub's QUIT wait on sockets that never answer.
- c148d6a1 hid this by moving the realtime E2E's server-restart scenario ahead of its Redis-restart scenario (`apps/web/__tests__/e2e/realtime/realtime.e2e.ts`).

**The fix:**

1. **Notice a dead socket.** The publisher and the hub's subscriber get a `socketTimeout` of about ten seconds. The hub sends `PING` every fifteen seconds while subscribed, because an idle subscriber writes nothing else that would arm the timeout.
2. **Lagged on reconnect.** A hub reconnect still reports Lagged to its subscriptions, as every reconnect does today (ADR-0034). The realtime contract doesn't change.
3. **Quit without waiting.** The hub no longer sends UNSUBSCRIBE before quitting, and shutdown doesn't wait on a QUIT the dead socket never answers.
4. **Bound BullMQ's close.** A command timeout on the BullMQ connections, or force-closing the workers once the budget runs out.
5. **Names.** The publisher and the hub get `connectionName`s, as the BullMQ client already has.
6. **The E2E goes back to its original order** (Redis restart, then server restart) and becomes the regression test.

## Acceptance criteria

- [ ] The publisher and the hub's subscriber have a `socketTimeout` of about ten seconds, and the hub sends `PING` every fifteen seconds while subscribed.
- [ ] The hub no longer sends UNSUBSCRIBE before quitting.
- [ ] The publisher and the hub carry `connectionName`s.
- [ ] A test proves a hub reconnect after a heartbeat timeout reports Lagged.
- [ ] `realtime.e2e.ts` runs the Redis restart before the server restart again, and passes with `--repeat-each=5`.
- [ ] In that run, the shutdown log names no step over budget (the slow-step log from 0259640c).
- [ ] Release notes, under Fixes and Improvements: background jobs and realtime recover by themselves after a Redis restart.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — The maintainer chose to fix this on this branch and mark `.scratch/architecture-after-upgrades/` ticket 05 as its duplicate. Its scope moved here, except its connection-options criterion (now in 34) and "`protocol: 2` stays", which the maintainer reversed: RESP3, no protocol pin.
