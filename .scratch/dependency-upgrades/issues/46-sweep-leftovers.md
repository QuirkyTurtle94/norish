# 46 — Sweep leftovers

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13. Absorbs ticket 41.

## What to build

- **Per-image `unoptimized` props.** The global `images: { unoptimized: true }` (`apps/web/next.config.js:62`, ticket 26) already covers these 11 props, so delete them:
  - `step-images.tsx:48,79`
  - `image-gallery-input.tsx:110`
  - `media-gallery-input.tsx:145,171`
  - `readonly-steps-list.tsx:219`
  - `image-lightbox.tsx:187,230`
  - `import-from-image-modal.tsx:231`
  - `media-carousel.tsx:178,324`
- **`ollama-ai-provider-v2` in tsdown's `neverBundle`** (`apps/web/tsdown.config.ts:67`). No package depends on it any more.
- **`lint:fix` still passes `--concurrency=1`** in the root `package.json`. `lint` dropped it in 4803f879.
- **Stale comment** at `packages/auth/src/connection-tests.ts:208`. It says Perplexity is tested with "chat completions", but since ticket 05 it uses the Agent API.
- **Node types set for every workspace** (from 41). `tooling/typescript/base.json:8` sets `types: ["node"]`, so every workspace gets Node's globals whether it uses them or not.
  - Move the setting out of `base.json`. Each workspace that uses Node names it in its own tsconfig. Today these inherit it without saying so: `packages/{api,auth,db,queue,trpc}`, `apps/web/tsconfig.server.json`, and `tooling/{prettier,tailwind}` if they need it.
  - The Next apps keep Node's types anyway, through `next/types/global.d.ts`. The workspaces that actually lose them are `packages/ui` and `packages/i18n`, which use none.
- **Settings TypeScript 6 already applies** (from 41). `esModuleInterop: true` in `base.json:4` and `tsconfig.server.json:9`, and `strict: true`, are no-ops.

## Acceptance criteria

- [ ] Each item above is gone.
- [ ] `base.json` sets no `types`, and no tsconfig sets an option to its TypeScript 6 default.
- [ ] `tsc --showConfig` shows the same effective `strict` and `esModuleInterop` for each workspace as before.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm build` pass.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — Ticket 41 folded in, with its scope corrected: removing `types` from `base.json` changes almost nothing for the browser code, so it is a leftover, not a ticket of its own.
