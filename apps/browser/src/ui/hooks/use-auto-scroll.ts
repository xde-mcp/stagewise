import { useCallback, useEffect, useRef } from 'react';
import type { OverlayScrollbarRef } from '@stagewise/stage-ui/components/overlay-scrollbar';

export interface UseAutoScrollOptions {
  /**
   * Threshold in pixels from bottom to consider "at bottom" for opt-in.
   * @default 80
   */
  scrollEndThreshold?: number;
  /**
   * Whether auto-scroll is enabled. When false, MutationObserver and
   * listeners are not attached. Useful for collapsible containers.
   * @default true
   */
  enabled?: boolean;
}

export interface UseAutoScrollReturn {
  /** Ref to pass to OverlayScrollbar component */
  scrollbarRef: React.RefObject<OverlayScrollbarRef | null>;
  /** Manually scroll to the bottom of the container */
  scrollToBottom: () => void;
  /** Force enable auto-scroll (e.g., when user sends a message) */
  forceEnableAutoScroll: () => void;
  /** Check if auto-scroll is currently enabled */
  isAutoScrollEnabled: () => boolean;
}

/**
 * Hook for managing auto-scroll behavior in scrollable containers.
 *
 * Features:
 * - Auto-scrolls to bottom when content changes (via MutationObserver)
 * - Wheel up: immediately opts out of auto-scroll
 * - Wheel down + scrollend: opts back in if near bottom
 * - Exposes `forceEnableAutoScroll` for external triggers (e.g., sending a message)
 *
 * @example
 * ```tsx
 * const { scrollbarRef, forceEnableAutoScroll } = useAutoScroll();
 *
 * // When user sends a message:
 * forceEnableAutoScroll();
 *
 * return <OverlayScrollbar ref={scrollbarRef}>...</OverlayScrollbar>;
 * ```
 */
export function useAutoScroll(
  options: UseAutoScrollOptions = {},
): UseAutoScrollReturn {
  const { scrollEndThreshold = 80, enabled = true } = options;

  const scrollbarRef = useRef<OverlayScrollbarRef>(null);
  const isAutoScrollLockedRef = useRef(true);
  const pendingScrollEndOptInRef = useRef(false);

  // Scroll to the very bottom
  const scrollToBottom = useCallback(() => {
    const viewport = scrollbarRef.current?.getViewport();
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, []);

  // Force enable auto-scroll (for external triggers like sending a message)
  const forceEnableAutoScroll = useCallback(() => {
    isAutoScrollLockedRef.current = true;
  }, []);

  // Check if auto-scroll is currently enabled
  const isAutoScrollEnabled = useCallback(() => {
    return isAutoScrollLockedRef.current;
  }, []);

  // Handle wheel events for immediate opt-in/opt-out
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.deltaY < 0) {
      // Scrolling UP → immediate opt-out
      isAutoScrollLockedRef.current = false;
      pendingScrollEndOptInRef.current = false;
    } else if (e.deltaY > 0) {
      // Scrolling DOWN → mark pending opt-in, will be handled by scrollend
      pendingScrollEndOptInRef.current = true;
    }
  }, []);

  // Handle scrollend event for opt-in after scroll animation completes
  const handleScrollEnd = useCallback(() => {
    if (!pendingScrollEndOptInRef.current) return;
    pendingScrollEndOptInRef.current = false;

    const viewport = scrollbarRef.current?.getViewport();
    if (!viewport) return;

    const distanceFromBottom =
      viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
    if (distanceFromBottom <= scrollEndThreshold) {
      isAutoScrollLockedRef.current = true;
    }
  }, [scrollEndThreshold]);

  // MutationObserver: auto-scroll when DOM content changes
  useEffect(() => {
    if (!enabled) return;

    let rafId: number;
    let observer: MutationObserver | null = null;

    const setupObserver = () => {
      const viewport = scrollbarRef.current?.getViewport();
      if (!viewport) {
        rafId = requestAnimationFrame(setupObserver);
        return;
      }

      observer = new MutationObserver(() => {
        if (isAutoScrollLockedRef.current) scrollToBottom();
      });

      observer.observe(viewport, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };

    setupObserver();

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [scrollToBottom, enabled]);

  // Attach wheel and scrollend listeners to viewport
  useEffect(() => {
    if (!enabled) return;

    let rafId: number;

    const setupListeners = () => {
      const viewport = scrollbarRef.current?.getViewport();
      if (!viewport) {
        rafId = requestAnimationFrame(setupListeners);
        return;
      }
      viewport.addEventListener('wheel', handleWheel, { passive: true });
      viewport.addEventListener('scrollend', handleScrollEnd);
    };

    setupListeners();

    return () => {
      cancelAnimationFrame(rafId);
      const viewport = scrollbarRef.current?.getViewport();
      viewport?.removeEventListener('wheel', handleWheel);
      viewport?.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [handleWheel, handleScrollEnd, enabled]);

  // Initialize scroll position to bottom when enabled
  useEffect(() => {
    if (!enabled) return;

    let rafId: number;

    const initializeScroll = () => {
      const viewport = scrollbarRef.current?.getViewport();
      if (!viewport) {
        rafId = requestAnimationFrame(initializeScroll);
        return;
      }
      scrollToBottom();
      isAutoScrollLockedRef.current = true;
    };

    initializeScroll();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [scrollToBottom, enabled]);

  return {
    scrollbarRef,
    scrollToBottom,
    forceEnableAutoScroll,
    isAutoScrollEnabled,
  };
}
