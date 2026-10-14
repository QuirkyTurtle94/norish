# 10: The React Compiler, app-wide

**What to build:**

- Screens re-render only when something on them changed, without anyone hand-placing memo hooks.
- Contributors get @eslint-react's versions of the compiler's lint rules, so code that breaks the compiler's assumptions is flagged when written.

See `.scratch/architecture-after-upgrades/spec.md`, React Compiler.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged.

**Status:** ready-for-agent

- [ ] Before turning it on, record here the render counts on two heavy screens (for example the groceries screen and the recipe page) with React's profiler.
- [ ] `reactCompiler` is on app-wide in infer mode. The experimental Rust compiler is not used.
- [ ] The compiler lint rules switched off today are switched back on, and what they flag is fixed. After the sweep's ticket 39 those are @eslint-react's `refs`, `immutability` and `set-state-in-effect`. `incompatible-library` and `preserve-manual-memoization` exist only in eslint-plugin-react-hooks, which the sweep removed and which stays removed (maintainer, 2026-10-14); go without them.
- [ ] Existing `useMemo`/`useCallback` stay, and the contributing guide says new code doesn't add them.
- [ ] Hook aliases keep a `use` prefix. A lint rule or a comment at each shared hook bag guards it.
- [ ] Record here the render counts on the same two screens, after.
- [ ] The full E2E suite passes against a rebuilt `dist-server`, with no new flake (`--repeat-each` on any spec that turns red once).
