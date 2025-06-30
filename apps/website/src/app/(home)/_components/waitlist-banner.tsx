'use client';

import Link from 'next/link';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useEffect, useRef } from 'react';
import {
  FluidSplats,
  type FluidSplatsRef,
} from '@stagewise/ui/components/fluid-splats';

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
  const fluidSplatsRef = useRef<FluidSplatsRef>(null);

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

  // Synchronize fluid splats with banner tilt
  useEffect(() => {
    let lastSplatTime = 0;
    const splatThrottle = 50; // Throttle splats to every 50ms

    const unsubscribeRotateX = springRotateX.on('change', (value) => {
      const currentTime = Date.now();
      if (currentTime - lastSplatTime < splatThrottle) return;

      if (fluidSplatsRef.current && Math.abs(value) > 1) {
        const bannerElement = document.querySelector('#waitlist-banner');
        const bannerRect = bannerElement?.getBoundingClientRect();

        if (bannerRect) {
          lastSplatTime = currentTime;

          // FluidSplats container extends 20px left/right and 10px up/down from banner
          // So banner center in FluidSplats coordinates is:
          const fluidCenterX = window.innerWidth / 2;
          const fluidCenterY = 120; //+ bannerRect.height / 2; // 10px offset from -inset-y-10

          // Opposite force to the tilt direction
          const forceMultiplier = 2.5;
          const forceY =
            value > 0 ? -forceMultiplier * 15 : forceMultiplier * 15; // Opposite to tilt

          fluidSplatsRef.current.splat(
            fluidCenterX + (Math.random() - 0.5) * 100, // Add some randomness
            fluidCenterY + (Math.random() - 0.5) * 50,
            0, // No X force for rotateX changes
            forceY,
            [0.15, 0.08, 0.25], // Purple color
          );
        }
      }
    });

    const unsubscribeRotateY = springRotateY.on('change', (value) => {
      const currentTime = Date.now();
      if (currentTime - lastSplatTime < splatThrottle) return;

      if (fluidSplatsRef.current && Math.abs(value) > 1) {
        const bannerElement = document.querySelector('#waitlist-banner');
        const bannerRect = bannerElement?.getBoundingClientRect();

        if (bannerRect) {
          lastSplatTime = currentTime;

          // FluidSplats container extends 20px left/right and 10px up/down from banner
          // So banner center in FluidSplats coordinates is:
          const fluidCenterX = window.innerWidth / 2;
          const fluidCenterY = 120; //+ bannerRect.height / 2; // 10px offset from -inset-y-10

          // Opposite force to the tilt direction
          const forceMultiplier = 2.5;
          const forceX =
            value > 0 ? -forceMultiplier * 15 : forceMultiplier * 15; // Opposite to tilt

          fluidSplatsRef.current.splat(
            fluidCenterX + (Math.random() - 0.5) * 100, // Add some randomness
            fluidCenterY + (Math.random() - 0.5) * 50,
            forceX,
            0, // No Y force for rotateY changes
            [0.15, 0.08, 0.25], // Purple color
          );
        }
      }
    });

    return () => {
      unsubscribeRotateX();
      unsubscribeRotateY();
    };
  }, [springRotateX, springRotateY]);

  // Scroll-based "blow away" effect
  useEffect(() => {
    let lastScrollTime = 0;
    let lastScrollY = window.scrollY;
    const scrollThrottle = 100; // Throttle to every 100ms
    const scrollThreshold = 20; // Minimum scroll distance to trigger effect

    const handleScroll = () => {
      const currentTime = Date.now();
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY;

      // Only trigger on downward scroll and if enough time has passed
      if (
        scrollDelta > scrollThreshold &&
        currentTime - lastScrollTime > scrollThrottle &&
        fluidSplatsRef.current
      ) {
        const bannerElement = document.querySelector('#waitlist-banner');
        const bannerRect = bannerElement?.getBoundingClientRect();

        if (bannerRect) {
          lastScrollTime = currentTime;

          // Create multiple splats across the banner width to simulate wind
          const numSplats = 8; // Number of splats to create
          const bannerWidth = bannerRect.width;
          const bannerLeft = bannerRect.left;

          for (let i = 0; i < numSplats; i++) {
            // Distribute splats across the banner width
            const splatX =
              bannerLeft +
              (bannerWidth / numSplats) * i +
              bannerWidth / numSplats / 2;
            const fluidX = splatX;
            const fluidY = 120; // Same Y position as other effects

            // Strong upward force with some randomness
            const baseForce = 8000; // Strong upward force
            const forceY = baseForce + (Math.random() - 0.5) * 2000;
            const forceX = (Math.random() - 0.5) * 1000; // Small horizontal randomness

            fluidSplatsRef.current.splat(
              fluidX + (Math.random() - 0.5) * 30, // Small horizontal randomness
              fluidY + (Math.random() - 0.5) * 20, // Small vertical randomness
              forceX,
              forceY,
              [0.1, 0.05, 0.2], // Slightly darker purple for wind effect
            );
          }
        }
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="-translate-x-1/2 fixed top-14 left-1/2 z-50 mt-4 w-[95%] max-w-[1400px] lg:w-auto">
      <div className="relative">
        {/* Fluid splats container - confined to banner area */}
        <div className="-inset-x-20 -inset-y-10 absolute inset-0 overflow-hidden rounded-3xl">
          <FluidSplats
            ref={fluidSplatsRef}
            className="pointer-events-none absolute inset-0"
            style={{ width: '100%', height: '100%' }}
            config={{
              TRANSPARENT: true,
              DENSITY_DISSIPATION: 1,
              VELOCITY_DISSIPATION: 0.2,
              SPLAT_RADIUS: 0.8,
              SPLAT_FORCE: 500000,
              COLOR_UPDATE_SPEED: 1,
              PRESSURE: 0.8,
              CURL: 0,
              DYE_RESOLUTION: 1024,
              SIM_RESOLUTION: 128,
            }}
          />
        </div>

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
    </div>
  );
}
