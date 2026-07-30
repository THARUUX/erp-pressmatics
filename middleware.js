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

function canAccess(role, permissions, pathname) {
    if (role === 'admin') return true;

    // System Administration
    if (
        pathname.startsWith('/dashboard/users') ||
        pathname.startsWith('/dashboard/settings') ||
        pathname.startsWith('/dashboard/system-info') ||
        pathname.startsWith('/dashboard/whatsapp') ||
        pathname.startsWith('/dashboard/billing')
    ) {
        return !!permissions.access_system;
    }

    // HR & Payroll
    if (
        pathname.startsWith('/dashboard/employees') ||
        pathname.startsWith('/dashboard/attendance') ||
        pathname.startsWith('/dashboard/payroll')
    ) {
        return !!permissions.access_hr;
    }

    // Inventory & Suppliers
    if (
        pathname.startsWith('/dashboard/inventory') ||
        pathname.startsWith('/dashboard/suppliers')
    ) {
        return !!permissions.access_inventory;
    }

    // Sales & Accounts
    if (
        pathname.startsWith('/dashboard/customers') ||
        pathname.startsWith('/dashboard/quotations') ||
        pathname.startsWith('/dashboard/sales-orders') ||
        pathname.startsWith('/dashboard/invoices')
    ) {
        return !!permissions.access_sales;
    }

    // Production & Planning
    if (
        pathname.startsWith('/dashboard/estimations') ||
        pathname.startsWith('/dashboard/items') ||
        pathname.startsWith('/dashboard/services') ||
        pathname.startsWith('/dashboard/job-planning')
    ) {
        return !!permissions.access_production;
    }

    // Dashboard & Analytics
    if (
        pathname === '/dashboard' ||
        pathname.startsWith('/dashboard/analytics') ||
        pathname.startsWith('/dashboard/competitor-analysis')
    ) {
        return !!permissions.access_dashboard;
    }

    return true;
}

function getDefaultPage(role, permissions) {
    if (role === 'admin') return '/dashboard';
    if (permissions.access_dashboard) return '/dashboard';
    if (permissions.access_production) return '/dashboard/job-planning';
    if (permissions.access_sales) return '/dashboard/quotations';
    if (permissions.access_hr) return '/dashboard/employees';
    if (permissions.access_inventory) return '/dashboard/inventory';
    if (permissions.access_system) return '/dashboard/users';
    return '/dashboard/guide';
}

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    if (process.env.LICENSE_STATUS === 'inactive') {
        if (pathname.startsWith('/api')) {
            const isLoginOrPublic =
                pathname === '/api/auth/login' ||
                pathname === '/api/auth/companies' ||
                pathname === '/api/portal/login' ||
                pathname === '/api/whatsapp/incoming';
            if (!isLoginOrPublic) {
                return NextResponse.json({ error: 'Server suspended due to the payment' }, { status: 403 });
            }
        }
        const isPublicPage =
            pathname === '/login' ||
            pathname === '/portal/login' ||
            pathname.startsWith('/_next') ||
            pathname.includes('.');
        if (!isPublicPage) {
            const response = NextResponse.redirect(new URL('/login?error=suspended', request.url));
            response.cookies.delete('token');
            return response;
        }
    }

    // Protect API routes
    if (pathname.startsWith('/api')) {
        const isPublicApi =
            pathname === '/api/auth/login' ||
            pathname === '/api/auth/companies' ||
            pathname.startsWith('/api/portal/') ||
            pathname === '/api/whatsapp/incoming';

        if (!isPublicApi) {
            const token = request.cookies.get('token')?.value;
            if (!token) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const payload = await verifyJWT(token);
            if (!payload) {
                return NextResponse.json({ error: 'Unauthorized – Invalid or expired token' }, { status: 401 });
            }

            // Role-based check for admin API routes
            if (pathname.startsWith('/api/admin')) {
                const role = payload.role || 'operator';
                const permissions = payload.permissions || {};

                if (role !== 'admin') {
                    if (pathname.startsWith('/api/admin/users') || pathname.startsWith('/api/admin/roles')) {
                        if (!permissions.access_system) {
                            return NextResponse.json({ error: 'Forbidden – System Admin access required' }, { status: 403 });
                        }
                    } else {
                        return NextResponse.json({ error: 'Forbidden – Admin only' }, { status: 403 });
                    }
                }
            }

            // Forward user headers to api routes
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-user-role', payload.role || 'operator');
            requestHeaders.set('x-user-name', payload.name || '');
            requestHeaders.set('x-user-email', payload.email || '');
            requestHeaders.set('x-user-id', String(payload.id || ''));

            return NextResponse.next({ request: { headers: requestHeaders } });
        }
    }

    // Protect all /dashboard and /operator routes
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/operator')) {
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
        const permissions = payload.permissions || {};

        // Role-based access control (only enforce canAccess check on /dashboard routes)
        if (pathname.startsWith('/dashboard') && !canAccess(role, permissions, pathname)) {
            const fallback = getDefaultPage(role, permissions);
            return NextResponse.redirect(new URL(fallback + '?denied=1', request.url));
        }

        // Forward the user role as a request header so layout can read it
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-role', role);
        requestHeaders.set('x-user-name', payload.name || '');
        requestHeaders.set('x-user-email', payload.email || '');
        requestHeaders.set('x-user-id', String(payload.id || ''));

        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Redirect root appropriately
    if (pathname === '/') {
        const token = request.cookies.get('token')?.value;
        if (token) {
            const payload = await verifyJWT(token);
            if (payload) {
                const role = payload.role || 'operator';
                const permissions = payload.permissions || {};
                const dest = getDefaultPage(role, permissions);
                return NextResponse.redirect(new URL(dest, request.url));
            }
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/dashboard/:path*', '/operator/:path*', '/api/:path*'],
};
