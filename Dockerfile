# syntax=docker/dockerfile:1.7
# One build, several runtime images:
#   --target portal | collector | worker   the product
#   --target edge                          Caddy + the example sites (static files)
#   --target demo                          example API + load generator (public demo)
# (`builder` doubles as the one-shot setup jobs: migrations, Umami bootstrap, demo seed.)
ARG NODE_IMAGE=node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
ARG CADDY_IMAGE=caddy:2.11.9-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0

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
RUN pnpm exec turbo run build \
      --filter=@parallax/portal... --filter=@parallax/collector... --filter=@parallax/worker... \
      --filter=@parallax/example-nextjs-site --filter=@parallax/example-load-generator...
# Self-contained production bundles (own node_modules, workspace packages copied in).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @parallax/collector deploy --prod --legacy /out/collector && \
    pnpm --filter @parallax/worker deploy --prod --legacy /out/worker && \
    pnpm --filter @parallax/example-express-api deploy --prod --legacy /out/example-api && \
    pnpm --filter @parallax/example-load-generator deploy --prod --legacy /out/load-generator

FROM ${NODE_IMAGE} AS portal
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S -G app app
COPY --from=builder --chown=app:app /repo/apps/portal/.next/standalone ./
COPY --from=builder --chown=app:app /repo/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=builder --chown=app:app /repo/apps/portal/public ./apps/portal/public
USER app
EXPOSE 3000
CMD ["node", "apps/portal/server.js"]

FROM ${NODE_IMAGE} AS collector
WORKDIR /app
ENV NODE_ENV=production PORT=4318
COPY --from=builder /out/collector ./
USER node
EXPOSE 4318
CMD ["node", "dist/main.js"]

FROM ${NODE_IMAGE} AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /out/worker ./
USER node
CMD ["node", "dist/main.js"]

# Public demo: examples/express-api (dual-exporting OTel) and the traffic generator.
FROM ${NODE_IMAGE} AS demo
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /out/example-api ./express-api
COPY --from=builder /out/load-generator ./load-generator
USER node

# Public edge: Caddy, plus the example sites served at /examples/… for the demo.
FROM ${CADDY_IMAGE} AS edge
COPY --from=builder /repo/examples/static-site/*.html /repo/examples/static-site/*.css /srv/examples/static-site/
COPY --from=builder /repo/examples/nextjs-site/out /srv/examples/nextjs-site
