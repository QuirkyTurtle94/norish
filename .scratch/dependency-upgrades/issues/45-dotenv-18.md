# 45 — dotenv 18

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 20. Found in the branch review on 2026-10-13.

## What to build

Ticket 20 held dotenv at 17.4.2 until 18 "has gone about two weeks without a patch". That is not one of the spec's reasons to hold a line, which are "no stable release" or "another package's peer range rejects it".

1. Take dotenv 18.0.x in `packages/config`.
2. Remove dotenv from the spec's held lines.
3. Ticket 20's open env-loading criterion belongs here: one test with a `.env` file, and one with the variables set in the process environment.

## Acceptance criteria

- [ ] `packages/config` is on dotenv 18.
- [ ] Both env-loading tests pass.
- [ ] dotenv is gone from the spec's held lines.

## Comments

- Filed 2026-10-13 from the branch review.
