# 02: BullMQ deduplication replaces the hand-rolled checks

**What to build:**

- A reader who taps import twice on the same URL gets one import.
- Importing it again after the first import has finished runs a new import, whatever the job history keeps.
- A burst of calendar edits reaches the calendar app as one sync, and an edit made while a sync runs is synced right after it.
- Restarting twice in a minute asks for one catalogue refresh.

All three producers use BullMQ's deduplication in one `add`, replacing the check, the removal and the re-read each does by hand today. See `.scratch/architecture-after-upgrades/spec.md`, Background jobs, Deduplication.

**Blocked by:** 01 (the CalDAV debounce needs delayed jobs, which only an always-on worker runs reliably)

**Status:** ready-for-agent

- [ ] The boot catalogue ask adds its job with a fixed deduplication id and no longer scans the pending jobs. The next boot after the job finishes asks again.
- [ ] Recipe import:
  - [ ] Today's deterministic id becomes the deduplication id, with a unique job id.
  - [ ] A duplicate is recognised by `add` returning a job whose id differs from the one asked for.
  - [ ] The pre-check, the removal of a kept finished job and the race re-read are deleted.
- [ ] CalDAV sync adds with a delay of about two seconds and `deduplication: { id, replace: true, keepLastIfActive: true }`. The hand-rolled replace-and-follow-up is deleted.
- [ ] Enrichment's producer is unchanged. A comment says why: its status read and automatic-run merging rely on deterministic ids and kept history.
- [ ] Real-Redis tests:
  - [ ] The same URL imported twice yields one job.
  - [ ] Imported again after completion, it yields a second job.
  - [ ] Five CalDAV adds within the delay yield one sync.
  - [ ] An add while a sync is active yields exactly one follow-up sync.
  - [ ] Two boot asks yield one job.
  - [ ] Every real-Redis test connects through the production connection options and the shared Redis image constant from the sweep's ticket 34, and adds no `vi.clearAllMocks()` (Vitest 5's default, the sweep's ticket 31).
- [ ] Recipe-import and calendar E2E specs pass against a rebuilt `dist-server`.
