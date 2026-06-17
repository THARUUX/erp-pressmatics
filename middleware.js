import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'pressmatics_jwt_secret_2024_xk9z'
);

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // Only protect /dashboard routes
    if (pathname.startsWith('/dashboard')) {
        const token = request.cookies.get('token')?.value;

        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        try {
            await jwtVerify(token, JWT_SECRET);
            return NextResponse.next();
        } catch {
            // Token invalid or expired
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete('token');
            return response;
        }
    }

    // Redirect root to dashboard
    if (pathname === '/') {
        const token = request.cookies.get('token')?.value;
        if (token) {
            try {
                await jwtVerify(token, JWT_SECRET);
                return NextResponse.redirect(new URL('/dashboard', request.url));
            } catch {
                return NextResponse.redirect(new URL('/login', request.url));
            }
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/dashboard/:path*'],
};
