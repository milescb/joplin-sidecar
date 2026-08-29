import type { APIRoute } from 'astro';
import { login, JoplinAuthError } from '../../lib/joplinApi.js';

export const POST: APIRoute = async ({ request, cookies }) => {
  // Requiring a JSON body means a plain cross-site <form> POST can't hit this
  // route (browsers can't set this content-type without a preflight, which
  // we don't answer) — a cheap CSRF guard on top of the SameSite cookie.
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Unsupported request.' }), { status: 400 });
  }

  const { email, password } = await request.json();
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password are required.' }), { status: 400 });
  }

  try {
    const { sessionId, userId } = await login(email, password);
    cookies.set('joplin_session', JSON.stringify({ id: sessionId, userId, email }), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    if (err instanceof JoplinAuthError) {
      return new Response(JSON.stringify({ error: 'Invalid email or password.' }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: 'Could not reach Joplin Server.' }), { status: 502 });
  }
};
