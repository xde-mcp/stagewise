import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { StagewiseToolbar } from '@stagewise/toolbar-next';
import { PostHogProvider } from '@/components/posthog-provider';

const inter = Inter({
  subsets: ['latin'],
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <PostHogProvider>
          <StagewiseToolbar config={{ plugins: [] }} />
          <RootProvider>{children}</RootProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
