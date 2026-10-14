# 53 — The health check pings Redis

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. From `.scratch/architecture-after-upgrades/spec.md`, Further Notes ("What lands first"), fix 3. Its other half, a BullMQ client that never gives up reconnecting, is in 34.

## What to build

`GET /health` (`health` in `packages/trpc/src/routers/config/procedures.ts`, through `getServiceHealth()`) checks the database and the parser, not Redis. With Redis down, jobs and realtime stop while the health check stays green.

1. Add a Redis `PING` to `getServiceHealth()`, with a short timeout, beside the database and parser checks.
2. A failed ping answers 503, as a failed database does.
3. Update the endpoint's OpenAPI description and 503 text, which name only the database and the parser. The docs' API reference is drawn from `openapi.json`.

## Acceptance criteria

- [x] `/health` answers 503 naming Redis when Redis is down, and 200 again once it is back.
- [x] The health tests (`packages/trpc/__tests__/openapi/health.test.ts`) cover a failed ping.
- [x] The OpenAPI description names Redis.

## Comments

- Filed 2026-10-14 from the architecture spec's list of fixes meant for this branch; no deps ticket tracked them.
- 2026-10-14 (implemented) — `getRedisHealth()` in `packages/shared-server/src/redis/client.ts` PINGs through the publisher and counts a ping unanswered after two seconds as down. `getServiceHealth()` runs it beside the database and parser checks, a failed one answers 503 "Redis is error", and a healthy body now carries `redis: { status: "ok" }`. The description, success text and 503 text name Redis, and `apps/docs/docs/reference/openapi.json` is refreshed through the `published-spec` snapshot.
  - `health.test.ts` covers a ping that rejects and one that never answers (fake timers, two seconds), plus the OpenAPI wording. "200 again once it is back" rests on the publisher reconnecting by itself (ticket 52's real-Redis test), not on a separate run.
