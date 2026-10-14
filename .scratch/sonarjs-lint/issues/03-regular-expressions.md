# 03 — Regular expressions

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

The 89 regex findings (45 files) are fixed, and their rules leave the temporary block.

Counts as measured on 2026-10-14:

- `super-linear-regex` 39
- `prefer-regexp-exec` 38
- `regex-complexity` 7
- `duplicates-in-character-class` 2
- `concise-regex` 1
- `single-char-in-character-classes` 1
- `single-character-alternation` 1

The super-linear ones matter most where the input comes from outside: recipe pages, pasted text and imports. A rewritten pattern keeps matching exactly what the old one matched. Where a unit test doesn't cover it, add one before rewriting.

## Acceptance criteria

- [ ] None of these rules is in the temporary block, and `pnpm lint` passes.
- [ ] Every rewritten pattern is covered by a test that passed against the old pattern too.

## Comments
