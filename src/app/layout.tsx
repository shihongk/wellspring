import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/nav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Wellspring',
  description: 'Personal SGD portfolio tracker',
  icons: {
    icon: '/favicon-32.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen text-gray-900`} style={{ backgroundColor: '#f0f9ff' }}>
        <Nav />
        <main className="pl-48 min-h-screen min-w-0">
          <div className="px-6 py-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
