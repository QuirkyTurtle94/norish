# 02 — Bug patterns, security hotspots and test smells

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

The 152 findings (99 files) outside the regex, deprecation, nesting and complexity groups are fixed, and their rules leave the temporary block.

Counts as measured on 2026-10-14:

- **Likely bugs:**
  - `no-alphabetical-sort` 16
  - `different-types-comparison` 10
  - `no-misleading-array-reverse` 4
  - `no-all-duplicated-branches` 3
  - `no-identical-functions` 3, among them the CalDAV card's auto-test, which copies its manual test
  - `no-redundant-assignments` 3
  - `no-dead-store` 2
  - `no-floating-point-equality` 2
  - `jsx-no-leaked-render` 1
  - `no-try-promise` 1
  - `no-invariant-returns` 1
  - `misplaced-loop-counter` 1
  - `no-undefined-argument` 1
- **Security hotspots** (review each one; disable a deliberate one with its reason):
  - `pseudo-random` 12
  - `no-clear-text-protocols` 5
  - `no-os-command-from-path` 1
  - `file-permissions` 1
- **Tests:**
  - `no-fixed-wait-in-tests` 11, all in the E2E suites. A fixed wait is a flake waiting to happen, so wait on the condition instead.
  - `assertions-in-tests` 2
  - `prefer-specific-assertions` 2
- **Code smells:**
  - `no-unused-vars` 22
  - `unused-import` 5
  - `use-type-alias` 6
  - `redundant-type-aliases` 6
  - `no-inverted-boolean-check` 6
  - `function-return-type` 5
  - `no-nested-assignment` 5
  - `void-use` 4
  - `todo-tag` 4
  - `no-redundant-jump` 1
  - `no-globals-shadowing` 1
  - `no-redundant-optional` 1
  - `no-small-switch` 1
  - `no-ignored-exceptions` 3

## Acceptance criteria

- [ ] None of these rules is in the temporary block, and `pnpm lint` passes.
- [ ] Every `eslint-disable` added says why in the same comment.
- [ ] A finding that was a real bug gets a test that fails without the fix.
- [ ] The E2E specs that lost a fixed wait pass with `--repeat-each=5`.

## Comments
