# 37 — A stored Sonar model is migrated once

Status: ready-for-agent
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, tickets 05 and 29. Found in the branch review on 2026-10-13.

## What to build

`RETIRED_SONAR_MODELS` in `packages/shared-server/src/ai/runtime/providers.ts:75` maps the retired Sonar ids to Agent API presets on every call. This causes two problems:

- The stored setting keeps the old id forever.
- The admin model list (`packages/shared-server/src/ai/providers/listing.ts`) no longer offers Sonar, so the form shows `sonar` while `fast` is the model that actually runs.

**The fix:**

1. Add a one-time startup step beside the other backfills in `packages/api/src/startup/`. It rewrites a stored Sonar id to its preset.
2. The AI config is stored encrypted, so the step goes through the config repository, not raw SQL.
3. Delete `RETIRED_SONAR_MODELS` and `perplexityModelId`.

## Acceptance criteria

- [ ] After a boot, a config stored with `sonar-pro` reads `low`. A second boot changes nothing.
- [ ] `providers.ts` names no Sonar model.
- [ ] The 0.26.0-beta release notes say that a stored Sonar model is moved to its preset on upgrade.

## Comments

- Filed 2026-10-13 from the branch review.
