# 13: The image ships only what runs

**What to build:**

- An operator downloads about 30% less per release: about 275 MB, against 388 MB in 0.25.
- Nothing in the image is there only for the build.
- The standalone output stays only if it earns its place.

See `.scratch/architecture-after-upgrades/spec.md`, Installs, the server build and the image.

**Blocked by:** 12. The cuts are measured against its isolated, tsdown-free image.

**Status:** ready-for-agent

- [ ] Where a package is in the image only because of a wrong declaration, the declaration is fixed and no `rm` line is needed:
  - [ ] apps/web's client-only libraries move to devDependencies, because Next bundles them into `.next`:
    - `@dnd-kit/*`, `@fontsource-variable/*`, `@heroicons/react`, `@heroui/react`, `@heroui/styles`, `@iconify/react`, `@internationalized/date`
    - `@norish/shared-react`, `@norish/ui`, `@tanstack/*`, `@trpc/client`, `@trpc/tanstack-react-query`
    - `embla-carousel(-react)`, `motion`, `next-themes`, `react-aria-components`, `react-markdown`, `tailwind-merge`, `use-sound`, `usehooks-ts`, `vaul`, `zustand`

    Check each against Next's `*.nft.json` traces first. Anything a trace lists, or `serverExternalPackages` names, stays a dependency, and so does anything `server/**` imports (ticket 12's lint rule).

  - [ ] `pino-pretty` stays a dependency (maintainer's call).
  - [ ] `ffmpeg-static` stays a dependency of packages/api, and its `rm` line stays. `src/video/yt-dlp.ts` falls back to it, so ticket 12's lint rule rejects it as a devDependency. Production uses the system ffmpeg.
- [ ] The deploy step removes what the server never loads. Each cut was verified on a repack of 12's image on 2026-10-14; sizes are compressed / unpacked:

  | Cut                                                                                                                                                                                                                                                                                                                               | Saves                                     |
  | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
  | `*.map` in `node_modules` (Next alone has 100 MB)                                                                                                                                                                                                                                                                                 | 31 / 138 MB                               |
  | `@next+swc-*` (only `next build` uses it)                                                                                                                                                                                                                                                                                         | 30 / 86 MB                                |
  | Store folders still unreachable after the declaration fixes: filled optional peers (drizzle-kit's esbuild 0.18 and 0.25 with their natives, its tsx, brocli; `@playwright/test` and `playwright`) and the archiver closure that is bundled into `.next`. `readdir-glob` is traced and stays, and so does the tsx the server runs. | 30 / 184 MB (the whole unreachable group) |
  | next's `dist/esm`, `dist/docs` and `*.runtime.dev.js`                                                                                                                                                                                                                                                                             | 5 / 23 MB                                 |
  | `*.d.ts`, `*.d.mts`, `*.d.cts`                                                                                                                                                                                                                                                                                                    | 4 / 33 MB                                 |
  | `*.md`                                                                                                                                                                                                                                                                                                                            | 2 / 9 MB                                  |
  | `dist`, `__tests__` and config files in the deployed `@norish` copies                                                                                                                                                                                                                                                             | 1 / 9 MB                                  |

- [ ] After `uv sync`, Python's unused parts go: `libpython3.15.so*` (nothing links it), tcl/tk, tkinter, idlelib, turtledemo, ensurepip, the base pip, `include` and `share`. Saves 16 / 47 MB. The parser starts and reports ok.
- [ ] The image holds one copy of the workspace code. `/app/packages/<pkg>` keeps `package.json` and a `src` link into the deployed copy. Saves 8 / 31 MB.
  - Data reads (`resolveExistingWorkspacePath`) still find the prompts, `retired-defaults.json`, `publish.lua`, `source-table.json`, the icon set and the migrations.
  - Migrations run on boot.
- [ ] The standalone trial (moved here from 07):
  - [ ] Build without `output: "standalone"`, and have the image copy the built output minus its cache. Keep it only if the image builds and boots and is smaller or faster to build. Otherwise revert to standalone.
  - [ ] Decide here whether production reads Next's config from `.next/required-server-files.json` instead of running `next.config.js` at boot. In `http-server.ts`, before `next()`: `process.env.__NEXT_PRIVATE_STANDALONE_CONFIG ??= JSON.stringify(JSON.parse(readFileSync(join(WEB_APP_DIR, ".next", "required-server-files.json"), "utf8")).config)`.
    - Gain: 23 / 34 MB (next-intl's plugin, serwist, glob and two `@swc/core` builds no longer ship), and the config loads in 2 ms instead of 260 ms.
    - Cost: a private variable, the one Next's own standalone server sets.
  - [ ] Record next trimmed to its trace as a further lead: 21.6 of next's 63.2 MB kept, compressed size not measured.
- [ ] The image builds on amd64 and arm64 and boots against Postgres and Redis: health 200, `/login` renders, `/serwist/sw.js` 200, and the log has no module errors. It is about 275 MB compressed or less; the verified repack was 274.9 MB / 1.07 GB, against 405.5 MB / 1.87 GB for 12's image. Record the before and after sizes and the build time here.
- [ ] The maintainer's pre-release test includes a URL import, a video import, an image upload including HEIC, and an AI job. The store-folder cut rests on static analysis and Next's traces, and the boot check reaches none of those paths.
- [ ] Release notes, under Fixes and Improvements: "The Docker image is about 30% smaller to download."

## Comments

- 2026-10-14. The breakdown of 12's image (405.5 MB compressed / 1.46 GB in layers):

  | Layer           | Compressed | Unpacked |
  | --------------- | ---------- | -------- |
  | node 26         | 64 MB      | 180 MB   |
  | apk ffmpeg      | 48 MB      | 109 MB   |
  | `node_modules`  | 183 MB     | 889 MB   |
  | `.uv/python`    | 32 MB      | 97 MB    |
  | yt-dlp          | 39 MB      | 40 MB    |
  | parser venv     | 11 MB      | 36 MB    |
  | `/app/packages` | 9 MB       | 45 MB    |
  | `.next`         | 12 MB      | 48 MB    |

- **Not pursued, with their numbers:**
  - **yt-dlp:** a 39 MB binary carrying its own Python. A venv on the shipped Python 3.15 could replace it, but a `curl_cffi` wheel for cp315 on musl is doubtful.
  - **Minimal ffmpeg:** most of its 48 / 109 MB is codecs Norish never uses (it uses libx264, aac, stream copy and ffprobe), but trimming means building ffmpeg ourselves.
  - **A hand-built base:** alpine plus the node binary saves 7 MB but gives up free base-image updates.
