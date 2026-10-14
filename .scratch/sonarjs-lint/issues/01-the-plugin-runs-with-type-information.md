# 01 — The plugin runs SonarQube's default profile with type information

Status: ready-for-agent

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

`eslint-plugin-sonarjs` runs Sonar way core plus `deprecation` in every linted workspace, with type information, and `pnpm lint` stays green while tickets 02 to 04 fix the findings.

- `@norish/eslint-config` depends on `eslint-plugin-sonarjs` (^4.2.2).
- One module in `tooling/eslint` holds the profile as rule lists:
  - 122 rules for every file;
  - 8 for JavaScript only;
  - 1 for TypeScript only.

  It says where the lists come from (the spec), and `base.ts` applies them. It does not use the plugin's `recommended` preset.

- `base.ts` turns on `projectService` for the files it lints. Every file the gate lints parses with type information. The measured run found one that doesn't: `apps/web/app/sw.ts`, which `tsconfig.sw.json` covers rather than `tsconfig.json`.
- One block turns off the 14 rules that still have findings, each line naming the ticket that fixes it.

## Acceptance criteria

- [ ] `pnpm lint` passes with the plugin on, and `@norish/eslint-config` typechecks.
- [ ] No parsing error in any workspace.
- [ ] With the temporary block lifted, lint reports the baseline: 14 rules, about 210 findings, nothing from a rule outside the profile.
- [ ] Each rule in the temporary block has findings today and names its ticket.
- [ ] Lint time before and after is recorded here, for `apps/web` and for the whole `pnpm lint`.

## Comments
