# 01: Every worker runs always-on, started through `createWorker`

**What to build:** Every background queue has a worker running from boot, so a retry waiting out its backoff runs when the backoff ends, even if nothing else is ever added to that queue, and a retry pending across a restart runs after it.

All sixteen workers start one way, including the two built by hand today (scheduled tasks and store lookup). That one way does four things:

- wraps the processor in the operation context and the model ledger, so no worker can miss the job monitor's AI-model chip again
- logs worker errors through the server logger
- registers the worker for shutdown
- passes the processor BullMQ's abort signal as a third parameter

The lazy-worker manager and `defineLazyWorker` are deleted with no alias. See `.scratch/architecture-after-upgrades/spec.md`, Background jobs.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged, so the `drainDelay` fix (the sweep's ticket 51) is already in.

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
- [ ] Shutdown closes every worker. The shutdown step still names itself in the log if it runs slow.
- [ ] The E2E suite passes against a rebuilt `dist-server`, including the job monitor's AI-model chip in the decision-model spec.
