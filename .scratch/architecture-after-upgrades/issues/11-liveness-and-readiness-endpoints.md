# 11: Liveness and readiness endpoints, with `/health` deprecated

**What to build:**

- An orchestrator restarts Norish only when a restart would help, never through a Postgres or Redis outage.
- A load balancer stops sending traffic while Postgres or Redis is down, and sends it again once they are back. A parser outage stops URL imports, not the whole app.
- An operator whose probes call `/api/v1/health` keeps a working probe and learns what replaces it.

See `.scratch/architecture-after-upgrades/spec.md`, Health checks.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged, so ready can reuse the sweep's ticket 53 Redis ping.

**Status:** ready-for-agent

- [ ] Two tRPC OpenAPI procedures sit beside `health` in `packages/trpc/src/routers/config/procedures.ts`, under the Health tag, with `protect: false`:
  - [ ] `GET /api/v1/health/live` answers 200 while the process responds and the parser answers its health check, and 503 when the parser doesn't. It checks no Postgres and no Redis. (Norish runs the parser itself, so a restart fixes a hung one.)
  - [ ] `GET /api/v1/health/ready` answers 503 when Postgres or Redis fails, and 200 otherwise. The parser's state is in the body and never fails the check.
- [ ] `GET /api/v1/health` keeps exactly the behaviour ticket 53 leaves it with, and is marked `deprecated: true`. Its OpenAPI description names the two endpoints that replace it.
- [ ] The image's `HEALTHCHECK` and `docker/docker-compose.example.yml` call live.
- [ ] `docker/docker-compose.test.yml` and the E2E harness (`apps/web/__tests__/e2e/harness/production-stack.ts`) call ready. Where the harness needs the parser, it checks the parser's own health.
- [ ] The health tests (`packages/trpc/__tests__/openapi/health.test.ts`) cover:
  - [ ] live fails on a parser that doesn't answer, and stays 200 with Postgres or Redis down
  - [ ] ready fails on Postgres or Redis, and stays 200 with the parser down
  - [ ] the deprecated `/health` answers as before
- [ ] `openapi.json` is regenerated, so the docs' API reference shows both endpoints and `/health` as deprecated.
- [ ] The image builds and boots: its healthcheck reports healthy, and stays healthy with Redis stopped.
- [ ] Release notes, under Upgrade notes: `/api/v1/health/live` is for restarts and `/api/v1/health/ready` is for traffic (Kubernetes readiness probes, load balancers), and the image's healthcheck now calls live. `/api/v1/health` still works but is deprecated and will be removed in a later release.
