# 03: An administrator cancels a running job

**What to build:**

- An administrator watching a running job in the job monitor can cancel it:
  - The button reads "Cancelling…" until the job has stopped.
  - The job then shows as **Cancelled**, with a note that an administrator stopped it.
  - It never retries.
  - An AI call in flight is aborted at once. Non-AI work finishes its current step first.
  - Cancel is offered for running jobs on every queue.
- A server restart aborts AI calls in flight too, but those jobs run again on the next boot: a restart is not a cancel.

See `.scratch/architecture-after-upgrades/spec.md`, Background jobs, Cancellation, and CONTEXT.md's **Cancelled**.

**Blocked by:** 01 (`createWorker` passes the abort signal on)

**Status:** ready-for-agent

- [ ] The AI Runtime accepts an abort signal and passes it to the transport for every entry point (structured generation, transcription, image generation, Decision). Features pass the processor's signal through.
- [ ] A new admin procedure cancels an active job through the worker's `cancelJob(jobId, reason)`. The existing remove action still refuses active jobs.
- [ ] The processor wrapper turns an admin-cancel abort into a failure that does not retry, with a reason that records that an administrator stopped the job.
- [ ] Shutdown calls `cancelAllJobs()` with a reason the wrapper treats as retryable, before closing the workers.
- [ ] The job monitor shows a Cancelled state, distinct from failed, and a cancel action on active jobs that reads "Cancelling…" until the job leaves `active`. Copy goes through the message catalogue in every shipped language.
- [ ] Real-Redis tests:
  - [ ] Admin cancel of an active job ends it failed, with no further attempt and with the administrator's reason.
  - [ ] Shutdown cancel leaves the job retryable.
- [ ] An AI Runtime unit test proves the signal reaches the transport.
- [ ] A browser E2E (next to the job monitor coverage in the decision-model spec): an administrator cancels a running AI job and sees it Cancelled.
- [ ] Release notes, under Features: administrators can cancel a running background job. The admin settings docs page shows it, with a screenshot.
