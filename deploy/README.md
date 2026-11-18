# Deploying to the VM

The app runs as one Docker container on an Azure VM. **Caddy** sits in front of it: it handles HTTPS, gets the certificate and renews it on its own.

```
browser ──https──▶ Caddy (:443 on the VM) ──http──▶ app container (:3000) ──▶ Supabase, Gemini, Discord
```

The image is built on the laptop and copied to the VM. The VM needs no source code, Node or registry.

| Where | What | Example |
|---|---|---|
| DNS (Cloudflare) | `A` record for the subdomain → VM IP | `assistant` → `52.172.93.106`, **DNS only** (grey cloud) |
| Laptop | Build the image | `docker build …` |
| VM `~/workspace-assistant/` | `compose.yml`, `.env`, `app.env` | — |

---

## One-time setup

### 1. DNS: point the subdomain at the VM

In Cloudflare → DNS, add `A  assistant  52.172.93.106`, with the proxy set to **DNS only** (grey cloud).

- **Why grey:** Caddy proves to Let's Encrypt that it owns the name by answering on port 80. With the orange cloud, Cloudflare sits in between and adds its own HTTPS layer, which is a second thing to configure.
- **Why a record is needed even though the name already resolves:** the domain has a wildcard (`*`) pointing at another server. A specific record beats the wildcard.
- **Check:** `dig +short assistant.brijeshhq.com` prints `52.172.93.106`.

### 2. Open ports 80 and 443

There are two firewalls in the way:

**Azure (outside the VM):**
1. Open Portal → the VM → **Networking** → **Add inbound port rule**.
2. Use these settings: destination ports `80,443`, protocol TCP, action Allow.

**firewalld (inside the VM, Oracle Linux):**

```bash
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

### 3. Let your laptop user run Docker

```bash
sudo usermod -aG docker $USER   # then log out and in (or prefix commands with: sg docker -c "...")
```

---

## Each deploy

### 4. Build the image (laptop, repo root)

```bash
set -a; . client/.env; set +a      # loads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
docker build \
  --build-arg VITE_SUPABASE_URL --build-arg VITE_SUPABASE_ANON_KEY \
  -t workspace-assistant .
```

- **Why build args:** Vite copies `VITE_*` values into the JavaScript at build time. They're public (the browser gets them anyway).
- **Why not the secrets:** they're added later at run time, so the image itself holds no secrets. Anyone with an image can read what's baked in (`docker history`, `docker inspect`).

### 5. Copy the image to the VM

```bash
docker save workspace-assistant | gzip | ssh azureuser@52.172.93.106 'gunzip | docker load'
```

`docker save` turns the image into one file stream. It's piped through SSH, so there's no temp file and no registry.

### 6. First time only: copy the config

```bash
ssh azureuser@52.172.93.106 'mkdir -p ~/workspace-assistant'
scp deploy/compose.yml azureuser@52.172.93.106:~/workspace-assistant/
scp server/.env        azureuser@52.172.93.106:~/workspace-assistant/app.env
ssh azureuser@52.172.93.106 'cd ~/workspace-assistant && chmod 600 app.env && echo APP_DOMAIN=assistant.brijeshhq.com > .env'
```

- **`app.env`:** the server's secrets. Only your user on the VM can read it (`chmod 600`).
- **`.env`:** Docker Compose reads this one automatically. It only holds the domain.

### 7. Start or update

```bash
ssh azureuser@52.172.93.106 'cd ~/workspace-assistant && docker compose up -d && docker compose ps'
```

`up -d` starts both containers in the background. After a new `docker load`, it recreates only the app container, and Caddy keeps running. `restart: unless-stopped` brings them back after a VM reboot.

### 8. Check

```bash
curl https://assistant.brijeshhq.com/health          # {"ok":true}
ssh azureuser@52.172.93.106 'cd ~/workspace-assistant && docker compose logs --tail 30'
```

The first HTTPS request can take a few seconds while Caddy gets the certificate.

---

## After the first deploy

- **Supabase:** go to Authentication → URL Configuration. Set the **Site URL** to `https://assistant.brijeshhq.com` and add it to **Redirect URLs**.
- **Demo account:** the seed files are in the image. SSH in first, then run:

  ```bash
  cd ~/workspace-assistant
  docker compose exec -e SEED_EMAIL=… -e SEED_PASSWORD=… app node server/dist/scripts/seed.js
  ```

  Start the line with a space so the password stays out of the shell history (this works when `HISTCONTROL` includes `ignorespace`, which is the default on many systems).

## Useful commands (on the VM)

| Command | Does |
|---|---|
| `docker compose logs -f app` | Follow the app's logs |
| `docker compose restart app` | Restart the app (it marks half-done answers as failed on startup) |
| `docker compose down` | Stop both containers. The certificate is kept in the `caddy_data` volume |
| `docker image prune -f` | Delete old image versions after a few deploys |
