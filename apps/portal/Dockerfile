# syntax=docker/dockerfile:1.7
# Portal image (and, via the `builder` target, the one-shot setup job).
# Build from the repo root:  docker build -f apps/portal/Dockerfile .
ARG NODE_IMAGE=node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
# Corepack verifies the pnpm release signature before activating it.
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate

FROM base AS builder
WORKDIR /repo
# Fetch from the lockfile alone, so the dependency layer is cached across code changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --offline --frozen-lockfile
RUN pnpm exec turbo run build --filter=@parallax/portal...

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S -G app app
COPY --from=builder --chown=app:app /repo/apps/portal/.next/standalone ./
COPY --from=builder --chown=app:app /repo/apps/portal/.next/static ./apps/portal/.next/static
USER app
EXPOSE 3000
CMD ["node", "apps/portal/server.js"]
