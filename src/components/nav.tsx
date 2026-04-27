'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/holdings', label: 'Holdings' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/cash', label: 'Cash' },
  { href: '/plan', label: 'Plan' },
  { href: '/setup', label: 'Setup' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed top-0 left-0 h-screen w-48 flex flex-col py-4 px-3 z-50"
      style={{ backgroundColor: '#0f172a' }}
    >
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-square.png" alt="Wellspring" width={32} height={32} className="rounded-lg shrink-0" />
        <span className="text-white font-semibold text-sm">Wellspring</span>
      </Link>

      <div className="flex flex-col gap-0.5">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'text-cyan-300 bg-white/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <a
        href="/api/auth/logout"
        className="mt-auto px-3 py-2 rounded-md text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
      >
        Sign out
      </a>
    </nav>
  );
}
