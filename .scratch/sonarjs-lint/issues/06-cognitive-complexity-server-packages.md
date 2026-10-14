# 06 — Cognitive complexity: the server packages

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

Every function in `packages/api`, `packages/db`, `packages/queue`, `packages/trpc` and `packages/auth` scores 15 or less on `sonarjs/cognitive-complexity`. That is 33 functions today.

The repository and parser functions carry most of it. A repository function splits into named query builders or row mappers; a parser into one function per step it already has.

The behaviour does not change. Where a function has no test, add one that pins its current output before splitting it.

Measured on 2026-10-14. Line numbers drift as earlier tickets land, so re-run lint for the current list.

| Function                                                       | Score |
| -------------------------------------------------------------- | ----: |
| `packages/db/src/repositories/recipes.ts:1623`                 |    61 |
| `packages/db/src/repositories/ingredient-seed.ts:146`          |    50 |
| `packages/db/src/repositories/library.ts:98`                   |    37 |
| `packages/db/src/repositories/recipe-enrichment.ts:336`        |    35 |
| `packages/api/src/parser/parsers/steps.ts:106`                 |    30 |
| `packages/db/src/repositories/steps.ts:94`                     |    30 |
| `packages/api/src/startup/migrate-gallery-images.ts:318`       |    29 |
| `packages/trpc/src/routers/groceries/groceries-helpers.ts:107` |    29 |
| `packages/api/src/parser/index.ts:231`                         |    25 |
| `packages/api/src/startup/media-cleanup.ts:98`                 |    25 |
| `packages/api/src/parser/parsers/images.ts:120`                |    24 |
| `packages/db/src/repositories/recipes.ts:536`                  |    24 |
| `packages/db/src/repositories/stores.ts:208`                   |    24 |
| `packages/db/src/repositories/planned-items.ts:276`            |    23 |
| `packages/queue/src/enrichment/coordinator.ts:175`             |    23 |
| `packages/auth/src/connection-tests.ts:148`                    |    22 |
| `packages/db/src/repositories/cookbooks.ts:169`                |    21 |
| `packages/api/src/caldav/event-listener.ts:161`                |    20 |
| `packages/trpc/src/routers/admin/job-queue.ts:175`             |    20 |
| `packages/auth/src/claim-processor.ts:103`                     |    19 |
| `packages/queue/src/store-lookup/lookup.ts:158`                |    19 |
| `packages/api/src/parser/jsonld.ts:35`                         |    18 |
| `packages/api/src/parser/store-page.ts:909`                    |    18 |
| `packages/api/src/startup/media-cleanup.ts:348`                |    18 |
| `packages/api/src/video/yt-dlp.ts:21`                          |    18 |
| `packages/queue/src/ingredient-review/progress.ts:180`         |    18 |
| `packages/queue/src/paste-import/parser.ts:119`                |    18 |
| `packages/trpc/src/idempotency-middleware.ts:112`              |    18 |
| `packages/api/src/startup/migrate-gallery-images.ts:150`       |    17 |
| `packages/api/src/video/yt-dlp.ts:126`                         |    17 |
| `packages/queue/src/paste-import/worker.ts:143`                |    17 |
| `packages/api/src/video/processors/instagram.ts:210`           |    16 |
| `packages/trpc/src/routers/groceries/groceries.ts:523`         |    16 |

## Acceptance criteria

- [ ] Lint with `sonarjs/cognitive-complexity` on reports nothing in these workspaces.
- [ ] Every split function was covered by a test before it was split.

## Comments
