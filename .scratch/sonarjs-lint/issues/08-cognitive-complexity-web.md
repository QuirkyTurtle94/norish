# 08 — Cognitive complexity: the web app

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

Every function in `apps/web` scores 15 or less on `sonarjs/cognitive-complexity`. That is 23 functions today.

In a component the usual split is a child component, or a hook for the logic it computes before rendering. Splitting a component changes what the React Compiler memoises, so the new child must not re-render more than the old whole did.

The behaviour does not change. Where a function has no test, add one that pins its current output before splitting it.

Measured on 2026-10-14. Line numbers drift as earlier tickets land, so re-run lint for the current list.

| Function                                                                                 | Score |
| ---------------------------------------------------------------------------------------- | ----: |
| `apps/web/components/groceries/grocery-product-field.tsx:225`                            |    65 |
| `apps/web/app/(app)/settings/admin/components/jobs/job-detail-modal.tsx:265`             |    44 |
| `apps/web/components/ingredients/ingredient-panel.tsx:160`                               |    39 |
| `apps/web/app/(app)/settings/ingredients/components/suggestions-panel.tsx:274`           |    26 |
| `apps/web/app/(app)/recipes/[id]/components/actions-menu.tsx:91`                         |    25 |
| `apps/web/app/(app)/recipes/[id]/components/ingredients-options-menu.tsx:40`             |    24 |
| `apps/web/components/ingredients/ingredient-relocation.tsx:23`                           |    23 |
| `apps/web/app/(app)/settings/admin/components/video-processing-form.tsx:53`              |    22 |
| `apps/web/app/(app)/settings/ingredients/components/ingredient-row.tsx:28`               |    21 |
| `apps/web/components/dashboard/recipe-card.tsx:113`                                      |    21 |
| `apps/web/components/shared/swipable-row.tsx:295`                                        |    21 |
| `apps/web/app/(app)/recipes/edit/components/recipe-form.tsx:42`                          |    20 |
| `apps/web/components/cookbooks/cookbook-panels.tsx:110`                                  |    19 |
| `apps/web/components/recipes/readonly-ingredients-list.tsx:115`                          |    19 |
| `apps/web/app/(app)/settings/ingredients/components/ingredients-settings-content.tsx:55` |    18 |
| `apps/web/components/shared/smart-text-input.tsx:54`                                     |    18 |
| `apps/web/hooks/use-floating-dock.ts:48`                                                 |    18 |
| `apps/web/app/(app)/settings/admin/components/image-generation-form.tsx:46`              |    17 |
| `apps/web/components/Panel/consumers/recurrence-panel.tsx:32`                            |    17 |
| `apps/web/components/cookbooks/cookbook-card.tsx:57`                                     |    17 |
| `apps/web/app/(app)/settings/ingredients/components/suggestions-panel.tsx:207`           |    16 |
| `apps/web/components/cookbooks/cookbook-add-recipes-panel.tsx:34`                        |    16 |
| `apps/web/lib/recipe-media.ts:61`                                                        |    16 |

## Acceptance criteria

- [ ] Lint with `sonarjs/cognitive-complexity` on reports nothing in these workspaces.
- [ ] Every split function was covered by a test before it was split.
- [ ] Once 06 and 07 are done too, `sonarjs/cognitive-complexity` leaves the temporary block. If it is the last rule there, the block goes too.
- [ ] The full E2E suite passes against a fresh build.

## Comments
