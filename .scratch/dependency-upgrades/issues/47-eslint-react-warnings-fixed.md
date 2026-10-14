# 47 — The @eslint-react warnings fixed

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 12. Found in the branch review on 2026-10-13.

## What to build

Ticket 12 says: "Fix what the new recommended sets report, or switch a rule off with the reason in a comment." Instead, the new sets were left reporting warnings. `pnpm lint` on 2026-10-13 shows 638 warnings, 157 of them from `@eslint-react`. The review put the 9.39.5 baseline at 478.

| Rule                                                                                                      | Count  | What fixing it means                                      |
| --------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| `naming-convention-ref-name`                                                                              | 57     | Refs end in `Ref`.                                        |
| `no-array-index-key`                                                                                      | 38     | Key by identity.                                          |
| `no-use-context`                                                                                          | 20     | React 19: `use(Context)`.                                 |
| `no-context-provider`                                                                                     | 18     | React 19: `<Context>` instead of `<Context.Provider>`.    |
| `use-state`                                                                                               | 11     | `[thing, setThing]` naming.                               |
| `dom-no-dangerously-set-innerhtml`                                                                        | 6      | Keep only where it's needed, with the reason at the line. |
| `no-unnecessary-use-prefix`                                                                               | 2      |                                                           |
| `no-forward-ref`                                                                                          | 1      | React 19: `ref` as a prop.                                |
| `no-clone-element`, `no-children-for-each`, `web-api-no-leaked-timeout`, `naming-convention-context-name` | 1 each |                                                           |

The React 19 rules (`no-use-context`, `no-context-provider`, `no-forward-ref`) are migrations to the current React API. Do them, don't switch them off.

## Acceptance criteria

- [ ] `pnpm lint` reports no `@eslint-react` warnings.
- [ ] Any rule switched off has its reason in a comment.
- [ ] The total warning count and its per-rule breakdown are recorded here.
- [ ] `pnpm test:run` and the E2E projects pass.

## Comments

- Filed 2026-10-13 from the branch review.
