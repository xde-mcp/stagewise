import {
  IconEyeDropperFillDuo18,
  IconPalette2FillDuo18,
} from 'nucleo-ui-fill-duo-18';
import { PanelContainer } from '../primitives';
import type { WidgetProps } from './types';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@stagewise/stage-ui/components/collapsible';
import { useKartonProcedure } from '@/hooks/use-karton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@stagewise/stage-ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { useOverlayAccess, type AccessHandle } from '@/contexts';
import { cn } from '@stagewise/stage-ui/lib/utils';

export function ColorToolsWidget({ tab, sortableProps }: WidgetProps) {
  const { isDragging, dragHandleProps } = sortableProps;

  const getScreenshot = useKartonProcedure(
    (p) => p.browser.devTools.getScreenshot,
  );

  return (
    <PanelContainer
      id="color-tools"
      tabUrl={tab.url}
      ariaLabel="Color Tools"
      title="Color Tools"
      icon={<IconPalette2FillDuo18 className="size-5" />}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    >
      <ColorPicker tabId={tab.id} getScreenshot={getScreenshot} />
    </PanelContainer>
  );
}

interface ColorPickerProps {
  tabId: string;
  getScreenshot: (options?: {
    tabId?: string;
    format?: 'png' | 'jpeg' | 'webp';
  }) => Promise<{ success: boolean; data?: string; error?: string }>;
}

