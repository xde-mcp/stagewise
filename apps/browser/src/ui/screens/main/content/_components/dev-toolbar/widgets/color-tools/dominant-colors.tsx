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

// ============================================================================
// Types
// ============================================================================

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
 * Configuration for dominant color extraction
 */
interface ExtractionConfig {
  /** Downsampling factor (e.g., 3 means 3x3 blocks become 1 pixel) */
  downsampleFactor: number;
  /**
   * Minimum number of connected pixels for a region to be counted.
   * Regions smaller than this are ignored (filters out anti-aliased pixels).
   * Default: 5 (a region must have at least 5 connected same-color pixels)
   */
  minRegionSize: number;
  /**
   * Minimum width (in pixels) that a region must span.
   * Filters out thin vertical lines. Default: 2
   */
  minRegionWidth: number;
  /**
   * Minimum height (in pixels) that a region must span.
   * Filters out thin horizontal lines. Default: 2
   */
  minRegionHeight: number;
  /**
   * Color tolerance for considering pixels as "same color" within a region.
   * 0 = exact match only, higher = more tolerant of slight variations.
   */
  colorTolerance: number;
  /**
   * Minimum percentage of screen coverage for a color to be listed.
   * Colors covering less than this percentage of total pixels are filtered out.
   * 0 = no minimum, 1 = at least 1% of screen, etc.
   * Default: 0.1 (0.1% of screen)
   */
  minCoveragePercent: number;
}

const DEFAULT_CONFIG: ExtractionConfig = {
  downsampleFactor: 1,
  minRegionSize: 5,
  minRegionWidth: 2,
  minRegionHeight: 2,
  colorTolerance: 0,
  minCoveragePercent: 0.0,
};

// ============================================================================
// Utility Functions
// ============================================================================

function isLightColor(r: number, g: number, b: number): boolean {
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function simpleColorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.hypot(dr, dg, db);
}

// ============================================================================
// Core Extraction Logic
// ============================================================================

/**
 * Downsample image using mode-based sampling (most common color per block)
 */
async function downsample(
  imageData: ImageData,
  factor: number,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const { data, width, height } = imageData;
  const newWidth = Math.floor(width / factor);
  const newHeight = Math.floor(height / factor);
  const newData = new Uint8ClampedArray(newWidth * newHeight * 4);
  const centerOffset = Math.floor(factor / 2);

  for (let newY = 0; newY < newHeight; newY++) {
    if (newY % 50 === 0) await yieldToMain();

    for (let newX = 0; newX < newWidth; newX++) {
      const colorCounts = new Map<
        string,
        { r: number; g: number; b: number; count: number }
      >();
      let centerColor: { r: number; g: number; b: number } | null = null;

      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const srcI = ((newY * factor + dy) * width + newX * factor + dx) * 4;
          const r = data[srcI];
          const g = data[srcI + 1];
          const b = data[srcI + 2];
          const a = data[srcI + 3];

          if (a < 128) continue;
          if (dx === centerOffset && dy === centerOffset)
            centerColor = { r, g, b };

          const key = `${r},${g},${b}`;
          const existing = colorCounts.get(key);
          if (existing) existing.count++;
          else colorCounts.set(key, { r, g, b, count: 1 });
        }
      }

      let bestColor: { r: number; g: number; b: number } | null = null;
      let bestCount = 0;
      let hasTie = false;

      colorCounts.forEach((c) => {
        if (c.count > bestCount) {
          bestCount = c.count;
          bestColor = { r: c.r, g: c.g, b: c.b };
          hasTie = false;
        } else if (c.count === bestCount) {
          hasTie = true;
        }
      });

      const finalColor = hasTie && centerColor ? centerColor : bestColor;
      const newI = (newY * newWidth + newX) * 4;

      if (finalColor) {
        newData[newI] = finalColor.r;
        newData[newI + 1] = finalColor.g;
        newData[newI + 2] = finalColor.b;
        newData[newI + 3] = 255;
      }
    }
  }

  return { data: newData, width: newWidth, height: newHeight };
}

/**
 * Result of a flood-fill operation including region pixels and bounding box.
 */
interface FloodFillResult {
  /** Linear pixel indices in the region */
  pixels: number[];
  /** Bounding box width (maxX - minX + 1) */
  width: number;
  /** Bounding box height (maxY - minY + 1) */
  height: number;
}

/**
 * Find a connected region of same-colored pixels using flood-fill.
 * Returns the pixel indices and bounding box dimensions.
 *
 * Uses a non-recursive queue-based approach to avoid stack overflow.
 */
