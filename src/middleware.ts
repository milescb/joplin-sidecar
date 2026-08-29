// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const raw = context.cookies.get('joplin_session')?.value;
  let session = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string') session = parsed;
    } catch {
      // Malformed/tampered cookie — treat as logged out.
    }
  }
  context.locals.session = session;
  return next();
});
