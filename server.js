// server.js — HTTP entry point
// Delegates all requests to the Astro SSR handler built by `npm run build`.
// Run `npm run build` once before starting, then `node server.js`.
//
// Environment variables:
//   PG_HOST, PG_PORT, PG_USER/POSTGRES_USER, PG_PASSWORD/POSTGRES_PASSWORD, PG_DATABASE
//   LISTEN_PORT   - port to listen on (default 3456)
//   CACHE_TTL_MS  - note list cache TTL (default 30000)
//   SITE_TITLE    - site title displayed in nav (default "Notes")

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handler } from './dist/server/entry.mjs';

const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || '3456');

if (!process.env.PG_PASSWORD && !process.env.POSTGRES_PASSWORD) {
  console.error('PG_PASSWORD (or POSTGRES_PASSWORD) is required.');
  process.exit(1);
}

// The @astrojs/node adapter's "middleware" mode only renders SSR routes —
// it never serves the hashed CSS/JS files `astro build` writes to
// dist/client. Astro inlines a page's <style> when it's small enough that
// no separate request is needed, which is why this went unnoticed until a
// page's CSS grew past that threshold. Serve dist/client ourselves so any
// externalized asset works regardless of size.
const CLIENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist', 'client');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function serveStatic(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const resolved = path.normalize(path.join(CLIENT_DIR, urlPath));
  // Reject anything that escapes CLIENT_DIR (e.g. "/../../etc/passwd").
  if (resolved !== CLIENT_DIR && !resolved.startsWith(CLIENT_DIR + path.sep)) return next();

  fs.stat(resolved, (err, stats) => {
    if (err || !stats.isFile()) return next();

    const ext = path.extname(resolved);
    const headers = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' };
    // Astro fingerprints these filenames with a content hash, so they can
    // be cached forever; anything else (e.g. favicon) gets a short TTL.
    headers['Cache-Control'] = urlPath.startsWith('/_astro/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=300';

    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(resolved).pipe(res);
  });
}

http.createServer((req, res) => {
  serveStatic(req, res, () => {
    handler(req, res, () => {
      res.writeHead(404);
      res.end('Not found');
    });
  });
}).listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(`Sidecar listening on 127.0.0.1:${LISTEN_PORT}`);
});
