# 07: The custom server hands requests straight to Next

**What to build:**

- Norish starts on Node 26 without deprecation warnings.
- A reader who hits an unexpected error sees the error page in their language with a working "Try again". An error in the outermost layout shows a readable page instead of a blank screen.
- Contributors get Next's route types in CI, and page props typed by Next instead of by hand.

See `.scratch/architecture-after-upgrades/spec.md`, The web server.

**Blocked by:** 12, which replaces the bundle with the source run through tsx. The standalone trial moved to 13 with the rest of the image work.

**Status:** ready-for-agent

- [ ] The custom server passes each request to Next's handler without parsing its URL first, and the server log shows no DEP0169 on boot or on a request.
- [ ] The static file helper, its call and the `mime` dependency are deleted.
- [ ] The error page uses the `retry` callback, with copy from the message catalogue in every shipped language.
- [ ] A global error boundary renders its own document, with copy chosen by the browser's language and an English fallback.
- [ ] `next typegen` runs before type checking in CI and in the local typecheck script. Hand-written `params: Promise<…>` types use Next's generated page, layout and route-context prop types.
- [ ] The E2E suite passes against a fresh `pnpm build`.
