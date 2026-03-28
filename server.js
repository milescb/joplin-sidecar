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
import { handler } from './dist/server/entry.mjs';

const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || '3456');

if (!process.env.PG_PASSWORD && !process.env.POSTGRES_PASSWORD) {
  console.error('PG_PASSWORD (or POSTGRES_PASSWORD) is required.');
  process.exit(1);
}

http.createServer((req, res) => {
  handler(req, res, () => {
    res.writeHead(404);
    res.end('Not found');
  });
}).listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(`Sidecar listening on 127.0.0.1:${LISTEN_PORT}`);
});
