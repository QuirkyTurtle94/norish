# 52 — The Redis publisher is created once

Status: ready-for-agent
Blocked by: 34
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. From `.scratch/architecture-after-upgrades/spec.md`, Further Notes ("What lands first"), fix 2.

## What to build

`getPublisherClient` in `packages/shared-server/src/redis/client.ts` returns the existing publisher only while its status is `ready`. During an outage the status is `reconnecting`, so every call connects a new publisher and drops the old one without closing it. Each one keeps reconnecting on its own, so connections pile up for as long as Redis is down, and shutdown closes only the last one.

1. Create the publisher once. A caller gets the same client while it reconnects.
2. Give the publisher `maxRetriesPerRequest: 1`, so a command sent during an outage fails fast instead of waiting forever on a client that is no longer replaced.

## Acceptance criteria

- [ ] While Redis is down, repeated `getPublisherClient()` calls return the same client.
- [ ] A real-Redis test stops the container, calls the publisher several times, starts it again, and counts one publisher connection in `CLIENT LIST`.
- [ ] A command sent while Redis is down rejects instead of hanging.

## Comments

- Filed 2026-10-14 from the architecture spec's list of fixes meant for this branch; no deps ticket tracked them.
