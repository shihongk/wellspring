import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  if (!process.env.APP_PASSWORD) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === '/login') return NextResponse.next();

  const session = request.cookies.get('session')?.value;
  if (session !== process.env.APP_PASSWORD) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
