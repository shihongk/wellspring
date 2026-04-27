import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const jar = await cookies();
  jar.delete('session');
  return Response.redirect(new URL('/login', request.url));
}
