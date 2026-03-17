import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OG Signage Admin',
  description: 'Cloud Admin for OG Signage System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-bg-secondary min-h-screen">
        {/* Glassmorphism Navigation Bar */}
        <nav
          className="nav-glass flex items-center px-8"
          style={{ height: '48px' }}
        >
          <span
            className="text-headline"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            OG Signage
          </span>
        </nav>
        {/* Main content pushed below nav */}
        <main
          style={{ paddingTop: '64px', minHeight: 'calc(100vh - 48px)' }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
