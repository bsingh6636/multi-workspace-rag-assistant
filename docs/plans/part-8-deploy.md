# Part 8 plan: Deploy and docs

Goal: the app runs on the user's Azure VM as one Docker container behind Caddy (HTTPS) at a subdomain of their domain, and the docs (README, `AI_NOTES.md`) are final.

> **Update (10:02):** the target is the user's Azure VM (Oracle Linux 8, x86_64, Docker + Compose already installed, ports 80/443 free), not AWS. Section D is replaced by `deploy/compose.yml` + `deploy/README.md`: Caddy terminates HTTPS and is the only service with public ports.

Checklist lives in `PLAN.md`.

---

## A. How it ships

The user's server already runs Docker. The image is built on the laptop and copied over, so the server doesn't need the source code, Node or a registry.

```
laptop:  docker build  →  docker save | gzip  →  ssh  →  server: docker load  →  docker run --env-file .env
```

**Secrets stay out of the image.** The server's secrets live in a `.env` file on the server (`chmod 600`), passed with `docker run --env-file`. Anyone who gets an image can read anything baked into it, with `docker inspect` (ENV) or `docker history` (build args). The README and PLAN already promise "never baked into the image".

The only values built in are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Vite inlines them into the JavaScript at build time, and they're public anyway: every browser that loads the app receives them.

## B. Dockerfile (multi-stage)

| Stage | Base | Does |
|---|---|---|
| `build` | `node:22-slim` | `npm ci` for client and server (lockfiles copied first, so code changes reuse the cached install). Fails with a clear message if the two `VITE_*` build args are missing. Builds `client/dist` and `server/dist`. |
| runtime | `node:22-slim` | `npm ci --omit=dev` for the server only. Copies both `dist` folders and `/seed`, which the seed script reads. Runs as the non-root `node` user. Has a `HEALTHCHECK` on `/health` (Node's built-in `fetch`, no curl needed) and runs `CMD node server/dist/index.js`. |

The paths keep the repo layout (`/app/server/dist`, `/app/client/dist`, `/app/seed`), so `index.ts` (`../../client/dist`) and `seed.ts` (`../../../seed`) work unchanged.

**`.dockerignore`:** `**/node_modules`, `**/dist`, `**/.env` and `.env.*` (keeping `.env.example`), `_private/`, `.git`, `.claude`, `user-later.md`, `*.log`, docs and drawio. Excluding `.env` matters twice: it keeps secrets out of the build context, and it stops Vite from reading `client/.env` instead of the build args.

## C. Local check (before anything goes to the server)

1. Build with the values from `client/.env` as build args.
2. Check the image for secrets: no `.env` file inside, and none of the server secret values in the image filesystem or `docker history` (only "found / not found" printed).
3. Run it on :3127 with `--env-file server/.env`. Check `/health`, that `/` serves the app, that a deep link (`/w/<id>/documents`) serves `index.html`, and that `/api/workspaces` without a token gives 401.
4. Check that the health status is `healthy` and the image size is reasonable.

(The container's startup cleanup touches the shared DB, as the test servers do.)

## D. On the server (the user runs these, or tells me the ssh host)

1. **CPU type:** `uname -m` on the server. If it's `aarch64` (Graviton), build with `docker buildx build --platform linux/arm64`.
2. **Copy the image:** `docker save workspace-assistant | gzip | ssh <host> 'gunzip | docker load'`.
3. **Env file, once:** `scp server/.env <host>:~/workspace-assistant.env`, then `chmod 600` on the server.
4. **Run:** `docker run -d --name workspace-assistant --restart unless-stopped --env-file ~/workspace-assistant.env -p <port>:3000 workspace-assistant`.
5. **Update later:** the same steps 2 and 4, after `docker rm -f workspace-assistant`.
6. **Open the port** in the EC2 security group, or put it behind the existing reverse proxy or HTTPS, depending on what the server already has.
7. **Seed the demo account:** `docker exec -e SEED_EMAIL=… -e SEED_PASSWORD=… workspace-assistant node server/dist/scripts/seed.js`.
8. **Supabase:** add the live URL under Authentication → URL Configuration.

## E. Docs

- **README Deployment:** the commands above, plus the live URL and "demo login shared privately".
- **`.env.example`:** final check against `config.ts`.
- **`AI_NOTES.md`:** about one page, per PLAN.
- **PLAN.md:** tick the boxes. Run the final demo on the live URL.
