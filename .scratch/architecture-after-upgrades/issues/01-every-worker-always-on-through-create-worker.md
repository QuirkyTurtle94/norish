# 01: Every worker runs always-on, started through `createWorker`

**What to build:** Every background queue has a worker running from boot, so a retry waiting out its backoff runs when the backoff ends, even if nothing else is ever added to that queue, and a retry pending across a restart runs after it.

All sixteen workers start one way, including the two built by hand today (scheduled tasks and store lookup). That one way does four things:

- wraps the processor in the operation context and the model ledger, so no worker can miss the job monitor's AI-model chip again
- logs worker errors through the server logger
- registers the worker for shutdown
- passes the processor BullMQ's abort signal as a third parameter

The lazy-worker manager and `defineLazyWorker` are deleted with no alias. See `.scratch/architecture-after-upgrades/spec.md`, Background jobs.

Shutdown bounds its close by force-closing the workers once the budget runs out. No BullMQ connection sets `commandTimeout`: in ioredis 6 it also applies to the worker's blocking wait for its next job, which lasts up to `drainDelay` (5 s), so it would fail every idle wait. See the spec, Background jobs, Shutdown has a bounded close.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged, so the `drainDelay` fix (the sweep's ticket 51) and the half-open Redis work (34, 35) are already in.

**Status:** ready-for-agent

- [ ] A small, non-lazy `createWorker(queue, processor, options)` in the queue package is the only way a worker starts, and it does exactly the four things above.
- [ ] All sixteen workers start through it at boot.
- [ ] The lazy-worker manager, `defineLazyWorker`, the boot-time lazy registration, the store-lookup "delay trap" guard and the lazy-worker test files are deleted.
- [ ] No module outside the registry constructs a `Queue`.
- [ ] An idle server holds one blocking Redis connection per worker and no QueueEvents connections. Record the `CLIENT LIST` count in this ticket.
- [ ] Real-Redis tests (a Redis testcontainer, as the scheduled-tasks producer test does):
  - [ ] A job that fails once and retries with a backoff runs again when the backoff ends, with no other job added to the queue.
  - [ ] A worker `error` reaches the logger.
  - [ ] The processor receives an abort signal.
  - [ ] Every processor runs inside the operation context and the model ledger.
  - [ ] Every real-Redis test connects through the production connection options and the shared Redis image constant from the sweep's ticket 34, and adds no `vi.clearAllMocks()` (Vitest 5's default, the sweep's ticket 31).
- [ ] Shutdown closes every worker. The shutdown step still names itself in the log if it runs slow.
- [ ] Once the shutdown budget runs out, the workers are force-closed (`worker.close(true)`). No BullMQ connection sets `commandTimeout`; if the sweep's ticket 35 landed one, it is replaced by the force-close.
- [ ] The sweep's ticket 35 regression still passes: `realtime.e2e.ts` runs the Redis restart before the server restart, and the shutdown log names no step over budget.
- [ ] The E2E suite passes against a rebuilt `dist-server`, including the job monitor's AI-model chip in the decision-model spec.
- [ ] Release notes, under Fixes and Improvements: "A recipe import or calendar sync that failed and is due to retry now retries as soon as its wait is over. Before, the retry did not run until another import or sync was started, even after a restart." The maintainer will rewrite it.
