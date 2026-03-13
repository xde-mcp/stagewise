import {
  IconClipboardArrowInFillDuo18,
  IconEyeDropperFillDuo18,
} from 'nucleo-ui-fill-duo-18';
import { IconEyeDropperOutline18 } from 'nucleo-ui-outline-18';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@stagewise/stage-ui/components/collapsible';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { useEventListener } from '@ui/hooks/use-event-listener';
import { Button } from '@stagewise/stage-ui/components/button';
import { Input } from '@stagewise/stage-ui/components/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { useOverlayAccess, type AccessHandle } from '@ui/contexts';
import { cn } from '@stagewise/stage-ui/lib/utils';
import { usePanelControl } from '../../primitives';
import {
  parseHex,
  colorToHex,
  colorToString,
  convertColor,
  rgbToColor,
  hexToRgb,
  type ColorMode,
  type InternalColor,
} from './color-utils';
import { IconCheck2Fill18 } from 'nucleo-ui-fill-18';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@stagewise/stage-ui/components/tabs';

function CopyButton({ text }: { text: string }) {
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
        >
          {copied ? (
            <IconCheck2Fill18 className="size-3 text-success-solid" />
          ) : (
            <IconClipboardArrowInFillDuo18 className="size-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy to clipboard</TooltipContent>
    </Tooltip>
  );
}

function ChannelInput({
  label,
  value,
  unit,
  onChange,
  onFocusChange,
  min,
  max,
  allowDecimals = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  onChange: (value: number) => void;
  onFocusChange?: (focused: boolean) => void;
  min?: number;
  max?: number;
  allowDecimals?: boolean;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);
  const [isValid, setIsValid] = useState(true);

  // Sync local value when external value changes (but not while focused)
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(value));
      setIsValid(true);
    }
  }, [value, isFocused]);

  const validateAndParse = (raw: string): { valid: boolean; value: number } => {
    const parsed = allowDecimals
      ? Number.parseFloat(raw)
      : Number.parseInt(raw, 10);

    if (Number.isNaN(parsed)) {
      return { valid: false, value: 0 };
    }

    // Check bounds
    if (min !== undefined && parsed < min) {
      return { valid: false, value: parsed };
    }
    if (max !== undefined && parsed > max) {
      return { valid: false, value: parsed };
    }

    return { valid: true, value: parsed };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(unit ?? '', '').trim();
    setLocalValue(raw);

    const result = validateAndParse(raw);
    setIsValid(result.valid);

    // Only notify parent when value is valid - prevents corrupting editing state
    if (result.valid) {
      onChange(result.value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent Enter from triggering form submission or other unwanted behavior
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    setLocalValue(String(value));
    onFocusChange?.(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Reset to actual value on blur
    setLocalValue(String(value));
    setIsValid(true);
    onFocusChange?.(false);
  };

  return (
    <div className="flex flex-1 items-center gap-1">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      <Input
        type="text"
        value={isFocused ? localValue : unit ? `${value}${unit}` : value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          'h-6 flex-1 rounded border px-0.5 text-center font-mono text-xs',
          isValid ? 'border-derived-subtle' : 'border-destructive',
        )}
        onClick={(e) => e.currentTarget.select()}
      />
    </div>
  );
}

interface ColorPickerProps {
  tabId: string;
  getScreenshot: (options?: {
    tabId?: string;
    format?: 'png' | 'jpeg' | 'webp';
  }) => Promise<{ success: boolean; data?: string; error?: string }>;
}

export function ColorPicker({ tabId, getScreenshot }: ColorPickerProps) {
  const { requestAccess, releaseAccess, overlayRef, canGetAccess } =
    useOverlayAccess();

  // Panel control to open the panel when a color is picked while hovering
  const { openPanel, isOpen: isPanelOpen } = usePanelControl();

  // Reference to the current access handle
  const handleRef = useRef<AccessHandle | null>(null);

  // Whether the color picker is armed (waiting for user to pick a color)
  const [isArmed, setIsArmed] = useState(false);

  // The currently picked/previewed color (updated on mouse move)
  const [previewColor, setPreviewColor] = useState<string | null>(null);

  // The final selected color (stored in the active color space)
  const [selectedColor, setSelectedColor] = useState<InternalColor | null>(
    null,
  );

  // Active color mode tab
  const [activeTab, setActiveTab] = useState<ColorMode>('hex');

  // Collapsible state
  const [isExpanded, setIsExpanded] = useState(true);

  // Get hex value for display/preview purposes
  const selectedHex = useMemo(
    () => (selectedColor ? colorToHex(selectedColor) : null),
    [selectedColor],
  );

  const isPreviewedColorLight = useMemo<boolean | null>(() => {
    const color = previewColor ?? selectedHex;
    if (!color) return null;

    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);

    const lightness = (red * 299 + green * 587 + blue * 114) / 1000;
    return lightness > 128;
  }, [previewColor, selectedHex]);

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

    // If the panel is in hover mode, open it fully to keep UI stable during picking
    if (!isPanelOpen) {
      openPanel();
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
          // Set the selected color to the current preview color, converted to active format
          if (previewColorRef.current) {
            const hex = previewColorRef.current;
            const rgb = hexToRgb(hex);
            if (rgb) {
              // Convert picked color to the active color space
              setSelectedColor(rgbToColor(rgb.r, rgb.g, rgb.b, activeTab));
            }
          }

          // Disarm and fully release access
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
    isPanelOpen,
    openPanel,
    activeTab,
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
  // Use capture phase to run before base-ui's ESC handling (which closes the preview card)
  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isArmed) {
        e.preventDefault();
        e.stopPropagation();
        cancelPicking();
      }
    },
    [isArmed, cancelPicking],
  );

  useEventListener('keydown', handleEscapeKey, { capture: true });

  // Continuously refresh screenshot while armed to keep color data accurate
  useEffect(() => {
    if (!isArmed) return;

    const intervalId = setInterval(() => {
      loadScreenshotToCanvas();
    }, 250);

    return () => clearInterval(intervalId);
  }, [isArmed, loadScreenshotToCanvas]);

  // The color to display (preview when armed, selected hex otherwise)
  const displayColor = isArmed ? previewColor : selectedHex;

  // Get the copyable string for current color
  const colorString = useMemo(
    () => (selectedColor ? colorToString(selectedColor) : ''),
    [selectedColor],
  );

  // Get the preview color string in the active color space (for display during picking)
  const previewColorString = useMemo(() => {
    if (!previewColor) return '';
    const rgb = hexToRgb(previewColor);
    if (!rgb) return previewColor;
    const internalColor = rgbToColor(rgb.r, rgb.g, rgb.b, activeTab);
    return colorToString(internalColor);
  }, [previewColor, activeTab]);

  // Handle tab change - convert color to new format
  const handleTabChange = useCallback(
    (value: string | number | null) => {
      const newMode = value as ColorMode;
      setActiveTab(newMode);
      if (selectedColor) {
        setSelectedColor(convertColor(selectedColor, newMode));
      }
    },
    [selectedColor],
  );

  // Update color channel value (works for all modes)
  const updateChannel = useCallback(
    (channel: string, value: number) => {
      if (!selectedColor) return;

      switch (selectedColor.mode) {
        case 'hex':
          // Hex doesn't have individual channels to update
          break;
        case 'rgb':
          setSelectedColor({
            ...selectedColor,
            [channel]: Math.max(0, Math.min(255, Math.round(value))),
          });
          break;
        case 'hsl':
          if (channel === 'h') {
            setSelectedColor({
              ...selectedColor,
              h: Math.max(0, Math.min(360, Math.round(value))),
            });
          } else {
            setSelectedColor({
              ...selectedColor,
              [channel]: Math.max(0, Math.min(100, Math.round(value))),
            });
          }
          break;
        case 'oklch':
          if (channel === 'l') {
            setSelectedColor({
              ...selectedColor,
              l: Math.max(0, Math.min(100, value)),
            });
          } else if (channel === 'c') {
            setSelectedColor({
              ...selectedColor,
              c: Math.max(0, Math.min(0.5, value)),
            });
          } else if (channel === 'h') {
            setSelectedColor({
              ...selectedColor,
              h: Math.max(0, Math.min(360, value)),
            });
          }
          break;
      }
    },
    [selectedColor],
  );

  // Local state for hex input (when in HEX mode)
  const [hexInputValue, setHexInputValue] = useState(selectedHex ?? '');
  const [isHexFocused, setIsHexFocused] = useState(false);
  const [isHexValid, setIsHexValid] = useState(true);

  // Sync hex input when not focused
  useEffect(() => {
    if (!isHexFocused && selectedHex) {
      setHexInputValue(selectedHex);
      setIsHexValid(true);
    }
  }, [selectedHex, isHexFocused]);

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setHexInputValue(value);

      const parsed = parseHex(value);
      setIsHexValid(!!parsed);
      if (parsed) {
        setSelectedColor({ mode: 'hex', value: parsed });
      }
    },
    [],
  );

  return (
    <Collapsible
      className="rounded-lg border border-derived"
      open={isExpanded}
      onOpenChange={setIsExpanded}
    >
      <CollapsibleTrigger size="condensed" className="gap-1">
        <IconEyeDropperOutline18 className="inline size-3.5" /> Color Picker
        <ChevronDownIcon
          className={cn(
            'ml-auto size-3 shrink-0 transition-transform duration-150',
            isExpanded && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-derived-subtle border-t p-2">
        <div className="flex flex-row items-center gap-2">
          {/* Color preview box */}
          <div
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-lg border transition-colors',
              displayColor ? 'border-derived' : 'border-derived-subtle',
            )}
            style={{
              backgroundColor: displayColor ?? 'transparent',
            }}
          >
            {/* Pick button */}
            <Tooltip>
              <TooltipTrigger>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={
                    isArmed ? 'Cancel picking' : 'Pick color from page'
                  }
                  onClick={isArmed ? cancelPicking : startPicking}
                  disabled={!isArmed && !canGetAccess}
                  className={cn(
                    'transition-opacity duration-50 ease-out',
                    isArmed || !displayColor
                      ? 'opacity-100'
                      : 'opacity-20 hover:opacity-100',
                    isPreviewedColorLight === null
                      ? 'text-foreground'
                      : isPreviewedColorLight
                        ? 'text-base-900!'
                        : 'text-base-50!',
                  )}
                >
                  <IconEyeDropperFillDuo18 className={cn('size-5')} />
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

          <div className="flex flex-1 flex-col items-stretch justify-start gap-0.5">
            <div className="flex items-center gap-1">
              <Input
                type="text"
                value={
                  isArmed
                    ? previewColorString
                    : isHexFocused
                      ? hexInputValue
                      : colorString || (selectedHex ?? '')
                }
                onChange={handleHexChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                onFocus={() => {
                  setIsHexFocused(true);
                  setHexInputValue(selectedHex ?? '');
                }}
                onBlur={() => {
                  setIsHexFocused(false);
                  setHexInputValue(selectedHex ?? '');
                  setIsHexValid(true);
                }}
                readOnly={isArmed || activeTab !== 'hex'}
                className={cn(
                  'h-7 flex-1 rounded border px-0.5 text-center font-medium font-mono text-sm',
                  activeTab === 'hex' ? 'uppercase' : '',
                  isHexValid ? 'border-derived-subtle' : 'border-destructive',
                )}
                onClick={(e) => e.currentTarget.select()}
              />
              <CopyButton text={colorString} />
            </div>
            <span className="text-muted-foreground text-xs">
              {isArmed ? 'Select color on page' : 'Selected color'}
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="mt-2 w-full"
        >
          <TabsList className="grid-cols-4">
            <TabsTrigger value="hex">HEX</TabsTrigger>
            <TabsTrigger value="rgb">RGB</TabsTrigger>
            <TabsTrigger value="hsl">HSL</TabsTrigger>
            <TabsTrigger value="oklch">OKLCH</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Channel Inputs - shown based on active tab */}
        {activeTab !== 'hex' && selectedColor && (
          <div className="mt-2 flex gap-3">
            {activeTab === 'rgb' && selectedColor.mode === 'rgb' && (
              <>
                <ChannelInput
                  label="R"
                  value={selectedColor.r}
                  onChange={(v) => updateChannel('r', v)}
                  min={0}
                  max={255}
                />
                <ChannelInput
                  label="G"
                  value={selectedColor.g}
                  onChange={(v) => updateChannel('g', v)}
                  min={0}
                  max={255}
                />
                <ChannelInput
                  label="B"
                  value={selectedColor.b}
                  onChange={(v) => updateChannel('b', v)}
                  min={0}
                  max={255}
                />
              </>
            )}
            {activeTab === 'hsl' && selectedColor.mode === 'hsl' && (
              <>
                <ChannelInput
                  label="H"
                  value={Math.round(selectedColor.h)}
                  unit="°"
                  onChange={(v) => updateChannel('h', v)}
                  min={0}
                  max={360}
                />
                <ChannelInput
                  label="S"
                  value={Math.round(selectedColor.s)}
                  unit="%"
                  onChange={(v) => updateChannel('s', v)}
                  min={0}
                  max={100}
                />
                <ChannelInput
                  label="L"
                  value={Math.round(selectedColor.l)}
                  unit="%"
                  onChange={(v) => updateChannel('l', v)}
                  min={0}
                  max={100}
                />
              </>
            )}
            {activeTab === 'oklch' && selectedColor.mode === 'oklch' && (
              <>
                <ChannelInput
                  label="L"
                  value={Number(selectedColor.l.toFixed(1))}
                  unit="%"
                  onChange={(v) => updateChannel('l', v)}
                  min={0}
                  max={100}
                  allowDecimals
                />
                <ChannelInput
                  label="C"
                  value={Number(selectedColor.c.toFixed(3))}
                  onChange={(v) => updateChannel('c', v)}
                  min={0}
                  max={0.5}
                  allowDecimals
                />
                <ChannelInput
                  label="H"
                  value={Number(selectedColor.h.toFixed(1))}
                  unit="°"
                  onChange={(v) => updateChannel('h', v)}
                  min={0}
                  max={360}
                  allowDecimals
                />
              </>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
