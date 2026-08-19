import { NextResponse } from 'next/server';
import { HttpError } from './auth';

export const json = (data, init) => NextResponse.json(data, init);

export const ok = (data = {}) => NextResponse.json({ ok: true, ...data });

export const fail = (status, error, extra = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

/** Wraps a route handler so thrown HttpErrors become clean JSON responses. */
export function route(handler) {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message, err.code ? { code: err.code } : {});
      console.error('[api]', err);
      return fail(500, 'Something went wrong on the server', {
        detail: process.env.NODE_ENV === 'development' ? String(err?.message || err) : undefined,
      });
    }
  };
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}
