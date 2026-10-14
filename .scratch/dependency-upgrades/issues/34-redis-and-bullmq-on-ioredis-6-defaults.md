# 34 — Redis and BullMQ on ioredis 6's defaults

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

Ticket 18 set `protocol: 2` (RESP2) in two places:

- `getRedisConnectionOptions` in `packages/shared-server/src/redis/client.ts:48`.
- `getBaseOptions` in `packages/queue/src/redis/bullmq.ts:37`. This function also rebuilds the URL parsing, keep-alive, timeouts and retry instead of reusing the shared options.

Both comments say RESP2 keeps "every reply shape" as it was. That is not the reason:

- ioredis 6 already maps RESP3 replies to the RESP2 shapes by default (`replyMapping: "legacy"`, `ioredis/built/redis/RedisOptions.js:56`).
- RESP3 only lifts subscriber mode's limits on which commands a connection may send.

**The fix:**

1. **Drop `protocol: 2` from both places.**
2. **One options builder.** BullMQ's connections start from `getRedisConnectionOptions()` and add only what BullMQ needs on top (ready check, offline queue, retry cap).
3. **Tests run what production runs.** Every real-Redis test connects through the production options, not a bare `{ host, port }`. They also use the Redis that compose ships: 8.10.1 in `docker/compose.base.yaml`, while the tests start `redis:8.6.2-alpine`. One shared constant names that image. The tests are:
   - `packages/queue/__tests__/scheduled-tasks/producer-redis.test.ts`
   - `packages/queue/__tests__/queue/lazy-worker-redis.test.ts`
   - `packages/auth/__tests__/auth/secondary-storage.test.ts`
   - `packages/auth/__tests__/auth/oidc-flow.test.ts`
   - `apps/web/__tests__/e2e/harness/production-stack.ts:221`
4. **Delete `case "paused"`** in `packages/shared/src/lib/recipe-enrichment.ts:501`. BullMQ 6's `JobState` has no paused state.

If BullMQ misbehaves on RESP3, report it upstream with the failing test. Do not pin the protocol.

## Acceptance criteria

- [ ] No Redis connection sets `protocol`.
- [ ] Pub/sub and BullMQ connections are built from one options builder.
- [ ] The real-Redis tests use the production options and compose's Redis version, and they pass.
- [ ] The realtime E2E project passes, which shows pub/sub working on RESP3.

## Comments

- Filed 2026-10-13 from the branch review. The maintainer wants a clean ioredis 6 and BullMQ 6 migration, with no protocol opt-out.
