# syntax=docker/dockerfile:1.26

##############################
# Base image (minimal, no pnpm needed at runtime)
##############################
FROM node:26.11.1-alpine3.24 AS base

# Security: upgrade all packages to latest versions to fix CVEs
RUN apk upgrade --no-cache && \
  apk add --no-cache ca-certificates libc6-compat

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

##############################
# Builder base with pnpm (only for build stages)
##############################
FROM base AS builder-base

RUN npm install -g pnpm@12.11.2

# The store lives on a cache mount, so pnpm cannot hard link from it into /app.
# Named explicitly, pnpm copies from it instead of starting a second store
# inside node_modules.
ENV PNPM_CONFIG_STORE_DIR=/root/.local/share/pnpm/store

COPY --from=ghcr.io/astral-sh/uv:0.13.0 /uv /uvx /bin/

ENV UV_LINK_MODE=copy \
  UV_PYTHON_DOWNLOADS=0 \
  UV_PYTHON_INSTALL_DIR=/app/.uv/python

##############################
# All Dependencies (for build)
##############################
FROM builder-base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/landing/package.json ./apps/landing/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/parser-api/package.json ./apps/parser-api/package.json
COPY apps/parser-api/pyproject.toml ./apps/parser-api/pyproject.toml
COPY apps/parser-api/uv.lock ./apps/parser-api/uv.lock

# packages/*
COPY packages/api/package.json ./packages/api/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/db-schema/package.json ./packages/db-schema/package.json
COPY packages/i18n/package.json ./packages/i18n/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/shared-react/package.json ./packages/shared-react/package.json
COPY packages/shared-server/package.json ./packages/shared-server/package.json
COPY packages/trpc/package.json ./packages/trpc/package.json
COPY packages/ui/package.json ./packages/ui/package.json

# tooling/*
COPY tooling/eslint/package.json ./tooling/eslint/package.json
COPY tooling/ingredient-icons/package.json ./tooling/ingredient-icons/package.json
COPY tooling/nutrition/package.json ./tooling/nutrition/package.json
COPY tooling/prettier/package.json ./tooling/prettier/package.json
COPY tooling/tailwind/package.json ./tooling/tailwind/package.json
COPY tooling/tailwind/heroui-theme.css ./tooling/tailwind/heroui-theme.css
COPY tooling/tailwind/heroui-theme.js ./tooling/tailwind/heroui-theme.js
COPY tooling/tailwind/postcss-config.js ./tooling/tailwind/postcss-config.js
COPY tooling/typescript/package.json ./tooling/typescript/package.json

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  SKIP_PARSER_API_INSTALL=1 pnpm install --frozen-lockfile

##############################
# Build stage
##############################
FROM builder-base AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN --mount=type=cache,target=/root/.local/share/uv/python \
  UV_PYTHON_DOWNLOADS=1 uv python install 3.15

# Only the root node_modules comes over from the deps stage, and the repo copy
# leaves out every other node_modules: this install recreates the nested ones
# under packages/* and apps/* from the store.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts --child-concurrency=1

RUN --mount=type=cache,target=/root/.cache/uv \
  --mount=type=cache,target=/root/.local/share/uv/python \
  UV_PYTHON_DOWNLOADS=0 uv sync --project /app/apps/parser-api --locked --python 3.15

# NODE_ENV matches what CI exports around the same `pnpm run build` (and turbo
# passes it through to every package build), so the image build can never
# silently diverge from the build the gates tested. `next build` forces
# production internally either way; this pins the rest of the task graph.
ENV NODE_ENV=production \
  DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
  SKIP_ENV_VALIDATION=1

RUN pnpm run build && \
  rm -rf apps/web/.next/cache apps/web/.next/trace \
  apps/web/.next/dev apps/web/.next/diagnostics apps/web/.next/types && \
  rm -rf apps/web/.next/standalone/node_modules/typescript \
  apps/web/.next/standalone/node_modules/ffmpeg-static

# Create the production deployment with pnpm deploy, isolated like every
# other install: node_modules/.pnpm is the store, and every package, the
# @norish/* workspace copies included, loads its own dependencies from it. It
# installs the versions pnpm-lock.yaml records.
RUN pnpm deploy --filter @norish/web --prod /app/deploy && \
  cd /app/deploy/node_modules/.pnpm && \
  # Build-time packages that reach the production closure through peers:
  # TypeScript as tRPC's peer, drizzle-kit as better-auth's optional peer, and
  # Babel, type declarations and Tailwind with them. The server runs through
  # tsx and esbuild, so those two stay. ffmpeg-static is superseded by the
  # system ffmpeg (apk add ffmpeg below).
  rm -rf typescript@* drizzle-kit@* @babel+* @types+* tailwindcss@* @tailwindcss+* \
  ffmpeg-static@*

