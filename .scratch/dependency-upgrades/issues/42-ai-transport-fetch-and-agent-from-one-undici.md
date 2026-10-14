# 42 — The AI transport takes fetch and Agent from one undici

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md` decision 4, ticket 15. Found in the branch review on 2026-10-13.

## What to build

`packages/shared-server/src/ai/runtime/transport.ts` calls the global fetch with an undici 8 `Agent` as its dispatcher.

**Why that is a problem:**

- The global fetch is the undici that Node bundles. It only accepts the `Agent` while our undici is the same major.
- So everything is tied to Node's version:
  - `engineStrict: true`, with its comment, in `pnpm-workspace.yaml`
  - the "move the pin when Node bundles a new undici major" note in `transport.ts`
  - ticket 15's claim that Vitest 5 and tsdown 0.23 need Node 26. They don't: vitest 5.0.4 and tsdown 0.23.1 both accept Node 22 and 24.
- The stated reason for using the global fetch is that tests or deployments which patch `globalThis.fetch` still see these calls.

**The fix:**

1. Use `import { Agent, fetch } from "undici"`, so the dispatcher and fetch always come from the same package.
2. Find anything that relies on patching `globalThis.fetch` for AI calls, and give it a proper seam instead. The review found that only the provider-listing tests stub it, and they don't go through the transport.
3. Drop `engineStrict` and both comments. Nothing moves off Node 26: `engines`, `.nvmrc` and the image stay on it, because decision 4 chose it on its own merits. This only stops the next undici or Node major from having to move together.
4. Update spec decision 4, which still says undici 8 and Node 26 move together.

Land this before `.scratch/architecture-after-upgrades/` ticket 03, which passes an abort signal through the same transport.

## Acceptance criteria

- [ ] `transport.ts` imports `fetch` and `Agent` from undici.
- [ ] No comment, setting or spec decision ties undici's major to Node's.
- [ ] The `ai` E2E project passes.

## Comments

- Filed 2026-10-13 from the branch review.
