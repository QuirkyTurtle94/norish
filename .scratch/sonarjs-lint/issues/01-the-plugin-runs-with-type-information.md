# 01 — The plugin runs with type information

Status: ready-for-agent

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

`eslint-plugin-sonarjs` runs in every linted workspace with type information, and `pnpm lint` stays green while tickets 02 to 08 fix the findings.

- `@norish/eslint-config` depends on `eslint-plugin-sonarjs` (^4.2.2).
- `tooling/eslint/base.ts` applies `sonarjs.configs.recommended` and turns on `projectService` for the files it lints.
- Every file the gate lints parses with type information. The measured run found one that doesn't: `apps/web/app/sw.ts`, which `tsconfig.sw.json` covers rather than `tsconfig.json`.
- `sonarjs/prefer-read-only-props` is off, with a comment saying why.
- One block in `base.ts` turns off every rule that still has findings, each line naming the ticket that fixes it.

## Acceptance criteria

- [ ] `pnpm lint` passes with the plugin on.
- [ ] No parsing error in any workspace.
- [ ] Each rule in the temporary block has findings today and names its ticket. A rule with no findings is not in it.
- [ ] Lint time before and after is recorded here, for `apps/web` and for the whole `pnpm lint`.

## Comments
