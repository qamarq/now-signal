import { NextRequest, NextResponse } from 'next/server';
import { auth } from './lib/auth';
import { headers } from 'next/headers';

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/settings', '/events'];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/register'];

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (isProtectedRoute && !session) {
    // Redirect to login if not authenticated
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && session) {
    // Don't redirect if coming from expired session
    const isExpired = searchParams.get('expired') === 'true';
    if (isExpired) {
      // Clear the invalid session cookie and let them stay on login
      const response = NextResponse.next();
      response.cookies.delete('better-auth.session_token');
      return response;
    }
    // Redirect to dashboard if already authenticated
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/events/:path*',
    '/login',
    '/register',
  ],
};
