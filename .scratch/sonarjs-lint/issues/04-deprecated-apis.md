# 04 — Deprecated APIs

Status: resolved
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

- [x] `sonarjs/deprecation` is not in the temporary block, and `pnpm lint` passes. Whichever of 02, 03 and 04 lands last deletes the block.
- [x] Screens whose selection or portal props changed are checked in the browser, and the E2E specs that cover them pass.

## Comments

- 2026-10-14 (implemented; browser checks and E2E still open).
  - Moved to the named replacement:
    - React Aria `selectedKey`/`onSelectionChange` → `value`/`onChange` on every Select and ComboBox but one (below). Same events in React Stately, except that `onChange` stays quiet when the row already selected is picked again.
    - TanStack `fetchQuery`/`prefetchQuery` → `query`, `fetchInfiniteQuery` → `infiniteQuery`. `useRecipePrefetch`'s retry was dead (`prefetchQuery` never rejects), so it went rather than come alive.
    - AI SDK `experimental_evaluate` → `experimental_decide`, `Experimental_EvaluationModel` → `Experimental_DecisionModel`, TypeSafe's `evaluationModel` → `decisionModel` (the same model underneath).
    - Zod `z.string().url()` → `z.url()` (same results and JSON schema, checked); `.finite()` dropped, a no-op in Zod 4.
    - `keyCode` → `key` in the time fields, with a test written against the old handler first; React's `FormEvent` → `SubmitEvent`; `Buffer#slice` → `subarray`; `returnValue` dropped, `preventDefault()` already asks.
  - The recipe `image` field:
    - The dashboard and archive schemas now declare their own `image`, the resolved primary image and the hero, so reading them no longer counts as reading the column.
    - Readers go through `primaryRecipeImage`: the optimistic dashboard card (a real bug: a gallery-only recipe's card showed no picture until the list refetched; test added), the recipe form's media (its copy of `buildInitialMedia` deleted), and the enrichment coordinator's `hasAnyImage`.
    - The Instagram processor no longer sets the scalar beside the gallery image it already writes.
  - Disables, each a deliberate reader:
    - `UNSTABLE_portalContainer` (12): `UNSAFE_PortalProvider` lives in `react-aria`, which `apps/web` does not depend on, and React Aria Components only hears the provider from its own copy. `usePanelPortalContainer`'s note says so.
    - `onSelectionChange` in `grocery-product-field`: tapping the auto-picked row makes it the shopper's own, and `onChange` does not fire for that tap.
    - The legacy `image` scalar: `primaryRecipeImage` (the one fallback reader), the repository's payload alias (3) and one `legacyImageColumn` alias for its cleanup, migration and Dish Colour queries, the generated-image write that clears the scalar, the Dish Colour's "does this update touch media" check, the share view, the archive media rehome, and the optimistic full recipe.
    - `autoTaggingMode`/`autoTagAllergies` (2): the config migration that replaces them.
  - The temporary block in `tooling/eslint/base.ts` is gone with this ticket, the last of the three: `pnpm lint` passes with the whole profile on.
- 2026-10-14 (browser checks and review).
  - The full browser suite passes (181), covering the grocery, ingredient, provenance, calendar, icon, nutrition and share-panel pickers.
  - Checked by hand on a production build: General's default language, the four permission selects (each saved through `onChange` and put back), the AI, vision and image model comboboxes, and the job-queue filter all take a pick; the recipe time fields stop letters and keep copy, select-all and paste.
  - Review fix: the time fields read the clipboard shortcuts by `key` only, so on a Cyrillic layout (`key` "м" for V) copy and paste were stopped. They now also accept the physical key (`code`), with a test for it.
  - Left for the maintainer: `UNSAFE_PortalProvider` needs `react-aria` as a direct dependency of `apps/web`, kept at React Aria Components' exact version, before the 12 portal disables can go; and dropping `returnValue` loses the leave prompt on Chrome 111 to 118.
