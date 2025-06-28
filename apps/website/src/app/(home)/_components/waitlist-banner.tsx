'use client';

import Link from 'next/link';

export function WaitlistBanner() {
  return (
    <div className="-translate-x-1/2 group fixed top-14 left-1/2 z-50 mt-4 flex h-auto min-h-[3rem] w-[95%] max-w-[1400px] items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-r from-indigo-600/40 to-purple-600/40 p-2 shadow-indigo-500/20 shadow-lg backdrop-blur-xl backdrop-saturate-150 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-r before:from-white/10 before:to-transparent sm:h-12 sm:p-4 lg:w-auto dark:from-indigo-900/40 dark:to-purple-900/40 dark:shadow-purple-500/20">
      <div className="-translate-x-full absolute inset-0 z-10 animate-shine bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform group-hover:animate-shine-fast" />
      <div className="relative z-20 flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-evenly sm:gap-8">
        <span className="text-center text-sm text-white sm:text-left">
          <b>🚀 stagewise is building a frontend coding agent!</b>
        </span>
        <Link
          href="/waitlist"
          className="group/button relative overflow-hidden rounded-lg border border-white/30 bg-white/20 px-3 py-1 font-medium text-sm text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/30"
        >
          <span className="-translate-x-full absolute inset-0 animate-button-shine bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform group-hover/button:animate-button-shine-fast" />
          <span className="relative">Join the waitlist</span>
        </Link>
      </div>
    </div>
  );
}
