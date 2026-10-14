# 02 — Bug patterns and security

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

The 46 findings (31 files) outside the regex and deprecation groups are fixed, and their rules leave the temporary block.

Counts as measured on 2026-10-14:

- **Likely bugs:**
  - `no-alphabetical-sort` 16: a sort without a comparator sorts numbers and accented names wrongly
  - `no-all-duplicated-branches` 3
  - `no-floating-point-equality` 2
  - `jsx-no-leaked-render` 1
  - `no-try-promise` 1
  - `no-invariant-returns` 1
  - `no-globals-shadowing` 1
- **Security** (now vulnerabilities in SonarQube, no longer review-only hotspots; fix it, or disable a deliberate one with its reason):
  - `pseudo-random` 12
  - `no-clear-text-protocols` 5
  - `no-os-command-from-path` 1
  - `file-permissions` 1
- **Tests:** `assertions-in-tests` 2, both in the E2E suites.

## Acceptance criteria

- [ ] None of these rules is in the temporary block, and `pnpm lint` passes.
- [ ] Every `eslint-disable` added says why in the same comment.
- [ ] A finding that was a real bug gets a test that fails without the fix.
- [ ] Every E2E spec that changed passes with `--repeat-each=5`.

## Comments
