# 56 — The proxy matcher anchors its prefixes

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. From `.scratch/architecture-after-upgrades/spec.md`, Further Notes ("What lands first"), fix 6.

## What to build

The matcher in `apps/web/proxy.ts:56` skips the auth proxy for paths that start with any of its prefixes (`login`, `signup`, `trpc`, `icons`, `robots`, `auth-error` and others). A prefix has no boundary after it, so a future `/login-history` or `/icons-admin` would skip the proxy and be public.

1. End each prefix at a path boundary: a directory prefix matches only itself or what is under it, and a file matches exactly.
2. `/serwist/` must stay excluded; the service worker scripts fetch without credentials.

## Acceptance criteria

- [ ] A test proves `/login`, `/login/`, `/icons/x.png` and `/sw.js` skip the proxy, and `/login-history`, `/icons-admin` and `/sw.json` go through it.
- [ ] The offline E2E project passes, which shows the service worker still registers.

## Comments

- Filed 2026-10-14 from the architecture spec's list of fixes meant for this branch; no deps ticket tracked them.
