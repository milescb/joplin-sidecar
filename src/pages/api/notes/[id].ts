import type { APIRoute } from 'astro';
import { getNotes, invalidateNotesCache, canEditNote } from '../../../lib/db.js';
import { getItemRaw, putItemRaw, JoplinAuthError } from '../../../lib/joplinApi.js';
import { parseItem, updateItem, serializeItem } from '../../../lib/joplinItem.js';

export const PUT: APIRoute = async ({ params, request, locals, cookies }) => {
  const session = locals.session;
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not logged in.' }), { status: 401 });
  }

  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Unsupported request.' }), { status: 400 });
  }

  const noteId = params.id!;

  // Only notes already published on this site (i.e. shared in Joplin) can be
  // edited here, and only by an account that actually has its own copy of
  // this note (a collaborator on the notebook it's in) — this keeps the
  // write path scoped to what's already public and prevents guessing at
  // private note ids.
  const { notes } = await getNotes();
  const note = notes.find((n) => n.noteId === noteId);
  if (!note) {
    return new Response(JSON.stringify({ error: 'Note is not published.' }), { status: 403 });
  }
  if (!canEditNote(session, note)) {
    return new Response(JSON.stringify({ error: 'You do not have permission to edit this note.' }), { status: 403 });
  }

  const { title, body } = await request.json();
  if (typeof title !== 'string' || typeof body !== 'string') {
    return new Response(JSON.stringify({ error: 'title and body are required.' }), { status: 400 });
  }

  try {
    const raw = await getItemRaw(session.id, noteId);
    if (!raw) {
      return new Response(JSON.stringify({ error: 'Note not found on Joplin Server.' }), { status: 404 });
    }

    const updated = updateItem(parseItem(raw), { title, body });
    await putItemRaw(session.id, noteId, serializeItem(updated));

    invalidateNotesCache();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    if (err instanceof JoplinAuthError) {
      cookies.delete('joplin_session', { path: '/' });
      return new Response(JSON.stringify({ error: 'Joplin session expired, please log in again.' }), { status: 401 });
    }
    console.error('Failed to save note:', err);
    return new Response(JSON.stringify({ error: 'Failed to save note.' }), { status: 502 });
  }
};
