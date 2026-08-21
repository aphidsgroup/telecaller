import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'bt_session';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/webhooks', '/api/cron', '/manifest.webmanifest', '/sw.js', '/offline.html', '/icons', '/icon.png', '/logo-main.png'];

function isPublic(pathname) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function readSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET || ''));
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req) {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const role = session.role;

  // Role separation is what makes every timestamp in this app meaningful.
  const homePath = role === 'ADMIN' ? '/admin' : (role === 'MANAGER' ? '/manager' : '/caller');

  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && role !== 'ADMIN') {
    if (pathname.startsWith('/api/')) return NextResponse.json({ ok: false, error: 'Admins only' }, { status: 403 });
    return NextResponse.redirect(new URL(homePath, req.url));
  }

  if ((pathname.startsWith('/manager') || pathname.startsWith('/api/manager')) && role !== 'MANAGER') {
    if (pathname.startsWith('/api/')) return NextResponse.json({ ok: false, error: 'Managers only' }, { status: 403 });
    return NextResponse.redirect(new URL(homePath, req.url));
  }

  if ((pathname.startsWith('/caller') || pathname.startsWith('/api/telecaller')) && role !== 'TELECALLER') {
    if (pathname.startsWith('/api/')) return NextResponse.json({ ok: false, error: 'Telecallers only' }, { status: 403 });
    return NextResponse.redirect(new URL(homePath, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|icon\\.png|logo-main\\.png|sw\\.js|offline\\.html|manifest\\.webmanifest).*)'],
};
