# 33 — Warm set without query-core internals

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

`promote()` in `apps/web/lib/query-cache/warm-set.ts:247` lengthens the `gcTime` of a query that is already cached. It does this by calling query-core's `protected` `updateGcTime` and `scheduleGc`.

- Before this branch, it called them as `query.updateGcTime()`, and `noCheck` hid the type error.
- Ticket 25 surfaced the error, and the branch switched to bracket access (`query["updateGcTime"]`). That gets past the type error without fixing it.
- In the same file there are 15 `queryClient.fetchQuery(withWarmGcTime(...) as never)` casts. They predate the branch and are the same kind of escape.

**The fix:**

- Give the warm queries their lifetime through the public API, so nothing has to be re-armed afterwards.
- The candidate is `queryClient.setQueryDefaults(<key prefix>, { gcTime: CACHE_MAX_AGE_MS })` for the warm-set keys. With it, the page's own query is created with the warm lifetime and `promote()` goes away.
- Type `withWarmGcTime` so that `fetchQuery` accepts what it returns without `as never`. Since ca13f7e8 (ticket 08), tRPC and TanStack Query are on one line.

## Acceptance criteria

- [ ] `warm-set.ts` has no bracket access to query-core and no `as never`.
- [ ] A test shows that a recipe and a cookbook the reader opened stay cached past the default `gcTime`.

## Comments

- Filed 2026-10-13 from the branch review.
