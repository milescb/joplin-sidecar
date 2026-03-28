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
        convert_from(i.content, 'UTF8')::json->>'title' AS title,
        i.updated_time,
        (
          SELECT convert_from(f.content, 'UTF8')::json->>'title'
          FROM items f
          WHERE f.jop_id = i.jop_parent_id
            AND f.jop_type = 2
          ORDER BY f.updated_time DESC
          LIMIT 1
        ) AS folder_title
      FROM shares s
      JOIN items i ON i.jop_id = s.note_id
      WHERE s.type = 1
        AND i.jop_type = 1
      ORDER BY s.id, i.updated_time DESC
    `);
    rows.sort((a, b) => Number(b.updated_time) - Number(a.updated_time));
    return rows.map((r) => ({
      hash:        r.hash,
      title:       r.title,
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
