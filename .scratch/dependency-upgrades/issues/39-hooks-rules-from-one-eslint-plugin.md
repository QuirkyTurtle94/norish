# 39 — Hooks rules from one ESLint plugin

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md` decision 10, ticket 12. Found in the branch review on 2026-10-13.

## What to build

`tooling/eslint/react.ts:40` switches off five `@eslint-react` rules, because eslint-plugin-react-hooks "owns the hooks rules".

@eslint-react 5.26 is built to replace eslint-plugin-react-hooks, not to sit beside it:

- It carries its own version of every react-hooks rule: `rules-of-hooks`, `exhaustive-deps`, `refs`, `immutability`, `purity`, `set-state-in-effect`, `set-state-in-render`, `globals`, `static-components`, `use-memo`, `error-boundaries` and `unsupported-syntax`.
- It ships a `disable-conflict-eslint-plugin-react-hooks` preset for projects that still have both plugins.

Today two plugins check the same things, and one set is switched off by hand.

**The fix:**

1. Drop eslint-plugin-react-hooks.
2. Carry its deliberate choices over to the @eslint-react rule names: `exhaustive-deps` as a warning; `refs`, `set-state-in-effect` and `immutability` off.
3. `incompatible-library` and `preserve-manual-memoization` are React Compiler rules with no @eslint-react counterpart. They are off today, so nothing is lost.

## Acceptance criteria

- [ ] `tooling/eslint` no longer depends on eslint-plugin-react-hooks, and no rule is switched off for being a duplicate.
- [ ] `pnpm lint` reports no new errors, and the warning count does not grow.

## Comments

- Filed 2026-10-13 from the branch review.
