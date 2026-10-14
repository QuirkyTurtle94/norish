# 46 — Sweep leftovers

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

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

## Acceptance criteria

- [ ] Each item above is gone.
- [ ] `pnpm lint` and `pnpm build` pass.

## Comments

- Filed 2026-10-13 from the branch review.
