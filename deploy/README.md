# Deploying to Render

The app runs as one Docker container on **Render's free plan**. Render builds the image from the GitHub repo using the root `Dockerfile`, runs it, and handles HTTPS for the custom domain.

```
browser ──https──▶ Render (TLS + routing) ──http──▶ app container ($PORT) ──▶ Supabase, Gemini, Discord, Slack
```

The service is described in [`render.yaml`](../render.yaml) (a Render "Blueprint"). Secrets are typed into the Render dashboard and are never in git or in the image.

| Where | What |
|---|---|
| GitHub | The repo. Each push to `main` rebuilds and redeploys |
| Render | Builds `Dockerfile`, runs the container, holds the env variables, serves HTTPS |
| Cloudflare DNS | `CNAME workspace-ai → multi-workspace-rag-assistant.onrender.com`, **DNS only** (grey cloud) |
| Supabase | Site URL and Redirect URLs set to `https://workspace-ai.brijeshhq.com` |

---

## Free plan: what to expect

- **It sleeps.** After 15 minutes with no requests, Render stops the container. The next visitor waits about a minute while it starts again.
- **Keep-alive ping (optional).** A free monitor such as UptimeRobot or cron-job.org can request `https://workspace-ai.brijeshhq.com/health` every 5–10 minutes, which keeps the app awake. The free plan includes 750 hours a month. A month has at most 744 hours, so this works only if it's the only free service in the Render workspace. The `/health` check in `render.yaml` doesn't keep the app awake. Render uses it only to decide whether the container is healthy.
- **No shell.** The free plan has no SSH or shell. Run the seed script from the laptop instead (below).
- **Restarts run startup cleanup.** On every start (including waking up), `services/recovery.ts` marks half-done answers and uploads as failed. Local dev uses the same Supabase database, so a cold start while you're testing locally can mark your local in-flight answer as failed. Press Retry.

---

## One-time setup

### 1. Create the service from the Blueprint

1. Push the repo to GitHub.
2. Render → **New** → **Blueprint** → connect GitHub → pick this repo. Render reads `render.yaml`.
3. Render asks for each value marked `sync: false`. Paste them from `server/.env` and `client/.env`:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
   - Optional: `GEMINI_API_KEY_FALLBACK`, `DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL` (leave empty to turn them off)
4. Click **Apply**. The first build takes a few minutes.

**Or, without the Blueprint:** Render → **New** → **Web Service** → pick the repo. Render sees the `Dockerfile` and fills in Language = Docker. Then set:
- Name `multi-workspace-rag-assistant`, branch `main`, region Singapore, instance type **Free**.
- **Environment Variables** → **Add from .env**: paste the server's `.env` lines plus the two `VITE_*` lines from `client/.env`. Leave out `PORT`, `SEED_EMAIL` and `SEED_PASSWORD`.
- **Advanced** → **Health Check Path**: `/health`.

- **Why `VITE_*` work:** Render passes every env variable to `docker build` as a build arg. The Dockerfile declares only `ARG VITE_SUPABASE_URL` and `ARG VITE_SUPABASE_ANON_KEY`, so only those two are used in the build, and Vite copies them into the JavaScript. They're public anyway (the browser gets them).
- **Why secrets stay out of the image:** the Dockerfile never declares an `ARG` for them, so they don't reach the build. They're given to the running container as normal env variables.
- **Don't set `PORT`.** Render sets it, and `config.ts` reads it.
- **Changing env variables later:** use the service's **Environment** tab in the dashboard. Render asks for `sync: false` values only when the Blueprint is first created.

**Check:** the service URL `https://multi-workspace-rag-assistant.onrender.com/health` returns `{"ok":true}`. (If Render added a suffix to the name, use the URL shown on the service page.)

### 2. Custom domain

1. Render → the service → **Settings** → **Custom Domains** → add `workspace-ai.brijeshhq.com`.
2. Cloudflare → DNS → add `CNAME  workspace-ai  multi-workspace-rag-assistant.onrender.com`, set to **DNS only** (grey cloud).
3. Back in Render, click **Verify**. Render then issues the HTTPS certificate on its own.

- **Why grey:** Render has to see the domain point straight at it to verify the domain and issue the certificate. With the orange cloud, Cloudflare sits in between and adds its own HTTPS layer, which is a second thing to configure.
- **Why a record is needed even though the name already resolves:** `brijeshhq.com` has a wildcard (`*`) pointing at another server. A specific record beats the wildcard.
- **Check:** `dig +short workspace-ai.brijeshhq.com` shows the `onrender.com` name, and `curl https://workspace-ai.brijeshhq.com/health` returns `{"ok":true}`.
- **Old VM record:** if there's still an `A workspace-ai` (or `assistant`) record pointing at the Azure VM, delete it. A name can't have both an `A` and a `CNAME` record.

### 3. Supabase

Authentication → URL Configuration: set the **Site URL** to `https://workspace-ai.brijeshhq.com` and add it to **Redirect URLs**.

### 4. Demo account (from the laptop)

The free plan has no shell, so the seed runs on the laptop. It writes to the same Supabase project the live app uses:

```bash
cd server
 SEED_EMAIL=… SEED_PASSWORD=… npm run seed
```

Start the line with a space so the password stays out of the shell history (this works when `HISTCONTROL` includes `ignorespace`, which is the default on many systems).

---

## Each deploy

Push to `main`. Render rebuilds the image and swaps the container once `/health` passes. If the new build fails, the old version keeps running.

To redeploy without a code change (for example after changing an env variable): service → **Manual Deploy** → **Deploy latest commit**.

## Test the image locally (optional)

The same image Render builds, run on the laptop:

```bash
set -a; . client/.env; set +a      # loads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
docker build --build-arg VITE_SUPABASE_URL --build-arg VITE_SUPABASE_ANON_KEY -t workspace-assistant .
docker run --rm -p 3000:3000 --env-file server/.env workspace-assistant
curl localhost:3000/health                                    # {"ok":true}
```

## Useful places in the Render dashboard

| Where | For |
|---|---|
| **Logs** | The app's console output (startup, errors). Keys and webhook URLs are never logged |
| **Events** | Build and deploy history, and why a deploy failed |
| **Environment** | Change env variables (then redeploy) |
| **Manual Deploy** | Redeploy, or roll back to an earlier commit |
