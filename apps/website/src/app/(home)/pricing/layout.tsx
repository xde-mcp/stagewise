import type { ReactNode } from 'react';

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-zinc-50 py-32 dark:bg-black">
      {children}
    </main>
  );
}
