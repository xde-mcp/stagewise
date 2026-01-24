import { IconClipboardArrowInFillDuo18 } from 'nucleo-ui-fill-duo-18';
import {
  IconCheck2Fill18,
  IconColorPaletteFill18,
  IconRefreshClockwiseFill18,
} from 'nucleo-ui-fill-18';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@stagewise/stage-ui/components/collapsible';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@stagewise/stage-ui/lib/utils';
import { Button } from '@stagewise/stage-ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';

function CopyButton({ text, isLight }: { text: string; isLight: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silently fail
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleCopy}
          disabled={!text}
          aria-label="Copy to clipboard"
          className={cn(
            'opacity-60 hover:opacity-100',
            isLight
              ? 'text-black hover:bg-black/10'
              : 'text-white hover:bg-white/10',
          )}
        >
          {copied ? (
            <IconCheck2Fill18 className="size-3" />
          ) : (
            <IconClipboardArrowInFillDuo18 className="size-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy to clipboard</TooltipContent>
    </Tooltip>
  );
}

interface DominantColorsProps {
  tabId: string;
  getScreenshot: (options?: {
    tabId?: string;
    format?: 'png' | 'jpeg' | 'webp';
  }) => Promise<{ success: boolean; data?: string; error?: string }>;
}

interface ColorEntry {
  hex: string;
  r: number;
  g: number;
  b: number;
  count: number;
}

/**
 * Calculate perceived lightness to determine if text should be black or white
 */
function isLightColor(r: number, g: number, b: number): boolean {
  const lightness = (r * 299 + g * 587 + b * 114) / 1000;
  return lightness > 128;
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Yield to main thread to prevent UI blocking
 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Extract dominant colors using frequency counting with purging of rare colors
 * When distinct colors exceed maxDistinct, purge the least frequent half
 */
async function extractDominantColors(
  imageData: ImageData,
  maxColors = 30,
): Promise<ColorEntry[]> {
  const { data } = imageData;
  const maxDistinct = 2000;
  const chunkSize = 10000;

  // Map of color key -> count
  const colorCounts = new Map<
    string,
    { r: number; g: number; b: number; count: number }
  >();

  let processedPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent pixels
    if (a < 128) continue;

    const key = `${r},${g},${b}`;
    const existing = colorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(key, { r, g, b, count: 1 });
    }

    // Purge rare colors when we exceed maxDistinct
    if (colorCounts.size > maxDistinct) {
      // Find median count
      const counts = Array.from(colorCounts.values()).map((c) => c.count);
      counts.sort((a, b) => a - b);
      const medianCount = counts[Math.floor(counts.length / 2)];

      // Remove colors with count below or equal to median
      const keysToDelete: string[] = [];
      for (const [key, value] of Array.from(colorCounts.entries())) {
        if (value.count <= medianCount) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        colorCounts.delete(key);
      }
    }

    processedPixels++;
    if (processedPixels % chunkSize === 0) {
      await yieldToMain();
    }
  }

  // Convert to ColorEntry array and sort by count
  const entries: ColorEntry[] = Array.from(colorCounts.values()).map((c) => ({
    hex: rgbToHex(c.r, c.g, c.b),
    r: c.r,
    g: c.g,
    b: c.b,
    count: c.count,
  }));

  entries.sort((a, b) => b.count - a.count);

  return entries.slice(0, maxColors);
}

export function DominantColors({ tabId, getScreenshot }: DominantColorsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Canvas ref for image processing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Track if we've done the initial load for the current open state
  const hasLoadedRef = useRef(false);

  /**
   * Take a screenshot and extract dominant colors
   */
  const captureAndAnalyze = useCallback(async () => {
    setIsLoading(true);
    const result = await getScreenshot({ tabId, format: 'png' });

    if (!result.success || !result.data) {
      setIsLoading(false);
      return;
    }

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = async () => {
        // Create canvas if needed
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }

        const canvas = canvasRef.current;
        // Use a larger canvas size for accurate color detection
        const maxDim = 500;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setIsLoading(false);
          resolve();
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data and extract colors (up to 30)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const dominantColors = await extractDominantColors(imageData, 30);
        setColors(dominantColors);
        setIsLoading(false);
        resolve();
      };

      img.onerror = () => {
        setIsLoading(false);
        resolve();
      };

      img.src = `data:image/png;base64,${result.data}`;
    });
  }, [getScreenshot, tabId]);

  // Capture once when opened
  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
      return;
    }
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    captureAndAnalyze();
  }, [isOpen, captureAndAnalyze]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  // Determine which colors to display
  const displayColors = showAll ? colors : colors.slice(0, 10);
  const hasMoreColors = colors.length > 10;

  return (
    <Collapsible
      className="rounded-lg border border-derived"
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <CollapsibleTrigger size="condensed">
        <IconColorPaletteFill18 className="inline size-3.5" /> Dominant Colors
      </CollapsibleTrigger>
      <CollapsibleContent className="border-derived-subtle border-t p-2">
        {/* Refresh button */}
        <Button
          variant="secondary"
          size="xs"
          className="mb-2 w-full"
          onClick={captureAndAnalyze}
          disabled={isLoading}
        >
          <IconRefreshClockwiseFill18
            className={cn('size-3', isLoading ? 'animate-spin' : '')}
          />
          {isLoading ? 'Analyzing...' : 'Refresh'}
        </Button>

        {colors.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-1">
              {displayColors.map((color, index) => {
                const isLight = isLightColor(color.r, color.g, color.b);
                return (
                  <div
                    key={`${color.hex}-${index}`}
                    className="flex h-7 items-center justify-center gap-0.5 rounded font-mono text-xs"
                    style={{ backgroundColor: color.hex }}
                  >
                    <span
                      className={cn(
                        'font-medium',
                        isLight ? 'text-black' : 'text-white',
                      )}
                    >
                      {color.hex}
                    </span>
                    <CopyButton text={color.hex} isLight={isLight} />
                  </div>
                );
              })}
            </div>

            {/* Show more/less button */}
            {hasMoreColors && (
              <Button
                variant="ghost"
                size="xs"
                className="mt-2 w-full"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show less' : 'Show more'}
              </Button>
            )}
          </>
        ) : (
          <div className="flex h-20 items-center justify-center text-muted-foreground text-xs">
            Loading...
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
