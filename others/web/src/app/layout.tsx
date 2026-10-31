import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@ui/components/providers';
import '@ui/styles/globals.css';

const NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Dastaan';

export const metadata: Metadata = {
  title: { default: `${NAME} · Committee portal`, template: `%s · ${NAME}` },
  description: 'Requests, approvals and updates for the Dastaan fest committees.',
  icons: { icon: '/brand/favicon.png', apple: '/icons/apple-touch-icon.png' },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Dastaan Committee', statusBarStyle: 'black-translucent' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#120e0a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
