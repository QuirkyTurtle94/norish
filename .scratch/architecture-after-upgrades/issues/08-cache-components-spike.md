# 08: Cache Components spike, adopted only on a measured win

**What to build:** The maintainer learns, with numbers, what Cache Components win for Norish before Next 17 makes them the default.

The spike turns them on with a text-free static shell and measures cold-load time to skeleton against ticket 06's after-number. They are adopted only if:

- the skeleton arrives measurably sooner, **and**
- first-paint fidelity holds: a page's first frame never paints a shape the reader's Device Preferences hid, skeletons included

Then a reader going back to a page finds their scroll position and inputs kept, and panels and dialogs closed. If either condition fails, Cache Components stay off and the numbers are recorded here. See `.scratch/architecture-after-upgrades/spec.md`, The Cache Components spike.

**Blocked by:** 06 (its after-measurement is the baseline, and the proxy's database read must not be counted as a Cache Components win)

**Status:** ready-for-agent

- [ ] Spike variant:
  - [ ] `cacheComponents` on.
  - [ ] The root layout's static part is the document and whatever skeleton needs no request data.
  - [ ] `lang` comes from the instance's default locale through a cached read, and is corrected in the browser for readers on another locale.
  - [ ] Text and anything shaped by Device Preferences render inside Suspense.
- [ ] Record here: cold-load time to skeleton (phone profile), baseline and variant, with the method. Record how much of the skeleton stayed static, given that today's skeletons are shaped by Device Preferences.
- [ ] **Decision.** Adopt only if the time improves measurably and the first-paint fidelity E2E stays green. Otherwise revert to off and stop here.
- [ ] If adopted:
  - [ ] The login and signup pages lose their removed segment configs.
  - [ ] The service worker route is hand-written with a cached helper, replacing the third-party route export that does not support Cache Components. Serwist still owns the worker (ADR-0006), and the offline E2E project passes.
  - [ ] Transient overlays (panels, dialogs, menus) close when their route is hidden by `<Activity>`.
  - [ ] Scroll resets that run on mount (the recipe page, the share page) run on navigation instead.
  - [ ] A browser E2E pass over back-navigation: scroll and inputs kept, overlays closed. The whole E2E suite passes.
- [ ] The locale does not move into the URL.
