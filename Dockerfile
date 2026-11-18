# One image: Express serves the API and the built React app.
# Secrets are NOT baked in. Pass them at run time: docker run --env-file .env ...
# Only the public Supabase URL and anon key are build args, because Vite inlines them.
# Render passes every env variable to the build as a build arg, but only ARGs declared
# below are used, so the secrets never reach the build.

# ---------- build: compile client and server ----------
FROM node:22-slim AS build
WORKDIR /app

# Lockfiles first, so a code change reuses the cached npm install.
COPY client/package.json client/package-lock.json client/
COPY server/package.json server/package-lock.json server/
RUN npm ci --prefix client && npm ci --prefix server

COPY client client
COPY server server

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then \
      echo "Pass --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=..." >&2; exit 1; \
    fi
RUN npm run build --prefix client && npm run build --prefix server

# ---------- runtime: production deps + built files only ----------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json server/
RUN npm ci --omit=dev --prefix server && npm cache clean --force

# Same layout as the repo, so the relative paths in index.ts and seed.ts work.
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
COPY seed seed

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
