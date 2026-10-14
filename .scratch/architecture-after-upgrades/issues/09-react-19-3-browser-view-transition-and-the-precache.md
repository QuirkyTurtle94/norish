# 09: React 19.3 `browser()`, a recipe ViewTransition, and the precache measured

**What to build:**

- The theme and language switches render without a flicker, on React 19.3's `browser()` instead of a hand-rolled mounted flag.
- Opening a recipe from its card carries the card's image into the recipe's hero, and readers who prefer reduced motion get no transition.
- The maintainer learns what the service worker precache, downloaded again by every installed app each release, is made of.

See `.scratch/architecture-after-upgrades/spec.md`, React 19.3.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged.

**Status:** ready-for-agent

- [ ] Every mounted-flag pattern (found by search, including the theme switch and the language switch) uses `use(browser())` instead.
- [ ] One `<ViewTransition>` shared element runs from the recipe card's image to the recipe page's hero:
  - [ ] It is skipped under reduced motion.
  - [ ] There are no route cross-fades, and Motion keeps every in-page animation.
- [ ] A browser E2E opens a recipe from its card with reduced motion on and off, and the recipe page arrives intact both ways.
- [ ] `next analyze` runs once against the precache. Record here the largest contributors and anything that looks avoidable. Acting on it is a separate decision.
