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
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070b1f' },
    { media: '(prefers-color-scheme: light)', color: '#eef3ff' },
  ],
  colorScheme: 'light dark',
};

// Runs before first paint so the saved or system theme applies without a flash.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);var t=m?m[1]:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <div className="flex flex-1 flex-col">
          <Suspense fallback={null}>{children}</Suspense>
        </div>
        <SiteFooter />
        <CookieBanner />
        <Toaster />
      </body>
    </html>
  );
}