function floodFillRegion(
  data: Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
  startX: number,
  startY: number,
  visited: Uint8Array,
  tolerance: number,
): FloodFillResult {
  const startIdx = (startY * imgWidth + startX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];

  const pixels: number[] = [];
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

  // Track bounding box
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  // Mark starting pixel as visited
  visited[startY * imgWidth + startX] = 1;

  while (queue.length > 0) {
    const { x, y } = queue.pop()!;
    const pixelIndex = y * imgWidth + x;
    pixels.push(pixelIndex);

    // Update bounding box
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    // Check 4-connected neighbors (up, down, left, right)
    const neighbors = [
      { nx: x - 1, ny: y },
      { nx: x + 1, ny: y },
      { nx: x, ny: y - 1 },
      { nx: x, ny: y + 1 },
    ];

    for (const { nx, ny } of neighbors) {
      // Bounds check
      if (nx < 0 || nx >= imgWidth || ny < 0 || ny >= imgHeight) continue;

      const neighborLinearIdx = ny * imgWidth + nx;

      // Already visited check
      if (visited[neighborLinearIdx]) continue;

      const neighborIdx = neighborLinearIdx * 4;
      const a = data[neighborIdx + 3];

      // Skip transparent pixels
      if (a < 128) {
        visited[neighborLinearIdx] = 1;
        continue;
      }

      // Check if same color (within tolerance)
      const dist = simpleColorDistance(
        targetR,
        targetG,
        targetB,
        data[neighborIdx],
        data[neighborIdx + 1],
        data[neighborIdx + 2],
      );

      if (dist <= tolerance) {
        visited[neighborLinearIdx] = 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return {
    pixels,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Extract colors by finding connected regions of same-colored pixels.
 *
 * This algorithm:
 * 1. Iterates through all pixels
 * 2. For each unvisited pixel, flood-fills to find all connected same-color pixels
 * 3. Only counts regions that meet all criteria:
 *    - At least minRegionSize pixels
 *    - At least minRegionWidth pixels wide
 *    - At least minRegionHeight pixels tall
 *
 * This naturally excludes anti-aliased pixels because:
 * - Anti-aliased pixels form tiny isolated regions (1-3 pixels)
 * - Solid color areas form large connected regions
 */
async function extractConnectedRegions(
  data: Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
  config: ExtractionConfig,
): Promise<Map<string, { r: number; g: number; b: number; count: number }>> {
  const colorCounts = new Map<
    string,
    { r: number; g: number; b: number; count: number }
  >();

  // Track visited pixels
  const visited = new Uint8Array(imgWidth * imgHeight);

  const minSize = config.minRegionSize;
  const minWidth = config.minRegionWidth;
  const minHeight = config.minRegionHeight;
  const tolerance = config.colorTolerance;

  for (let y = 0; y < imgHeight; y++) {
    // Yield to main thread periodically to keep UI responsive
    if (y % 50 === 0) await yieldToMain();

    for (let x = 0; x < imgWidth; x++) {
      const linearIdx = y * imgWidth + x;

      // Skip already visited pixels
      if (visited[linearIdx]) continue;

      const idx = linearIdx * 4;
      const a = data[idx + 3];

      // Skip transparent pixels
      if (a < 128) {
        visited[linearIdx] = 1;
        continue;
      }

      // Find all connected pixels of the same color
      const region = floodFillRegion(
        data,
        imgWidth,
        imgHeight,
        x,
        y,
        visited,
        tolerance,
      );

      // Only count regions that meet all criteria
      const meetsSize = region.pixels.length >= minSize;
      const meetsWidth = region.width >= minWidth;
      const meetsHeight = region.height >= minHeight;

      if (meetsSize && meetsWidth && meetsHeight) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const key = `${r},${g},${b}`;

        const existing = colorCounts.get(key);
        if (existing) {
          existing.count += region.pixels.length;
        } else {
          colorCounts.set(key, { r, g, b, count: region.pixels.length });
        }
      }
    }
  }

  return colorCounts;
}

/**
 * Extract dominant colors using connected region detection.
 *
 * This algorithm works by:
 * 1. Optionally downsampling the image for performance
 * 2. Finding all connected regions of same-colored pixels (flood-fill)
 * 3. Only counting regions that have at least minRegionSize pixels
 * 4. Filtering colors that don't meet the minimum screen coverage percentage
 * 5. This naturally excludes anti-aliased pixels which form tiny isolated regions
 */
async function extractDominantColors(
  imageData: ImageData,
  maxColors = 30,
  config: ExtractionConfig = DEFAULT_CONFIG,
): Promise<ColorEntry[]> {
  const { data, width, height } = await downsample(
    imageData,
    config.downsampleFactor,
  );

  // Extract colors from connected regions meeting the minimum size
  const regionColors = await extractConnectedRegions(
    data,
    width,
    height,
    config,
  );

  // Calculate total pixels for percentage calculation
  const totalPixels = width * height;
  const minPixelsForCoverage = (config.minCoveragePercent / 100) * totalPixels;

  return Array.from(regionColors.values())
    .filter((c) => c.count >= minPixelsForCoverage)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map((c) => ({
      hex: rgbToHex(c.r, c.g, c.b),
      r: c.r,
      g: c.g,
      b: c.b,
      count: c.count,
    }));
}

// ============================================================================
// UI Components
// ============================================================================

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

export function DominantColors({ tabId, getScreenshot }: DominantColorsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasLoadedRef = useRef(false);

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
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }

        const canvas = canvasRef.current;
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

  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
      return;
    }
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    captureAndAnalyze();
  }, [isOpen, captureAndAnalyze]);

  const displayColors = showAll ? colors : colors.slice(0, 10);
  const hasMoreColors = colors.length > 10;

  return (
    <Collapsible
      className="rounded-lg border border-derived"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <CollapsibleTrigger size="condensed">
        <IconColorPaletteFill18 className="inline size-3.5" /> Dominant Colors
      </CollapsibleTrigger>
      <CollapsibleContent className="border-derived-subtle border-t p-2">
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
                const light = isLightColor(color.r, color.g, color.b);
                return (
                  <div
                    key={`${color.hex}-${index}`}
                    className="flex h-7 items-center justify-center gap-0.5 rounded font-mono text-xs"
                    style={{ backgroundColor: color.hex }}
                  >
                    <span
                      className={cn(
                        'font-medium',
                        light ? 'text-black' : 'text-white',
                      )}
                    >
                      {color.hex}
                    </span>
                    <CopyButton text={color.hex} isLight={light} />
                  </div>
                );
              })}
            </div>

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
