import { useId, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@stagewise/stage-ui/lib/utils';

export function BackgroundWithCutout({
  targetElementId = 'dev-app-preview-container',
  className = '',
  borderRadius = 8,
}: {
  targetElementId?: string;
  className?: string;
  borderRadius?: number;
}) {
  const maskId = `cutout-mask-${useId()}`;
  const parentRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    parentWidth: number;
    parentHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    const parentElement = parentRef.current;
    if (!parentElement) return;

    let animationFrameId: number | null = null;
    let lastBounds: typeof bounds = null;

    // Check if bounds have changed
    const boundsEqual = (a: typeof bounds, b: typeof bounds): boolean => {
      if (a === null && b === null) return true;
      if (a === null || b === null) return false;
      return (
        a.x === b.x &&
        a.y === b.y &&
        a.width === b.width &&
        a.height === b.height &&
        a.parentWidth === b.parentWidth &&
        a.parentHeight === b.parentHeight
      );
    };

    const checkBounds = () => {
      const target = document.getElementById(targetElementId);
      const parent = parentRef.current;

      if (!target || !parent) {
        if (lastBounds !== null) {
          lastBounds = null;
          setBounds(null);
        }
        animationFrameId = requestAnimationFrame(checkBounds);
        return;
      }

      const targetRect = target.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();

      const newBounds = {
        x: targetRect.x - parentRect.x,
        y: targetRect.y - parentRect.y,
        width: targetRect.width,
        height: targetRect.height,
        parentWidth: parentRect.width,
        parentHeight: parentRect.height,
      };

      // Only update state if bounds actually changed
      if (!boundsEqual(newBounds, lastBounds)) {
        lastBounds = newBounds;
        setBounds(newBounds);
      }

      animationFrameId = requestAnimationFrame(checkBounds);
    };

    // Start the animation frame loop
    animationFrameId = requestAnimationFrame(checkBounds);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [targetElementId]);

  return (
    <div ref={parentRef} className={cn('absolute inset-0', className)}>
      {bounds && (
        <svg
          width="0"
          height="0"
          className="pointer-events-none absolute"
          style={{ position: 'absolute' }}
        >
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={bounds.parentWidth}
              height={bounds.parentHeight}
            >
              {/* White background - shows orange (use parent dimensions in pixels) */}
              <rect
                x="0"
                y="0"
                width={bounds.parentWidth}
                height={bounds.parentHeight}
                fill="white"
              />
              {/* Black rectangle - hides orange (creates transparent cutout) */}
              <rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                rx={borderRadius}
                ry={borderRadius}
                fill="black"
              />
            </mask>
          </defs>
        </svg>
      )}

      <div
        className="absolute inset-0 bg-background"
        style={{
          mask: bounds ? `url(#${maskId})` : undefined,
          WebkitMask: bounds ? `url(#${maskId})` : undefined,
        }}
      />
    </div>
  );
}
