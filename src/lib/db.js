// src/lib/db.js
// PostgreSQL helpers and note cache shared across Astro pages.

import pg from 'pg';
const { Client } = pg;

export const SITE_TITLE = process.env.SITE_TITLE || 'Notes';

const PG = {
  host:     process.env.PG_HOST       || '127.0.0.1',
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.POSTGRES_USER     || process.env.PG_USER,
  password: process.env.POSTGRES_PASSWORD || process.env.PG_PASSWORD,
  database: process.env.POSTGRES_DATABASE || process.env.PG_DATABASE || 'joplin',
};

const CACHE_TTL = parseInt(process.env.CACHE_TTL_MS || '30000');

export function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function fetchSharedNotes() {
  const client = new Client(PG);
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT DISTINCT ON (s.id)
        s.id                                             AS hash,
        s.note_id                                        AS note_id,
        i.owner_id                                       AS owner_id,
        convert_from(i.content, 'UTF8')::json->>'title' AS title,
        i.updated_time,
        (
          SELECT convert_from(f.content, 'UTF8')::json->>'title'
          FROM items f
          WHERE f.jop_id = i.jop_parent_id
            AND f.jop_type = 2
          ORDER BY f.updated_time DESC
          LIMIT 1
        ) AS folder_title,
        (
          -- Who can edit this note: whoever owns any copy of it (jop_id can
          -- have more than one items row — e.g. an older per-user mirrored
          -- copy), PLUS anyone Joplin Server has granted access to one of
          -- those copies via user_items — that's the same grant its own
          -- sync API checks (ItemModel.loadByName joins user_items on the
          -- requesting user, not owner_id), so a collaborator on a shared
          -- notebook can edit a note there without having created it.
          SELECT array_agg(DISTINCT uid) FROM (
            SELECT c.owner_id AS uid
            FROM items c
            WHERE c.jop_id = i.jop_id AND c.jop_type = 1
            UNION
            SELECT ui.user_id AS uid
            FROM user_items ui
            JOIN items c ON c.id = ui.item_id
            WHERE c.jop_id = i.jop_id AND c.jop_type = 1
          ) collaborators
        ) AS collaborator_ids
      FROM shares s
      JOIN items i ON i.jop_id = s.note_id
      WHERE s.type = 1
        AND i.jop_type = 1
      ORDER BY s.id, i.updated_time DESC
    `);
    rows.sort((a, b) => Number(b.updated_time) - Number(a.updated_time));
    return rows.map((r) => ({
      hash:            r.hash,
      noteId:          r.note_id,
      ownerId:         r.owner_id,
      collaboratorIds: r.collaborator_ids || [r.owner_id],
      title:           r.title,
      slug:        slugify(r.title),
      folderTitle: r.folder_title || 'Notes',
      updatedAt:   new Date(Number(r.updated_time)).toLocaleDateString('en-US', {
                     year: 'numeric', month: 'short', day: 'numeric',
                   }),
    }));
  } finally {
    await client.end();
  }
}

export async function fetchNoteBody(hash) {
  const client = new Client(PG);
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT convert_from(i.content, 'UTF8')::json->>'body' AS body
      FROM shares s
      JOIN items i ON i.jop_id = s.note_id
      WHERE s.id = $1
        AND s.type = 1
        AND i.jop_type = 1
      ORDER BY i.updated_time DESC
      LIMIT 1
    `, [hash]);
    return rows[0]?.body ?? null;
  } finally {
    await client.end();
  }
}

// ── Cache ────────────────────────────────────────────────────────────────

let cache = { notes: null, bySlug: null, at: 0 };

export async function getNotes() {
  if (cache.notes && Date.now() - cache.at < CACHE_TTL) return cache;
  const notes = await fetchSharedNotes();
  const bySlug = Object.fromEntries(notes.map((n) => [n.slug, n]));
  cache = { notes, bySlug, at: Date.now() };
  console.log(`[${new Date().toISOString()}] Refreshed: ${notes.length} shared note(s)`);
  return cache;
}

export function invalidateNotesCache() {
  cache.at = 0;
}

// session: { id, userId, email } from the joplin_session cookie (see
// middleware.ts), or null if logged out. A user can edit a note if they own
// it or Joplin Server has granted them access to it via user_items (see the
// collaborator_ids query above) — matching exactly who the real sync API
// will let touch it.
export function canEditNote(session, note) {
  if (!session || !note) return false;
  return note.collaboratorIds.includes(session.userId);
}
