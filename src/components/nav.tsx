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
    <nav className="flex flex-wrap items-center gap-1 px-4 py-3 w-full" style={{ backgroundColor: '#0f172a' }}>
      <Link href="/dashboard" className="mr-5 flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-square.png" alt="Wellspring" width={34} height={34} className="rounded-lg" />
      </Link>
      {links.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'text-cyan-300 bg-white/10'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
