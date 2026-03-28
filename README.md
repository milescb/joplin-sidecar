# joplin-sidecar

A dynamic web server that serves published [Joplin](https://joplinapp.org/) notes as a public website. It reads directly from Joplin's PostgreSQL database, renders markdown server-side (with math and syntax highlighting), and serves everything through an Astro SSR frontend.

New notes appear automatically within the cache TTL — no rebuild required.

## How it works

```
Joplin desktop → Joplin Server (Docker) → PostgreSQL
                                                ↓
                                         joplin-sidecar
                                         (Astro SSR + Node)
                                                ↓
                                    nginx → Cloudflare Tunnel → internet
```

- Only notes marked as **shared** in Joplin (`shares.type = 1`) are served.
- The note list is cached for `CACHE_TTL_MS` ms (default 30 s); the UI rebuilds only when `.astro` or CSS files change.

## Prerequisites

- Node.js `^18.17.1 || ^20.3.0 || >=21.0.0` (Ubuntu 24.04 ships 18.19.1 — see [Node version note](#node-version))
- Joplin Server running via Docker with PostgreSQL
- nginx
- A Cloudflare Tunnel pointed at `http://127.0.0.1:80`

## Environment variables

Set these in your systemd service or a `.env` file:

| Variable | Default | Description |
|---|---|---|
| `PG_HOST` | `127.0.0.1` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_USER` / `POSTGRES_USER` | — | PostgreSQL username |
| `PG_PASSWORD` / `POSTGRES_PASSWORD` | **required** | PostgreSQL password |
| `PG_DATABASE` / `POSTGRES_DATABASE` | `joplin` | Database name |
| `LISTEN_PORT` | `3456` | Port the Node server listens on |
| `CACHE_TTL_MS` | `30000` | Note list cache TTL in milliseconds |
| `SITE_TITLE` | `My Notes` | Title shown in the sidebar and index page |

## Deployment

### 1. Clone and install

```bash
git clone <repo-url> joplin-sidecar
cd joplin-sidecar
npm install
```

### 2. Build

```bash
npm run build
```

This compiles the Astro frontend to `dist/`. Re-run whenever you change `.astro`, CSS, or config files. Content changes (new/updated notes in Joplin) do **not** require a rebuild.

### 3. Run

```bash
# With env vars inline:
PG_PASSWORD=secret SITE_TITLE="My Notes" node server.js

# Or export them first, then:
node server.js
```

### 4. systemd service

Copy and edit the included service file:

```bash
sudo cp joplin-sidecar.service /etc/systemd/system/
# Edit credentials and paths as needed
sudo systemctl daemon-reload
sudo systemctl enable --now joplin-sidecar
```

The service runs `npm run build` automatically before starting the server on every boot/restart. To apply UI changes without rebooting:

```bash
sudo systemctl restart joplin-sidecar
```

## nginx configuration

nginx sits between the Cloudflare Tunnel and the Node server. Because Cloudflare handles TLS, nginx only needs to listen on port 80.

Copy the included config:

```bash
sudo cp notes.milescb.com.conf /etc/nginx/sites-available/notes.milescb.com
sudo ln -s /etc/nginx/sites-available/notes.milescb.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
or alternatively copy to `/etc/nginx/conf.d` depending on how you've setup `nginx`. 

The config proxies all traffic to `127.0.0.1:3456`:

```nginx
server {
    listen 80;
    server_name notes.milescb.com;

    location / {
        proxy_pass       http://127.0.0.1:3456;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_header Content-Type;
    }
}
```

## Cloudflare Tunnel

In the Cloudflare Zero Trust dashboard, create a tunnel with a public hostname pointing to `http://127.0.0.1:80`. No SSL certificates are needed on the server — Cloudflare terminates TLS at the edge.

```
Public hostname: notes.yourdomain.com
Service:         HTTP  →  127.0.0.1:80
```

## Development

```bash
npm run dev
```

Starts the Astro dev server with hot-reload. Set environment variables before running (the dev server reads `process.env` directly — no `.env` file loading is built in, so either export them in your shell or use a tool like `dotenv-cli`).
