# The MycoTrack frontend as a container image: the built app, served by nginx.
#
# Build (from the repository root):   docker build -t mycotrack-web frontend
# Run:                                docker run -p 8080:8080 mycotrack-web
# Then open:                          http://localhost:8080/demo
#
# The image is built WITHOUT Auth0, API or Sentry settings (the build ignores any local .env),
# so the app starts in its demo-only mode: sample data and recorded assistant answers, no
# backend, no database and no keys needed. Vite bakes its settings into the files at build
# time, so a build with real settings is a different image (see the --build-arg lines below).

# ---- Stage 1: build the static files -------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first: this layer is rebuilt only when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

# Optional build-time settings. Left empty, the app is demo-only.
#   docker build --build-arg VITE_API_BASE_URL=... --build-arg VITE_AUTH0_DOMAIN=... frontend
ARG VITE_API_BASE_URL=""
ARG VITE_AUTH0_DOMAIN=""
ARG VITE_AUTH0_CLIENT_ID=""
ARG VITE_AUTH0_AUDIENCE=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN \
    VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID \
    VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE

COPY . .
# Only `vite build`, not `npm run build` (which type-checks first): CI already does that, and one
# test imports a case file shared with the backend (../backend/tests), which is outside this
# build's context. The tests are not part of the bundle anyway.
RUN npx vite build

# ---- Stage 2: serve them -------------------------------------------------------------------
# The "unprivileged" nginx runs as a non-root user and listens on 8080. Only the built files
# reach this stage: no Node, no source code, no node_modules.
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]
