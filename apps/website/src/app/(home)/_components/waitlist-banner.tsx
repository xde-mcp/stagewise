'use client';

import Link from 'next/link';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { FluidSimulation, type FluidSimulationAPI } from './fluid-simulation';

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

// Generate more varied colors for particles
function getRandomColor(): [number, number, number] {
  const colors = [
    [0.4, 0.6, 1.0], // Light blue
    [0.6, 0.4, 1.0], // Purple-blue
    [0.8, 0.5, 0.9], // Pink-purple
    [0.5, 0.8, 1.0], // Cyan
    [0.3, 0.7, 0.8], // Teal
    [0.7, 0.6, 1.0], // Lavender
    [0.9, 0.7, 0.8], // Rose
    [0.5, 0.9, 0.7], // Mint
    [0.8, 0.8, 0.5], // Light yellow
    [0.6, 0.8, 0.9], // Sky blue
  ];
  return colors[Math.floor(Math.random() * colors.length)] as [
    number,
    number,
    number,
  ];
}

export function WaitlistBanner({ copy }: { copy: typeof copyA }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const fluidApiRef = useRef<FluidSimulationAPI | null>(null);
  const lastTiltRef = useRef({ x: 0, y: 0 });
  const tiltVelocityRef = useRef({ x: 0, y: 0 });
  const lastTiltTimeRef = useRef(Date.now());
  const bannerRef = useRef<HTMLDivElement>(null);
  const bannerDimensionsRef = useRef({ width: 0, height: 0, aspectRatio: 1 });

  const rotateX = useTransform(mouseY, [-300, 300], [15, -15]);
  const rotateY = useTransform(mouseX, [-300, 300], [-15, 15]);

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 });

  // Update banner dimensions on resize
  useEffect(() => {
    const updateBannerDimensions = () => {
      if (bannerRef.current) {
        const rect = bannerRef.current.getBoundingClientRect();
        bannerDimensionsRef.current = {
          width: rect.width,
          height: rect.height,
          aspectRatio: rect.width / rect.height,
        };
      }
    };

    updateBannerDimensions();
    window.addEventListener('resize', updateBannerDimensions);
    return () => window.removeEventListener('resize', updateBannerDimensions);
  }, []);

  // Create initial fluid effect when component mounts
  useEffect(() => {
    if (fluidApiRef.current && bannerRef.current) {
      const rect = bannerRef.current.getBoundingClientRect();
      const normalizedX = (rect.left + rect.width / 2) / window.innerWidth;
      const normalizedY = (rect.top + rect.height / 2) / window.innerHeight;

      // Update dimensions
      bannerDimensionsRef.current = {
        width: rect.width,
        height: rect.height,
        aspectRatio: rect.width / rect.height,
      };

      // Create initial subtle fluid movement around the banner with more particles
      setTimeout(() => {
        // Distribute more particles based on banner perimeter
        const perimeter = 2 * (rect.width + rect.height);
        const numParticles = Math.max(16, Math.floor(perimeter / 50)); // More particles for larger banners

        for (let i = 0; i < numParticles; i++) {
          // Distribute particles evenly around the perimeter
          const t = i / numParticles;
          const perimeterPos = t * perimeter;

          let x: number;
          let y: number;
          const halfWidth = rect.width / 2;
          const halfHeight = rect.height / 2;

          // Determine position along perimeter
          if (perimeterPos < rect.width) {
            // Top edge
            x = -halfWidth + perimeterPos;
            y = -halfHeight;
          } else if (perimeterPos < rect.width + rect.height) {
            // Right edge
            x = halfWidth;
            y = -halfHeight + (perimeterPos - rect.width);
          } else if (perimeterPos < 2 * rect.width + rect.height) {
            // Bottom edge
            x = halfWidth - (perimeterPos - rect.width - rect.height);
            y = halfHeight;
          } else {
            // Left edge
            x = -halfWidth;
            y = halfHeight - (perimeterPos - 2 * rect.width - rect.height);
          }

          // Add some randomness to position (reduced)
          x += (Math.random() - 0.5) * 10;
          y += (Math.random() - 0.5) * 10;

          // Move spawn points closer to center (reduce by 70%)
          x *= 0.3;
          y *= 0.3;

          // Convert to normalized coordinates
          const particleX = normalizedX + x / window.innerWidth;
          const particleY = 1 - normalizedY - y / window.innerHeight;

          // Random velocity away from banner
          const angle = Math.atan2(y, x) + (Math.random() - 0.5) * 0.5;
          const velocity = 0.003 + Math.random() * 0.004;

          fluidApiRef.current?.splat(
            particleX,
            particleY,
            Math.cos(angle) * velocity,
            -Math.sin(angle) * velocity,
            getRandomColor(),
          );
        }
      }, 500);
    }
  }, [fluidApiRef.current]);

  // Create fluid disturbances based on tilt changes
  useEffect(() => {
    let lastBurstTime = 0;
    const minBurstInterval = 50; // Minimum ms between bursts

    const createBurst = () => {
      const currentTime = Date.now();

      // Prevent too frequent bursts
      if (currentTime - lastBurstTime < minBurstInterval) return;

      if (!fluidApiRef.current || !bannerRef.current) return;

      const rect = bannerRef.current.getBoundingClientRect();
      const normalizedX = (rect.left + rect.width / 2) / window.innerWidth;
      const normalizedY = (rect.top + rect.height / 2) / window.innerHeight;

      // Get current tilt values
      const tiltX = springRotateX.get();
      const tiltY = springRotateY.get();

      // Calculate tilt changes and velocities
      const deltaTime = (currentTime - lastTiltTimeRef.current) / 1000;
      const tiltChangeX = tiltX - lastTiltRef.current.x;
      const tiltChangeY = tiltY - lastTiltRef.current.y;

      if (deltaTime > 0) {
        tiltVelocityRef.current.x = tiltChangeX / deltaTime;
        tiltVelocityRef.current.y = tiltChangeY / deltaTime;
      }

      // Check if there's significant movement
      const totalChange = Math.sqrt(
        tiltChangeX * tiltChangeX + tiltChangeY * tiltChangeY,
      );
      if (totalChange < 0.5) return;

      // Calculate combined velocity magnitude
      const velocityMagnitude = Math.sqrt(
        tiltVelocityRef.current.x * tiltVelocityRef.current.x +
          tiltVelocityRef.current.y * tiltVelocityRef.current.y,
      );

      // Calculate burst direction (opposite of tilt direction)
      // If tilting bottom-left, burst goes top-right
      const tiltAngle = Math.atan2(-tiltChangeX, tiltChangeY);
      const burstAngle = tiltAngle + Math.PI; // Opposite direction

      // Scale burst parameters with velocity
      // Note: SPLAT_FORCE is now applied in the fluid simulation
      const burstForce = Math.min(velocityMagnitude * 0.002, 0.8);
      const numShots = Math.min(Math.floor(velocityMagnitude * 0.05) + 4, 10);

      // Create the burst
      for (let i = 0; i < numShots; i++) {
        const angleVariation = (Math.random() - 0.5) * 0.4; // Cone spread
        const finalAngle = burstAngle + angleVariation;
        const forceVariation = 0.7 + Math.random() * 0.6; // 70-130% of base force

        // Starting position near banner center
        const startX = normalizedX + (Math.random() - 0.5) * 0.03;
        const startY = 1 - normalizedY + (Math.random() - 0.5) * 0.03;

        // Velocity components for directional burst
        const velocityX = Math.cos(finalAngle) * burstForce * forceVariation;
        const velocityY = Math.sin(finalAngle) * burstForce * forceVariation;

        fluidApiRef.current.splat(
          startX,
          startY,
          velocityX,
          velocityY,
          getRandomColor(),
        );
      }

      lastTiltRef.current.x = tiltX;
      lastTiltRef.current.y = tiltY;
      lastTiltTimeRef.current = currentTime;
      lastBurstTime = currentTime;
    };

    const unsubscribeX = springRotateX.on('change', createBurst);
    const unsubscribeY = springRotateY.on('change', createBurst);

    return () => {
      unsubscribeX();
      unsubscribeY();
    };
  }, [springRotateX, springRotateY]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = document
        .querySelector('#waitlist-banner')
        ?.getBoundingClientRect();
      if (!rect) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      mouseX.set(e.clientX - centerX);
      mouseY.set(e.clientY - centerY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <>
      {/* Fluid simulation behind the banner */}
      <div className="pointer-events-none fixed inset-0 z-40">
        <FluidSimulation
          onReady={(api) => {
            fluidApiRef.current = api;
          }}
          config={{
            SIM_RESOLUTION: 256,
            DYE_RESOLUTION: 1024,
            DENSITY_DISSIPATION: 0.85, // Even faster fade out to prevent buildup
            VELOCITY_DISSIPATION: 0.88, // Faster velocity decay for quicker settling
            PRESSURE: 0.8,
            CURL: 35,
            SPLAT_RADIUS: 0.035, // Slightly larger for visible bursts
            SPLAT_FORCE: 8000, // Increased force for burst effect
          }}
        />
      </div>
      {/* /* Banner on top */}
      <motion.div
        ref={bannerRef}
        id="waitlist-banner"
        className="-translate-x-1/2 group fixed top-14 left-1/2 z-50 mt-4 flex h-auto min-h-[3rem] w-[95%] max-w-[1400px] items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-r from-indigo-600/40 to-purple-600/40 p-2 shadow-indigo-500/20 shadow-lg backdrop-blur-xl backdrop-saturate-150 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-r before:from-white/10 before:to-transparent sm:h-12 sm:p-4 lg:w-auto dark:from-indigo-900/40 dark:to-purple-900/40 dark:shadow-purple-500/20"
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
            {/* <span className="-translate-x-full absolute inset-0 animate-button-shine bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform" /> */}
            <span className="-translate-x-full absolute inset-0 animate-button-shine bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform" />
            <span className="relative">{copy.button}</span>
          </Link>
        </div>
      </motion.div>
    </>
  );
}
