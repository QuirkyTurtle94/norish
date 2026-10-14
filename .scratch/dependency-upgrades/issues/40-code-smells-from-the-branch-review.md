# 40 — Code smells from the branch review

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13. Line numbers are from that day.

## What to build

- **Chip as a button, repeated.** `<Chip<"button"> render={(props) => <button {...props} />}>` appears 12 times in 8 files. Make one shared `ChipButton` and use it everywhere. The files are:
  - `caldav-sync-status-card.tsx:101,113,125,137`
  - `filters-panel.tsx:397,439`
  - `timer-chip.tsx:58,85`
  - `job-queue-card.tsx:147`
  - `recipe-form.tsx:609`
  - `library-type-chips.tsx:50`
  - `search-field-toggles.tsx:43`
- **Actor fields spelled out by hand.** `packages/trpc/src/routers/ingredients/index.ts:228-238` builds `userId`, `householdUserIds` and `isServerAdmin` itself. Use `actorOf(ctx)` as line 113 does, and align the repository's parameter type with it.
- **Index-access fixes done two ways.** Most `noUncheckedIndexedAccess` fixes guard (`if (!current) return`). These assert with `!` instead and should guard like the rest:
  - `step-input.tsx:118-119`
  - `ingredient-input.tsx:68`
  - `media-carousel.tsx:233,291`
  - `tag-input.tsx:254`
- **A wrapper that only gets past a prop type.** `ShareInstruction` (`share-recipe-steps.tsx:11-18`) re-reads `token` from context only because of the `InstructionComponent` prop type. Fix the prop type (`SmartInstructionLike`) so it takes the token, and delete the wrapper.
- **A missing version is hidden.** `hooks/config/use-version-query.ts:8` falls back to `?? "0.0.0"`, so a missing `NEXT_PUBLIC_APP_VERSION` passes unnoticed. Read the version where the build guarantees it, without a fallback.
- **A cast on mutation variables.** `apps/web/context/device-preferences-context.tsx:97` reads `mutation.state.variables as {…}`. Type the mutation so its variables carry that type, for example through `useMutationState`'s `select` with the mutation's own variable type.

## Acceptance criteria

- [ ] Each item above is gone.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test:run` pass.

## Comments

- Filed 2026-10-13 from the branch review. The maintainer wants all of them fixed.