# Strip test files and dev configs from packages/ before they get copied to runtime.
# This avoids shipping test fixtures, vitest configs, and TS build configs.
RUN rm -rf /app/packages/*/node_modules; \
  find /app/packages -type d -name '__tests__' -exec rm -rf {} + 2>/dev/null; \
  find /app/packages -type f \( \
  -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \
  -o -name 'vitest.config.*' -o -name 'tsconfig*.json' -o -name 'eslint.config.*' \
  \) -delete 2>/dev/null; \
  true

##############################
# yt-dlp download (cached separately from app build)
##############################
FROM base AS ytdlp

# Keep in step with DEFAULT_YT_DLP_VERSION in packages/config/src/zod/server-config.ts:
# this is the binary the image actually ships, and that constant is the version
# the server reports for it.
ARG YT_DLP_VERSION=2026.08.19
ARG TARGETARCH

RUN apk add --no-cache curl

RUN if [ "$TARGETARCH" = "arm64" ]; then \
  YT_DLP_BINARY="yt-dlp_musllinux_aarch64"; \
  else \
  YT_DLP_BINARY="yt-dlp_musllinux"; \
  fi && \
  mkdir -p /ytdlp && \
  curl --fail --silent --show-error \
  --location \
  --retry 5 \
  --retry-all-errors \
  --retry-delay 3 \
  "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/${YT_DLP_BINARY}" \
  --output /ytdlp/yt-dlp && \
  chmod +x /ytdlp/yt-dlp

##############################
# Runtime stage (minimal, no pnpm)
##############################
FROM base AS runtime

LABEL org.opencontainers.image.source="https://github.com/norish-recipes/norish"

# Install runtime-only system deps (base already ran apk upgrade)
RUN apk add --no-cache ffmpeg su-exec && \
  # Clean up npm (not needed, we use node directly)
  rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack && \
  rm -rf /var/cache/apk/* /tmp/* /root/.npm

WORKDIR /app

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  SKIP_ENV_VALIDATION=0 \
  PORT=3000 \
  HOST="0.0.0.0"

ARG NORISH_VERSION_REPORT_JSON

RUN test -n "${NORISH_VERSION_REPORT_JSON}"

ENV NORISH_VERSION_REPORT_JSON=${NORISH_VERSION_REPORT_JSON}

# Use non-root user for runtime.
# The node image already has user 'node' with UID/GID 1000.
# For custom UID/GID, create a new user; otherwise reuse 'node'.
ARG UID=1000
ARG GID=1000

RUN if [ "${UID}" != "1000" ] || [ "${GID}" != "1000" ]; then \
  addgroup -g ${GID} -S norishapp 2>/dev/null; \
  adduser -u ${UID} -S norish -G $(getent group ${GID} | cut -d: -f1) 2>/dev/null; \
  fi

# --- Minimal Next.js runtime files for the custom server ---
# The custom server runs from source, so only the built `.next` output and the
# small config files Next reads at startup come over.
COPY --from=build --chown=${UID}:${GID} /app/apps/web/.next/standalone/apps/web/.next/ ./apps/web/.next/
COPY --from=build --chown=${UID}:${GID} /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=build --chown=${UID}:${GID} /app/apps/web/config/next-intl-request-config-path.js ./apps/web/config/next-intl-request-config-path.js

# --- Production node_modules from pnpm deploy (complete runtime deps) ---
# It stays at /app/node_modules: Next's links in .next/node_modules (pg, pino,
# sharp) point at ../../../../node_modules/.pnpm/…, which resolves only from here.
COPY --from=build --chown=${UID}:${GID} /app/deploy/node_modules/ ./node_modules/

# --- Static + public assets (not included in standalone trace) ---
COPY --from=build --chown=${UID}:${GID} /app/apps/web/.next/static/ ./apps/web/.next/static/
COPY --from=build --chown=${UID}:${GID} /app/apps/web/public/ ./apps/web/public/
COPY --from=build --chown=${UID}:${GID} /app/apps/parser-api/ ./apps/parser-api/
COPY --from=build --chown=${UID}:${GID} /app/.uv/python/ /app/.uv/python/

# --- Custom server, run from source through tsx ---
# Its package.json says "type": "module". No tsconfig.json comes over: from
# /app or /app/apps/web, tsx would apply apps/web's @norish/queue/* path alias
# into /app/packages and load a second queue registry.
COPY --from=build --chown=${UID}:${GID} /app/apps/web/server/ ./apps/web/server/
COPY --from=build --chown=${UID}:${GID} /app/apps/web/package.json ./apps/web/package.json

# --- Workspace packages: runtime data files (AI prompts, migrations, etc.) ---
# The @norish/* code runs from the deployed copies in node_modules, but some
# packages contain runtime data files (e.g. .txt prompt templates) read from disk.
COPY --from=build --chown=${UID}:${GID} /app/packages/ ./packages/

# Create upload and bin parent directories only.
# Subdirectories (recipes/, avatars/, video-temp/) are created on-demand
RUN mkdir -p /app/uploads /app/bin && \
  chown -R ${UID}:${GID} /app/uploads /app/bin

# Copy pre-downloaded yt-dlp binary from dedicated build stage
COPY --from=ytdlp --chown=${UID}:${GID} /ytdlp/yt-dlp /app/bin/yt-dlp

# The container starts as root only so the entrypoint can hand the uploads
# folder to this user; the server itself runs as it.
ENV NORISH_UID=${UID} \
  NORISH_GID=${GID}

COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/norish-entrypoint

EXPOSE 3000

VOLUME ["/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health/live', r => process.exit(r.statusCode===200?0:1))" || exit 1

ENTRYPOINT ["norish-entrypoint"]

# Run directly with node; the custom server starts the embedded parser API when needed
CMD ["node", "--import", "tsx", "/app/apps/web/server/index.ts"]
