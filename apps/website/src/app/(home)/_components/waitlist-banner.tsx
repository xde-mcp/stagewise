'use client';

import Link from 'next/link';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useEffect } from 'react';

export const copyA = {
  title: 'The 10x Faster Frontend Agent is Coming.',
  button: 'Get Early Access',
};

export const copyB = {
  title: 'An AI agent that anticipates your next UI move.',
  button: 'See it First',
};

export const copyC = {
  title: 'Tired of slow AI? Meet the native stagewise agent.',
  button: 'Join the Private Beta',
};

export const copyD = {
  title: 'The native stagewise agent is coming: 10x faster, zero friction.',
  button: 'Secure Your Spot',
};

export function WaitlistBanner({ copy }: { copy: typeof copyA }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-300, 300], [15, -15]);
  const rotateY = useTransform(mouseX, [-300, 300], [-15, 15]);

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = document
        .querySelector('#waitlist-banner')
        ?.getBoundingClientRect();
      if (!rect) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const newMouseX = e.clientX - centerX;
      const newMouseY = e.clientY - centerY;

      mouseX.set(newMouseX);
      mouseY.set(newMouseY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="-translate-x-1/2 fixed top-14 left-1/2 z-50 mt-4 w-[95%] max-w-[1400px] lg:w-auto">
      <motion.div
        id="waitlist-banner"
        className="group relative flex h-auto min-h-[3rem] items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-r from-indigo-600/40 to-purple-600/40 p-2 shadow-indigo-500/20 shadow-lg backdrop-blur-xl backdrop-saturate-150 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-r before:from-white/10 before:to-transparent sm:h-12 sm:p-4 dark:from-indigo-900/40 dark:to-purple-900/40 dark:shadow-purple-500/20"
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformPerspective: 1000,
          transformStyle: 'preserve-3d',
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="-translate-x-full absolute inset-0 z-10 animate-shine bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform" />
        <div className="relative z-20 flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-evenly sm:gap-8">
          <span className="text-center text-sm text-white sm:text-left">
            {copy.title}
          </span>
          <Link
            href="/waitlist"
            className="group/button relative overflow-hidden rounded-lg border border-white/30 bg-purple-600/20 px-3 py-1 font-medium text-sm text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/30"
          >
            <span className="-translate-x-full absolute inset-0 animate-button-shine bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform" />
            <span className="relative">{copy.button}</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
