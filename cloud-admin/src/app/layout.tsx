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
      <body style={{ background: '#E8E8E8', minHeight: '100vh' }}>
        {/* Industrial Navigation Bar */}
        <nav
          className="ind-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 32px',
            height: '56px',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#FAFAFA',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            OG Signage
          </span>
        </nav>
        {/* Main content pushed below nav */}
        <main
          style={{ paddingTop: '72px', minHeight: 'calc(100vh - 56px)' }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
