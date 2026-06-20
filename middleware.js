import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'pressmatics_jwt_secret_2024_xk9z';

// Base64url decode to ArrayBuffer — works in Edge runtime without any packages
function base64UrlToBuffer(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

// Verify a JWT using SubtleCrypto (HMAC-SHA256) — Edge compatible
async function verifyJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;
        const signingInput = `${headerB64}.${payloadB64}`;

        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(JWT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const valid = await crypto.subtle.verify(
            'HMAC',
            key,
            base64UrlToBuffer(signatureB64),
            new TextEncoder().encode(signingInput)
        );

        if (!valid) return null;

        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

        // Check expiry
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

        return payload;
    } catch {
        return null;
    }
}

// Routes that only admins can access
const ADMIN_ONLY_ROUTES = [
    '/dashboard/users',
    '/dashboard/settings',
    '/api/admin',
];

// Routes that require at least manager role
const MANAGER_ROUTES = [
    '/dashboard/invoices',
    '/dashboard/quotations',
    '/dashboard/customers',
    '/dashboard/items'
];

function canAccess(role, pathname) {
    // Admins can access everything
    if (role === 'admin') return true;

    // Block operators and managers from admin-only routes
    if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
        return role === 'admin';
    }

    // Managers and above can access manager routes
    if (MANAGER_ROUTES.some(r => pathname.startsWith(r))) {
        return role === 'admin' || role === 'manager';
    }

    return true;
}

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // Protect all /dashboard routes
    if (pathname.startsWith('/dashboard')) {
        const token = request.cookies.get('token')?.value;

        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        const payload = await verifyJWT(token);
        if (!payload) {
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete('token');
            return response;
        }

        const role = payload.role || 'operator';

        // Role-based access control
        if (!canAccess(role, pathname)) {
            // Redirect to dashboard root with an 'access denied' flag
            return NextResponse.redirect(new URL('/dashboard?denied=1', request.url));
        }

        // Forward the user role as a request header so layout can read it
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-role', role);
        requestHeaders.set('x-user-name', payload.name || '');
        requestHeaders.set('x-user-email', payload.email || '');
        requestHeaders.set('x-user-id', String(payload.id || ''));

        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Protect admin API routes 
    if (pathname.startsWith('/api/admin')) {
        const token = request.cookies.get('token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const payload = await verifyJWT(token);
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden – Admin only' }, { status: 403 });
        }
        return NextResponse.next();
    }

    // Redirect root appropriately
    if (pathname === '/') {
        const token = request.cookies.get('token')?.value;
        if (token) {
            const payload = await verifyJWT(token);
            if (payload) return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/dashboard/:path*', '/api/admin/:path*'],
};
