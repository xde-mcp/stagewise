import { IconChartFill18 } from 'nucleo-ui-fill-18';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@stagewise/stage-ui/components/collapsible';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '@stagewise/stage-ui/lib/utils';
import { Tabs, TabsList } from '@stagewise/stage-ui/components/tabs';
import { Tabs as TabsBase } from '@base-ui/react/tabs';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis } from 'recharts';

type HistogramMode = 'lightness' | 'rgb';

interface HistogramProps {
  tabId: string;
  getScreenshot: (options?: {
    tabId?: string;
    format?: 'png' | 'jpeg' | 'webp';
  }) => Promise<{ success: boolean; data?: string; error?: string }>;
}

// Number of bins for the histogram
const NUM_BINS = 64;

interface HistogramData {
  bin: number;
  lightness: number;
  red: number;
  green: number;
  blue: number;
}

/**
 * Calculate perceived lightness using the formula for relative luminance
 * with gamma correction approximation (sRGB to linear approximation)
 */
function perceivedLightness(r: number, g: number, b: number): number {
  // Using the standard coefficients for perceived brightness
  // This is a common approximation that accounts for human perception
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/**
 * Analyze image data and build histogram bins
 */
function analyzeImageData(imageData: ImageData): HistogramData[] {
  const { data, width, height } = imageData;
  const totalPixels = width * height;

  // Initialize bins
  const lightnessBins = new Array(NUM_BINS).fill(0);
  const redBins = new Array(NUM_BINS).fill(0);
  const greenBins = new Array(NUM_BINS).fill(0);
  const blueBins = new Array(NUM_BINS).fill(0);

  // Sample every Nth pixel for performance (for large images)
  const sampleRate = totalPixels > 100000 ? Math.ceil(totalPixels / 100000) : 1;

  for (let i = 0; i < data.length; i += 4 * sampleRate) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Alpha channel at data[i + 3] - we ignore it

    // Calculate bin index (0-255 -> 0-(NUM_BINS-1))
    const binScale = NUM_BINS / 256;
    const rBin = Math.min(NUM_BINS - 1, Math.floor(r * binScale));
    const gBin = Math.min(NUM_BINS - 1, Math.floor(g * binScale));
    const bBin = Math.min(NUM_BINS - 1, Math.floor(b * binScale));

    // Calculate lightness and its bin
    const l = perceivedLightness(r, g, b);
    const lBin = Math.min(NUM_BINS - 1, Math.floor(l * binScale));

    lightnessBins[lBin]++;
    redBins[rBin]++;
    greenBins[gBin]++;
    blueBins[bBin]++;
  }

  // Normalize to percentages and build data array
  const sampledPixels = Math.ceil(totalPixels / sampleRate);
  const histogramData: HistogramData[] = [];

  for (let i = 0; i < NUM_BINS; i++) {
    histogramData.push({
      bin: i,
      lightness: (lightnessBins[i] / sampledPixels) * 100,
      red: (redBins[i] / sampledPixels) * 100,
      green: (greenBins[i] / sampledPixels) * 100,
      blue: (blueBins[i] / sampledPixels) * 100,
    });
  }

  return histogramData;
}

