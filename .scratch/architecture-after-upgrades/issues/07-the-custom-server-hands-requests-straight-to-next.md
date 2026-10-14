# 07: The custom server hands requests straight to Next

**What to build:**

- Norish starts on Node 26 without deprecation warnings.
- A reader who hits an unexpected error sees the error page in their language with a working "Try again". An error in the outermost layout shows a readable page instead of a blank screen.
- Contributors get Next's route types in CI, and page props typed by Next instead of by hand.
- The image is built from only what the server runs, if a trial shows that works and wins something.

See `.scratch/architecture-after-upgrades/spec.md`, The web server.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged.

**Status:** ready-for-agent

- [ ] The custom server passes each request to Next's handler without parsing its URL first, and the server log shows no DEP0169 on boot or on a request.
- [ ] The static file helper, its call and the `mime` dependency are deleted.
- [ ] The error page uses the `retry` callback, with copy from the message catalogue in every shipped language.
- [ ] A global error boundary renders its own document, with copy chosen by the browser's language and an English fallback.
- [ ] `next typegen` runs before type checking in CI and in the local typecheck script. Hand-written `params: Promise<…>` types use Next's generated page, layout and route-context prop types.
- [ ] The standalone trial:
  - [ ] Build without `output: "standalone"`, and have the image copy the built output minus its cache.
  - [ ] Keep it only if the image builds and boots against Postgres and Redis (health check, an upload including HEIC, a URL import through the parser, a video import) and is smaller or faster to build.
  - [ ] Otherwise revert to standalone.
  - [ ] Either way, record image size and build time, before and after, here.
- [ ] The E2E suite passes against a rebuilt `dist-server`.
