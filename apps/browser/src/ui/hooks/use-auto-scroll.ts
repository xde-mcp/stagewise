import { useCallback, useEffect, useRef } from 'react';

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
  /**
   * Wether to initialize the scroll position to the bottom when the hook is mounted.
   * @default true
   */
  initializeAtBottom?: boolean;
}

export interface UseAutoScrollReturn {
  /**
   * Callback ref to pass to scrollable element or Virtuoso's scrollerRef.
   * Call with the HTMLElement when it becomes available.
   */
  scrollerRef: (element: HTMLElement | Window | null) => void;
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
 * const { scrollerRef, forceEnableAutoScroll } = useAutoScroll();
 *
 * // When user sends a message:
 * forceEnableAutoScroll();
 *
 * // With Virtuoso:
 * return <Virtuoso scrollerRef={scrollerRef} ... />;
 *
 * // Or with a regular scrollable div:
 * return <div ref={scrollerRef}>...</div>;
 * ```
 */
export function useAutoScroll(
  options: UseAutoScrollOptions = {},
): UseAutoScrollReturn {
  const {
    scrollEndThreshold = 80,
    enabled = true,
    initializeAtBottom = true,
  } = options;

  // Store the viewport element directly
  const viewportRef = useRef<HTMLElement | null>(null);
  const isAutoScrollLockedRef = useRef(true);
  const pendingScrollEndOptInRef = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);

  // Scroll to the very bottom
  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, []);

  // Force enable auto-scroll (for external triggers like sending a message)
  // NOTE: Does NOT scroll immediately - just enables auto-scroll.
  // The MutationObserver will scroll when content actually changes.
  // This prevents a "double scroll" where we scroll before new content exists.
  const forceEnableAutoScroll = useCallback(() => {
    isAutoScrollLockedRef.current = true;
    // Don't call scrollToBottom() here - let MutationObserver handle it
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

    const viewport = viewportRef.current;
    if (!viewport) return;

    const distanceFromBottom =
      viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
    if (distanceFromBottom <= scrollEndThreshold) {
      isAutoScrollLockedRef.current = true;
    }
  }, [scrollEndThreshold]);

  // Callback ref that sets up everything when the element is attached
  const scrollerRef = useCallback(
    (element: HTMLElement | Window | null) => {
      // Cleanup previous element
      const prevViewport = viewportRef.current;
      if (prevViewport) {
        prevViewport.removeEventListener('wheel', handleWheel);
        prevViewport.removeEventListener('scrollend', handleScrollEnd);
        observerRef.current?.disconnect();
        observerRef.current = null;
      }

      // Store new element (ignore Window, only accept HTMLElement)
      if (element instanceof HTMLElement) {
        viewportRef.current = element;
      } else {
        viewportRef.current = null;
        return;
      }

      if (!enabled) return;

      const viewport = viewportRef.current;

      // Attach event listeners
      viewport.addEventListener('wheel', handleWheel, { passive: true });
      viewport.addEventListener('scrollend', handleScrollEnd);

      // Setup MutationObserver for auto-scroll on content changes
      // Use requestAnimationFrame to defer scroll, allowing spacer height
      // updates to complete first (prevents flicker where content appears
      // at wrong position for one frame)
      let pendingScrollFrame: number | null = null;
      const observer = new MutationObserver(() => {
        if (!isAutoScrollLockedRef.current) return;
        // Cancel any pending scroll and schedule a new one
        // This batches multiple rapid mutations into a single scroll
        if (pendingScrollFrame !== null)
          cancelAnimationFrame(pendingScrollFrame);

        pendingScrollFrame = requestAnimationFrame(() => {
          pendingScrollFrame = null;
          if (!isAutoScrollLockedRef.current) return;
          scrollToBottom();
        });
      });
      observer.observe(viewport, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      observerRef.current = observer;

      // Initialize scroll position to bottom
      if (initializeAtBottom) {
        // Use rAF to ensure content is rendered
        requestAnimationFrame(() => {
          scrollToBottom();
          isAutoScrollLockedRef.current = true;
        });
      }
    },
    [enabled, initializeAtBottom, handleWheel, handleScrollEnd, scrollToBottom],
  );

  // Sync observer and listeners when `enabled` changes.
  // The scrollerRef callback is only re-invoked when the DOM element changes,
  // not when `enabled` changes, so we need this effect for both teardown
  // (enabled → false) and re-attachment (enabled → true).
  useEffect(() => {
    if (enabled && viewportRef.current) scrollerRef(viewportRef.current);
    else {
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.removeEventListener('wheel', handleWheel);
        viewport.removeEventListener('scrollend', handleScrollEnd);
      }
      observerRef.current?.disconnect();
      observerRef.current = null;
    }
  }, [enabled, scrollerRef, handleWheel, handleScrollEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.removeEventListener('wheel', handleWheel);
        viewport.removeEventListener('scrollend', handleScrollEnd);
      }
      observerRef.current?.disconnect();
    };
  }, [handleWheel, handleScrollEnd]);

  return {
    scrollerRef,
    scrollToBottom,
    forceEnableAutoScroll,
    isAutoScrollEnabled,
  };
}
