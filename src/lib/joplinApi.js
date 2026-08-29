// src/lib/joplinApi.js
// Thin client for Joplin Server's own sync REST API — the same one the
// desktop/mobile apps use. All note edits must go through here (not direct
// Postgres writes) so Joplin Server's sync change-ledger stays correct and
// other clients see the edit on their next sync.

const JOPLIN_SERVER_URL = (process.env.JOPLIN_SERVER_URL || '').replace(/\/+$/, '');
const API_MIN_VERSION = '2.6.0';

export class JoplinAuthError extends Error {}

function requireConfigured() {
  if (!JOPLIN_SERVER_URL) throw new Error('JOPLIN_SERVER_URL is not set.');
}

function authHeaders(sessionId) {
  return {
    'X-API-AUTH': sessionId,
    'X-API-MIN-VERSION': API_MIN_VERSION,
  };
}

export async function login(email, password) {
  requireConfigured();
  const res = await fetch(`${JOPLIN_SERVER_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new JoplinAuthError('Invalid email or password.');
  const data = await res.json();
  return { sessionId: data.id, userId: data.user_id };
}

// Fetches the raw sync-format text for a note item (title, body, then a
// `key: value` property footer). Not JSON — see joplinItem.js.
export async function getItemRaw(sessionId, noteId) {
  requireConfigured();
  const res = await fetch(`${JOPLIN_SERVER_URL}/api/items/root:/${noteId}.md:/content`, {
    headers: authHeaders(sessionId),
  });
  if (res.status === 404) return null;
  if (res.status === 403) throw new JoplinAuthError('Joplin session expired.');
  if (!res.ok) throw new Error(`Joplin Server GET item failed: ${res.status}`);
  return res.text();
}

export async function putItemRaw(sessionId, noteId, text) {
  requireConfigured();
  const res = await fetch(`${JOPLIN_SERVER_URL}/api/items/root:/${noteId}.md:/content`, {
    method: 'PUT',
    headers: { ...authHeaders(sessionId), 'Content-Type': 'application/octet-stream' },
    body: text,
  });
  if (res.status === 403) throw new JoplinAuthError('Joplin session expired.');
  if (!res.ok) throw new Error(`Joplin Server PUT item failed: ${res.status}`);
  return res.text();
}
