import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { StagewiseToolbar } from '@stagewise/toolbar-next';
import { PostHogProvider } from '@/components/posthog-provider';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'stagewise | Eyesight for your AI-powered Code Editor',
  description:
    'stagewise is a browser toolbar that connects your frontend UI to your code AI agents in your code editor. Select elements, leave comments, and let your AI-Agent do the magic.',
  openGraph: {
    title: 'stagewise | Eyesight for your AI-powered Code Editor',
    description:
      'stagewise is a browser toolbar that connects your frontend UI to your code AI agents in your code editor.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'stagewise | Eyesight for your AI-powered Code Editor',
    description:
      'stagewise is a browser toolbar that connects your frontend UI to your code AI agents in your code editor.',
  },
};

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
