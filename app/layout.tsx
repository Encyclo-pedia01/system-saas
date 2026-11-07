import type { Metadata, Viewport } from 'next';
import { Suspense, type ReactNode } from 'react';

import { CookieBanner } from '@/components/legal/cookie-banner';
import { SiteFooter } from '@/components/legal/site-footer';
import { Toaster } from '@/components/ui/toaster';
import { siteUrl } from '@/lib/env';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Campus Veritas',
    template: '%s | Campus Veritas',
  },
  description: 'Multi-school management for attendance, grading, and academic insights.',
  icons: { icon: '/icon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#070b1f',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-screen flex-col antialiased">
        <div className="flex flex-1 flex-col">
          <Suspense fallback={null}>{children}</Suspense>
        </div>
        <SiteFooter />
        <Toaster />
        <CookieBanner />
      </body>
    </html>
  );
}
