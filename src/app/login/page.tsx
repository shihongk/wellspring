import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

async function loginAction(formData: FormData) {
  'use server';
  const password = formData.get('password') as string;
  if (password === process.env.APP_PASSWORD) {
    const jar = await cookies();
    jar.set('session', password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    redirect('/dashboard');
  }
  redirect('/login?error=1');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f9ff' }}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Wellspring</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your password to continue.</p>
        <form action={loginAction} className="space-y-4">
          <input
            name="password"
            type="password"
            required
            autoFocus
            placeholder="Password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
          {error && <p className="text-sm text-red-600">Incorrect password.</p>}
          <button
            type="submit"
            className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#0e7490' }}
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
