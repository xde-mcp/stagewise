import { WebsiteDemo } from '@/components/landing/website-demo';
import { ActionButtons } from '@/components/landing/action-buttons';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stagewise | Eyesight for AI-powered Code Editors',
  description:
    'Stagewise enables coders to connect their AI-powered Code Editor to your browser environment.',
};

export default function Home() {
  return (
    <div className="grid min-h-screen grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 font-[family-name:var(--font-geist-sans)] sm:p-20">
      <main className="row-start-2 flex flex-col items-center gap-[32px] sm:items-start">
        <h1 className="text-balance font-bold text-6xl lg:text-8xl">
          Eyesight for your AI-powered Code Editor
        </h1>
        <ActionButtons />
        <WebsiteDemo />
      </main>
    </div>
  );
}
