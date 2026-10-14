# 07 — Cognitive complexity: the shared packages

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

Every function in `packages/shared`, `packages/shared-server`, `packages/shared-react` and `tooling/nutrition` scores 15 or less on `sonarjs/cognitive-complexity`. That is 27 functions today.

The recurrence parser (66) and the spelling keys (44) are the hard ones. Both have unit tests; split along the cases those tests already name.

The behaviour does not change. Where a function has no test, add one that pins its current output before splitting it.

Measured on 2026-10-14. Line numbers drift as earlier tickets land, so re-run lint for the current list.

| Function                                                                      | Score |
| ----------------------------------------------------------------------------- | ----: |
| `packages/shared/src/lib/recurrence/parser.ts:71`                             |    66 |
| `packages/shared/src/lib/spelling-keys.ts:223`                                |    44 |
| `packages/shared/src/lib/timer-parser.ts:39`                                  |    35 |
| `packages/shared-server/src/archive/mealie-parser.ts:478`                     |    30 |
| `packages/shared-server/src/ingredients/resolver.ts:193`                      |    30 |
| `packages/shared-server/src/ai/runtime/providers.ts:98`                       |    29 |
| `packages/shared-server/src/ai/enrichment/provenance-inferrer.ts:305`         |    28 |
| `packages/shared-server/src/ai/enrichment/provenance-inferrer.ts:371`         |    28 |
| `packages/shared/src/lib/recurrence/calculator.ts:25`                         |    28 |
| `packages/shared/src/lib/line-cost.ts:81`                                     |    27 |
| `packages/shared/src/lib/recipe-nutrition.ts:348`                             |    27 |
| `packages/shared-server/src/ingredients/nutrition/ingredient-nutrition.ts:98` |    25 |
| `packages/shared-server/src/archive/parser.ts:450`                            |    24 |
| `packages/shared/src/lib/unit-localization.ts:163`                            |    24 |
| `packages/shared/src/lib/spelling-keys.ts:128`                                |    23 |
| `packages/shared-react/src/hooks/calendar/use-calendar-mutations.ts:103`      |    21 |
| `packages/shared-server/src/archive/mealie-parser.ts:346`                     |    21 |
| `tooling/nutrition/src/read/csv.ts:6`                                         |    21 |
| `packages/shared-server/src/ingredients/resolver.ts:381`                      |    20 |
| `packages/shared-server/src/ingredients/seed/catalogue-seed.ts:107`           |    20 |
| `packages/shared-server/src/ai/runtime/providers.ts:326`                      |    19 |
| `packages/shared-server/src/archive/norish-parser.ts:273`                     |    18 |
| `packages/shared/src/lib/recipe-nutrition.ts:298`                             |    18 |
| `packages/shared-server/src/ai/runtime/runtime.ts:922`                        |    17 |
| `packages/shared/src/lib/cuisine-resolver.ts:125`                             |    17 |
| `packages/shared/src/lib/grocery-grouping.ts:98`                              |    17 |
| `packages/shared-server/src/archive/parser.ts:203`                            |    16 |

## Acceptance criteria

- [ ] Lint with `sonarjs/cognitive-complexity` on reports nothing in these workspaces.
- [ ] Every split function was covered by a test before it was split.

## Comments
