import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'sales-crm-super-secret-key-2024-change-in-prod';
const COOKIE_NAME = 'crm_token';

// Edge-compatible JWT verification using Web Crypto API
// (jsonwebtoken uses Node.js crypto which is unavailable in the Edge Runtime)
async function verifyEdgeToken(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [header, payload, sig] = parts;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const b64 = sig.replace(/-/g, '+').replace(/_/g, '/');
    const sigBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const data = new TextEncoder().encode(header + '.' + payload);
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    if (!valid) return false;

    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return !decoded.exp || decoded.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard') || (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth'))) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const valid = token ? await verifyEdgeToken(token) : false;
    if (!valid) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