export function ColorHistogram({ tabId, getScreenshot }: HistogramProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<HistogramMode>('lightness');
  const [histogramData, setHistogramData] = useState<HistogramData[]>([]);

  // Canvas ref for image processing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  /**
   * Take a screenshot and analyze it
   */
  const captureAndAnalyze = useCallback(async () => {
    const result = await getScreenshot({ tabId, format: 'png' });

    if (!result.success || !result.data) {
      return;
    }

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas if needed
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }

        const canvas = canvasRef.current;
        // Use a smaller canvas for faster processing
        const maxDim = 400;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);

        // Get context with willReadFrequently for better performance
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve();
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctxRef.current = ctx;

        // Get image data and analyze
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = analyzeImageData(imageData);
        setHistogramData(data);
        resolve();
      };

      img.onerror = () => {
        resolve();
      };

      img.src = `data:image/png;base64,${result.data}`;
    });
  }, [getScreenshot, tabId]);

  // Capture screenshots periodically when open
  useEffect(() => {
    if (!isOpen) return;

    // Capture immediately when opened
    captureAndAnalyze();

    // Then capture every 500ms
    const intervalId = setInterval(() => {
      captureAndAnalyze();
    }, 500);

    return () => clearInterval(intervalId);
  }, [isOpen, captureAndAnalyze]);

  // Calculate max values for Y-axis scaling
  const maxLightness = useMemo(() => {
    if (histogramData.length === 0) return 10;
    return Math.max(...histogramData.map((d) => d.lightness), 1);
  }, [histogramData]);

  const maxRed = useMemo(() => {
    if (histogramData.length === 0) return 10;
    return Math.max(...histogramData.map((d) => d.red), 1);
  }, [histogramData]);

  const maxGreen = useMemo(() => {
    if (histogramData.length === 0) return 10;
    return Math.max(...histogramData.map((d) => d.green), 1);
  }, [histogramData]);

  const maxBlue = useMemo(() => {
    if (histogramData.length === 0) return 10;
    return Math.max(...histogramData.map((d) => d.blue), 1);
  }, [histogramData]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const handleModeChange = useCallback((value: string | number | null) => {
    setActiveMode(value as HistogramMode);
  }, []);

  return (
    <Collapsible
      className="rounded-lg border border-derived"
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <CollapsibleTrigger size="condensed">
        <IconChartFill18 className="inline size-3.5" /> Histogram
      </CollapsibleTrigger>
      <CollapsibleContent className="border-derived-subtle border-t p-2">
        {/* Tab Switcher */}
        <Tabs
          value={activeMode}
          onValueChange={handleModeChange}
          className="w-full gap-2"
        >
          <TabsList className="grid w-full grid-cols-2 justify-center rounded-full bg-derived-darker-subtle p-0.5">
            <TabsBase.Tab
              value="lightness"
              className={cn(
                'h-full rounded-full p-0.5 font-medium text-xs transition-colors',
                activeMode === 'lightness'
                  ? 'bg-derived-lighter text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Lightness
            </TabsBase.Tab>
            <TabsBase.Tab
              value="rgb"
              className={cn(
                'h-full rounded-full p-0.5 font-medium text-xs transition-colors',
                activeMode === 'rgb'
                  ? 'bg-derived-lighter text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              RGB
            </TabsBase.Tab>
          </TabsList>
        </Tabs>

        {/* Chart */}
        {histogramData.length > 0 ? (
          activeMode === 'lightness' ? (
            <div className="mt-2 h-36 w-full px-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={histogramData}
                  margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="histogramGrayGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-foreground)"
                        stopOpacity={0.6}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-foreground)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="bin" hide padding={{ left: 0, right: 0 }} />
                  <YAxis hide domain={[0, maxLightness]} />
                  <Area
                    type="monotone"
                    dataKey="lightness"
                    stroke="var(--color-foreground)"
                    strokeWidth={1}
                    fill="url(#histogramGrayGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-2 flex h-36 w-full flex-col gap-1 px-3">
              {/* Red channel */}
              <div className="h-1/3 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={histogramData}
                    margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                  >
                    <XAxis dataKey="bin" hide padding={{ left: 0, right: 0 }} />
                    <YAxis hide domain={[0, maxRed]} />
                    <Area
                      type="monotone"
                      dataKey="red"
                      stroke="#ef4444"
                      strokeWidth={1}
                      fill="#ef4444"
                      fillOpacity={0.6}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Green channel */}
              <div className="h-1/3 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={histogramData}
                    margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                  >
                    <XAxis dataKey="bin" hide padding={{ left: 0, right: 0 }} />
                    <YAxis hide domain={[0, maxGreen]} />
                    <Area
                      type="monotone"
                      dataKey="green"
                      stroke="#22c55e"
                      strokeWidth={1}
                      fill="#22c55e"
                      fillOpacity={0.6}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Blue channel */}
              <div className="h-1/3 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={histogramData}
                    margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                  >
                    <XAxis dataKey="bin" hide padding={{ left: 0, right: 0 }} />
                    <YAxis hide domain={[0, maxBlue]} />
                    <Area
                      type="monotone"
                      dataKey="blue"
                      stroke="#3b82f6"
                      strokeWidth={1}
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        ) : (
          <div className="mt-2 flex h-36 w-full items-center justify-center px-3 text-muted-foreground text-xs">
            Loading...
          </div>
        )}

        {/* Percentage axis labels */}
        <div className="mt-0.5 flex h-4 w-full justify-between px-3 text-2xs text-muted-foreground">
          <div className="relative h-full w-0">
            <span className="-translate-x-1/2 absolute left-0">0%</span>
          </div>
          <div className="relative h-full w-0">
            <span className="-translate-x-1/2 absolute left-0">25%</span>
          </div>
          <div className="relative h-full w-0">
            <span className="-translate-x-1/2 absolute left-0">50%</span>
          </div>
          <div className="relative h-full w-0">
            <span className="-translate-x-1/2 absolute left-0">75%</span>
          </div>
          <div className="relative h-full w-0">
            <span className="-translate-x-1/2 absolute left-0">100%</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
