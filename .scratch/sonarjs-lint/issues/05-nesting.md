# 05 — Nesting

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

The 174 nesting findings (112 files) are fixed, and their rules leave the temporary block.

Counts as measured on 2026-10-14:

- `no-nested-conditional` 123, mostly ternaries in JSX
- `no-nested-template-literals` 23
- `no-nested-functions` 28

A nested ternary in JSX becomes a small component, a variable computed before the `return`, or a lookup. Pick whichever reads most plainly at the site. The rendered output does not change.

## Acceptance criteria

- [ ] None of these rules is in the temporary block, and `pnpm lint` passes.
- [ ] The full E2E suite passes against a fresh build.

## Comments
