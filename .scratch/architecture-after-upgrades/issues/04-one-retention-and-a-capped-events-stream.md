# 04: One retention, and a capped events stream

**What to build:**

- Redis memory stays bounded however many progress updates jobs write, so a large ingredient round can no longer grow a queue's events stream to hundreds of megabytes.
- The job retention an administrator sets is the only retention in effect. The per-queue values that looked in force but never were are gone.

See `.scratch/architecture-after-upgrades/spec.md`, Background jobs, Retention.

**Blocked by:** 01 (with the lazy manager's private `Queue` gone, nothing resets the stream cap in a queue's metadata)

**Status:** ready-for-agent

- [ ] The shared queue options set `streams.events.maxLen` to about 1000.
- [ ] Each queue's events stream is trimmed to the cap once at boot.
- [ ] The per-queue `removeOnComplete`/`removeOnFail` defaults are deleted. The admin retention setting is applied to every queue as today.
- [ ] A real-Redis test writes more progress updates than the cap and finds the events stream at or under it. It connects through the production connection options and the shared Redis image constant from the sweep's ticket 34.
- [ ] A test proves a queue's effective retention equals the admin setting, CalDAV included.
- [ ] Record in this ticket the events stream lengths on the prod copy before and after a boot.
