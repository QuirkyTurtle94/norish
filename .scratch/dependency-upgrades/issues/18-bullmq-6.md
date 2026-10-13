# 18 — BullMQ 6

Status: ready-for-agent
Blocked by: 17 (the commit before). Ticket 24 is checked in this commit.
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `bullmq` to the 6.x line (6.0.0 shipped on 2026-07-30; 6.3.14 on 2026-10-13), and `ioredis` to 6.

- BullMQ 6 makes ioredis an optional peer (`>=5`) and requires it lazily, only when it is given connection options. Norish passes ioredis instances (`packages/queue/src/redis/bullmq.ts`) and depends on ioredis directly.
- **The boot sweep must stay.** A legacy md5 repeatable left in Redis would not sit idle on 6: the worker treats it as a scheduler (`worker.js:529-541`), and 6 dropped 5.x's `data` backfill, so later iterations would run with `{}` and no `taskType`. The sweep in `scheduled-tasks/producer.ts` removes them at every boot.

**ioredis 6** (decided 2026-10-13: the newest stable release, not held):

- 6.0.0 shipped on 2026-07-31; it needs Node ≥ 20. bullmq 6 accepts any `ioredis >=5`.
- **RESP3 is on by default.** Pin `protocol: 2` on every ioredis client Norish creates (BullMQ connections, realtime pub/sub, the resume streams, the Better Auth secondary storage), so the wire protocol is unchanged. Moving to RESP3 is a later, separate change.
- Read the 6.0 notes for anything beyond RESP3 that touches pub/sub, `duplicate()`, Lua scripts or reconnection, and record it in the comments.
- The ioredis dependencies that ticket 17 removes from packages/api and packages/trpc stay removed.

**Ticket 24 is checked here**, against real Redis, because `lazy-worker-manager.ts` is open anyway. Fix it only if it reproduces.

After ticket 17, the remaining breaking surface doesn't touch Norish:

- `debounce`, `discard()`, `getRepeatableJobs` and `removeRepeatable*` are removed; Norish uses none of them.
- `QueueEvents` now parses `completed.returnvalue`; Norish listens only to `waiting` and `drained`.
- `waitUntilReady()` returns `void`.
- `Worker.resume()` is async; it is already awaited in `lazy-worker-manager.ts`.
- The third constructor argument is now a backend factory.
- cron-parser moves to 5.
- The Proxy in `operation-aware-queue.ts` stays safe, because BullMQ uses no `#private` fields.

**Self-hosters:**

- **Redis.** The minimum is unchanged: 5.0.0, with 6.2.0 recommended. Compose ships `redis:8.10.1` (`docker/compose.base.yaml`), while `README.md` and the docs' `QuickStartCompose` still say 8.4.0. Both versions are fine; align the docs.
- **No downgrade.** v6 is one-way; no downgrade path is documented. → Upgrade note.

**Later improvement:** BullMQ 6's typed `ProgressType`, replacing `readStepProgress(unknown)` in `packages/queue/src/job-steps.ts`.

## Acceptance criteria

- [ ] **Type check.** `pnpm typecheck` passes.
- [ ] **One ioredis.** `pnpm why ioredis` shows one 6.x copy, and every client sets `protocol: 2`.
- [ ] **Boot twice.** A real-Redis test starts from a 5.x-created repeatable, boots twice on 6, and ends with exactly one scheduler per task and no legacy keys.
- [ ] **Tests.** The queue tests pass, including ticket 17's scheduler and client assertions.
- [ ] **Production smoke.** On a production build: a scheduled task fires, an enrichment runs, a URL import and a paste import run, and the admin job-queue view lists jobs.
- [ ] **Docs.** The Redis version is aligned in `README.md` and the docs.
- [ ] **Release notes.** An Upgrade note that the queue upgrade is one-way: back up Redis before upgrading if you might roll back.
- [ ] **Ticket 24.** Its outcome is recorded in its comments.

## Comments

- Filed 2026-10-12 with the spec.
- 2026-10-13 — Moved into 0.26 with no release in between (see ticket 17). ioredis 6 taken with `protocol: 2`; the earlier hold reason ("BullMQ's CI still tests against ioredis 5") could not be confirmed from the registry.
