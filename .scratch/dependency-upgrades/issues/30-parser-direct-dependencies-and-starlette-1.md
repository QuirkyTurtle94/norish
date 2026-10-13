# 30 — The parser on Python 3.15, with every dependency at its latest

Status: ready-for-agent
Blocked by: None. Ticket 06 lands in the same commit.
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `apps/parser-api` to **Python 3.15** and every Python dependency to its latest, including **starlette 1.x**. That clears starlette's six advisories, which have no fix on the 0.x line, and meets ticket 06's floors.

**Python 3.15** (3.15.0 shipped 2026-10-09):

- The image installs Python with uv, not apk: `uv python install 3.14` and `uv sync --locked --python 3.14` (`docker/Dockerfile:87-99`), and the runtime stage copies `/app/.uv/python`. Change both to 3.15.
- **uv 0.13.0 or later is required**: it is the first release with CPython 3.15.0 final. Bump `ghcr.io/astral-sh/uv:0.12.5` (`docker/Dockerfile:23`) and `astral-sh/setup-uv` in CI if it pins a uv version.
- `pyproject.toml:9` `requires-python = ">=3.14,<3.15"` becomes `">=3.15,<3.16"`, and the lock follows.
- **Compiled dependencies need cp315 wheels**, because the image has no Rust and no libxml2-dev, so an sdist build fails. On 2026-10-13 the latest of each has musllinux x86_64 and aarch64 cp315 wheels: lxml 6.1.3, pydantic-core 2.50.1 (with pydantic 2.14.1), charset-normalizer 3.5.2. Make sure the lock resolves to wheel versions.
- recipe-scrapers 15.12.0 (`>=3.10`) and fastapi (`pydantic>=2.9.0`) don't cap it.

| Package                   | Today   | Target  |
| ------------------------- | ------- | ------- |
| `fastapi`                 | 0.136.1 | 0.143.x |
| `uvicorn`                 | 0.46.0  | 0.54.x  |
| `beautifulsoup4`          | 4.14.3  | 4.15.x  |
| `starlette` (via fastapi) | 0.47.3  | 1.8.x   |
| `recipe-scrapers`         | 15.12.0 | current |

- **Pick the FastAPI release to match.** FastAPI allows `starlette>=0.46.0` with no upper bound, so land on a FastAPI release that supports the starlette version you end up with.
- **starlette 0.x → 1.x is a major.** Read its 1.0 notes for anything FastAPI-facing.
- **The rest of the lock** moves to latest too (`uv lock --upgrade`): pydantic, requests, urllib3, anyio, idna, certifi and the others.

## Acceptance criteria

- [ ] **Lock.** `uv.lock` and the `pyproject.toml` bounds are updated for Python 3.15, starlette is on 1.x, and ticket 06's floors are met.
- [ ] **Wheels.** The Docker build installs every Python dependency from a wheel (no compiler step in the log).
- [ ] **Tests.** `uv run pytest` passes in apps/parser-api.
- [ ] **Imports.** A production Docker build imports a handful of real recipe URLs, including one through the extruct path, and the E2E URL-import tests pass.
- [ ] **Release notes.** A bullet under `## Fixes and Improvements` for the parser's dependency updates.

## Comments

- Filed 2026-10-12, split out of ticket 06 when the maintainer limited 0.25 to safe fixes.
- 2026-10-13 — Python 3.15 and uv 0.13 added (newest stable, maintainer decision). Joined with ticket 06.
