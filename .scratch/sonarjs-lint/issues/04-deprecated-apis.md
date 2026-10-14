# 04 — Deprecated APIs

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

The 125 uses of deprecated APIs (54 files) move to their replacements, and `sonarjs/deprecation` leaves the temporary block.

The largest groups, as measured on 2026-10-14:

- Our own: the recipe's `image` field (33), deprecated in `packages/db-schema/src/schema/recipes.ts` because the primary image lives in `recipe_images`
- React Aria's `onSelectionChange` (14) and `selectedKey` (10)
- `UNSTABLE_portalContainer` (12)
- `KeyboardEvent.keyCode` (11)
- React's `FormEvent` (5)
- Zod 4's `z.string().url()` (5) and `z.number().finite()` (2)
- TanStack Query's `fetchQuery`/`fetchInfiniteQuery` signatures (about 15 calls)
- The AI SDK's `experimental_evaluate` and `Experimental_EvaluationModel` (5)
- `Buffer#slice` (2)
- `BeforeUnloadEvent.returnValue` (1)

Read each deprecation note in the installed package before replacing; the replacement is what it names. A deprecated API with no replacement yet in the installed version keeps a disable that says so.

## Acceptance criteria

- [ ] `sonarjs/deprecation` is not in the temporary block, and `pnpm lint` passes. Whichever of 02, 03 and 04 lands last deletes the block.
- [ ] Screens whose selection or portal props changed are checked in the browser, and the E2E specs that cover them pass.

## Comments