function ColorPicker({ tabId, getScreenshot }: ColorPickerProps) {
  const { requestAccess, releaseAccess, overlayRef, canGetAccess } =
    useOverlayAccess();

  // Reference to the current access handle
  const handleRef = useRef<AccessHandle | null>(null);

  // Whether the color picker is armed (waiting for user to pick a color)
  const [isArmed, setIsArmed] = useState(false);

  // The currently picked/previewed color (updated on mouse move)
  const [previewColor, setPreviewColor] = useState<string | null>(null);

  // The final selected color (set on click)
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Offscreen canvas and context for reading pixel colors
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Store the screenshot dimensions for coordinate mapping
  const imageDimensionsRef = useRef<{ width: number; height: number } | null>(
    null,
  );

  // Use ref for previewColor to keep callbacks stable
  const previewColorRef = useRef(previewColor);
  useEffect(() => {
    previewColorRef.current = previewColor;
  }, [previewColor]);

  /**
   * Load a screenshot into the offscreen canvas for pixel reading
   */
  const loadScreenshotToCanvas = useCallback(async () => {
    const result = await getScreenshot({ tabId, format: 'png' });

    if (!result.success || !result.data) {
      console.error('[ColorPicker] Failed to get screenshot:', result.error);
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas if needed
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }

        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;

        // Get context with willReadFrequently for better performance
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(false);
          return;
        }

        ctx.drawImage(img, 0, 0);
        ctxRef.current = ctx;
        imageDimensionsRef.current = { width: img.width, height: img.height };
        resolve(true);
      };

      img.onerror = () => {
        console.error('[ColorPicker] Failed to load screenshot image');
        resolve(false);
      };

      img.src = `data:image/png;base64,${result.data}`;
    });
  }, [getScreenshot, tabId]);

  /**
   * Get the color at a specific position in the canvas
   */
  const getColorAtPosition = useCallback(
    (x: number, y: number): string | null => {
      const ctx = ctxRef.current;
      const dims = imageDimensionsRef.current;
      if (!ctx || !dims) return null;

      // Bounds check
      if (x < 0 || y < 0 || x >= dims.width || y >= dims.height) {
        return null;
      }

      try {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];

        // Return as hex color
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      } catch {
        return null;
      }
    },
    [],
  );

  /**
   * Convert overlay coordinates to canvas coordinates
   */
  const overlayToCanvasCoords = useCallback(
    (overlayX: number, overlayY: number): { x: number; y: number } | null => {
      const overlay = overlayRef.current;
      const imageDims = imageDimensionsRef.current;

      if (!overlay || !imageDims) return null;

      const overlayRect = overlay.getBoundingClientRect();

      // Map overlay coordinates to image coordinates
      const scaleX = imageDims.width / overlayRect.width;
      const scaleY = imageDims.height / overlayRect.height;

      return {
        x: Math.floor(overlayX * scaleX),
        y: Math.floor(overlayY * scaleY),
      };
    },
    [overlayRef],
  );

  /**
   * Start picking a color
   */
  const startPicking = useCallback(async () => {
    // Check if we can get access
    if (!canGetAccess) {
      return;
    }

    // Load a fresh screenshot
    const success = await loadScreenshotToCanvas();
    if (!success) {
      return;
    }

    // Request non-exclusive access with handlers
    const handle = requestAccess({
      exclusive: false,
      cursor: 'crosshair',
      handlers: {
        mousemove: (e) => {
          const overlay = overlayRef.current;
          if (!overlay) return;

          const rect = overlay.getBoundingClientRect();
          const overlayX = e.originalEvent.clientX - rect.left;
          const overlayY = e.originalEvent.clientY - rect.top;

          const canvasCoords = overlayToCanvasCoords(overlayX, overlayY);
          if (!canvasCoords) return;

          const color = getColorAtPosition(canvasCoords.x, canvasCoords.y);
          if (color) {
            setPreviewColor(color);
          }
        },
        click: () => {
          // Set the selected color to the current preview color
          if (previewColorRef.current) {
            setSelectedColor(previewColorRef.current);
          }

          // Disarm and release access
          setIsArmed(false);
          setPreviewColor(null);
          if (handleRef.current) {
            releaseAccess(handleRef.current);
            handleRef.current = null;
          }
        },
      },
    });

    if (handle) {
      handleRef.current = handle;
      setIsArmed(true);
      setPreviewColor(null);
    }
  }, [
    canGetAccess,
    loadScreenshotToCanvas,
    requestAccess,
    releaseAccess,
    overlayRef,
    overlayToCanvasCoords,
    getColorAtPosition,
  ]);

  /**
   * Cancel picking
   */
  const cancelPicking = useCallback(() => {
    setIsArmed(false);
    setPreviewColor(null);
    if (handleRef.current) {
      releaseAccess(handleRef.current);
      handleRef.current = null;
    }
  }, [releaseAccess]);

  // Cancel picking on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isArmed) {
        cancelPicking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isArmed, cancelPicking]);

  // The color to display (preview when armed, selected otherwise)
  const displayColor = isArmed ? previewColor : selectedColor;

  return (
    <Collapsible className="rounded-lg border border-derived">
      <CollapsibleTrigger size="condensed">Color Picker</CollapsibleTrigger>
      <CollapsibleContent className="border-derived-subtle border-t p-2">
        <div className="flex flex-row items-center gap-3">
          {/* Color preview box */}
          <div
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-lg border-2 transition-colors',
              displayColor ? 'border-derived' : 'border-derived-subtle',
            )}
            style={{
              backgroundColor: displayColor ?? 'transparent',
            }}
          >
            {!displayColor && (
              <span className="text-muted-foreground text-xs">?</span>
            )}
          </div>

          {/* Color info and controls */}
          <div className="flex flex-1 flex-col gap-1">
            {displayColor ? (
              <>
                <span className="font-medium font-mono text-sm uppercase">
                  {displayColor}
                </span>
                <span className="text-muted-foreground text-xs">
                  {isArmed ? 'Click to select' : 'Selected color'}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">
                {isArmed ? 'Move mouse over page...' : 'No color selected'}
              </span>
            )}
          </div>

          {/* Pick button */}
          <Tooltip>
            <TooltipTrigger>
              <Button
                size="icon-md"
                aria-label={isArmed ? 'Cancel picking' : 'Pick color from page'}
                onClick={isArmed ? cancelPicking : startPicking}
                disabled={!isArmed && !canGetAccess}
              >
                <IconEyeDropperFillDuo18
                  className={cn('size-5', isArmed && 'animate-pulse')}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isArmed
                ? 'Cancel (Esc)'
                : canGetAccess
                  ? 'Pick color from page'
                  : 'Another tool is using the overlay'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Color value display with copy button */}
        {selectedColor && !isArmed && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={selectedColor}
              className="flex-1 rounded border border-derived-subtle bg-derived/50 px-2 py-1 font-mono text-xs"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(selectedColor)}
            >
              Copy
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
