# 03 — Regular expressions

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

The 39 `super-linear-regex` findings (25 files) are fixed, and the rule leaves the temporary block.

These patterns can backtrack for a long time on a crafted input. That matters most where the input comes from outside: recipe pages, pasted text and imports.

A rewritten pattern keeps matching exactly what the old one matched. Where no unit test covers it, add one before rewriting.

## Acceptance criteria

- [ ] `sonarjs/super-linear-regex` is not in the temporary block, and `pnpm lint` passes.
- [ ] Every rewritten pattern is covered by a test that passed against the old pattern too.

## Comments
