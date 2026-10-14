# eslint-plugin-sonarjs, on everywhere

Status: ready-for-agent

Decided with the maintainer on 2026-10-14, on `chore/dependency-upgrades`, from a measured run of the plugin over every linted workspace.

## Problem Statement

Lint checks style, React's rules and unused code, but nothing looks for bug patterns. Measuring the plugin found real ones that review missed:

- A ternary that returns the same value on both branches (3).
- Assignments nothing reads (2).
- Two functions with identical bodies, one of them the CalDAV card's auto-test copying its manual test.
- Arrays sorted without a comparator (16).
- Comparisons between values that can never be equal (10).
- Regular expressions with super-linear backtracking (39).
- 125 uses of deprecated APIs.

## Decisions

- **The plugin:** `eslint-plugin-sonarjs` 4.2.2. It supports ESLint 10, and its `typescript >=5 <6.1.0` range covers our 6.0.3.
- **One place:** its `recommended` preset goes in `tooling/eslint/base.ts`, so every linted workspace gets it. The preset turns on 230 rules, all errors.
- **Type information on:** `projectService: true`, so the 71 typed rules run, `deprecation` among them. Measured cost: `apps/web` lint goes from about 3 s to about 21 s.
- **`prefer-read-only-props` stays off.** It is 340 `Readonly<Props>` edits in `apps/web` alone, and pure style.
- **Every other rule stays at Sonar's defaults and every finding gets fixed.** That includes `cognitive-complexity` at 15 and `no-nested-conditional`.
  - No rule is turned off for convenience.
  - A finding that is deliberate gets a one-line `eslint-disable-next-line` with the reason. `Math.random()` for retry jitter is one example; `http://localhost` in a dev default is another.
- **While the work runs, `pnpm lint` stays green.** Rules with findings left are switched off in one block in `base.ts`, each line naming the ticket that fixes it. Each ticket deletes its lines, and the last one deletes the block.
- **Out of scope:** `apps/mobile`, `apps/docs` and `apps/quick-import-extension`, which no lint gate reaches.
- **No ADR, no release notes:** the change is cheap to reverse, and users don't see it.

## Baseline

Measured on 2026-10-14 with type information on and `prefer-read-only-props` off: **623 findings in 46 rules.**

| Group                                        | Findings | Files | Ticket     |
| -------------------------------------------- | -------: | ----: | ---------- |
| Bug patterns, security hotspots, test smells |      152 |    99 | 02         |
| Regular expressions                          |       89 |    45 | 03         |
| Deprecated APIs                              |      125 |    54 | 04         |
| Nesting                                      |      174 |   112 | 05         |
| Cognitive complexity                         |       83 |    71 | 06, 07, 08 |

By workspace: `apps/web` 297, `packages/shared-server` 69, `packages/shared` 65, `packages/api` 54, `packages/db` 38, `packages/shared-react` 37, `packages/trpc` 17, `packages/queue` 13, `packages/auth` 10, `tooling/nutrition` 9, `packages/config` 5, `tooling/ingredient-icons` 4, `apps/landing` 3, `packages/i18n` 1, `packages/ui` 1.

## Tickets

1. `issues/01-the-plugin-runs-with-type-information.md`
2. `issues/02-bug-patterns-hotspots-and-test-smells.md`
3. `issues/03-regular-expressions.md`
4. `issues/04-deprecated-apis.md`
5. `issues/05-nesting.md`
6. `issues/06-cognitive-complexity-server-packages.md`
7. `issues/07-cognitive-complexity-shared-packages.md`
8. `issues/08-cognitive-complexity-web.md`
