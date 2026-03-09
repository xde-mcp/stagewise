/**
 * Color conversion utilities for the color picker.
 */

/**
 * Parse a hex color string to RGB values.
 */
export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  return {
    r: Number.parseInt(result[1], 16),
    g: Number.parseInt(result[2], 16),
    b: Number.parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to HSL.
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case rNorm:
      h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
      break;
    case gNorm:
      h = ((bNorm - rNorm) / d + 2) / 6;
      break;
    case bNorm:
      h = ((rNorm - gNorm) / d + 4) / 6;
      break;
    default:
      h = 0;
  }

  return { h, s, l };
}

/**
 * Convert linear RGB to OKLCH.
 * Uses the OKLab color space as an intermediate.
 */
export function rgbToOklch(
  r: number,
  g: number,
  b: number,
): { l: number; c: number; h: number } {
  // Convert sRGB to linear RGB
  const toLinear = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Linear RGB to LMS (using OKLab matrix)
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Cube root
  const l__ = Math.cbrt(l_);
  const m__ = Math.cbrt(m_);
  const s__ = Math.cbrt(s_);

  // LMS to OKLab
  const L = 0.2104542553 * l__ + 0.793617785 * m__ - 0.0040720468 * s__;
  const a = 1.9779984951 * l__ - 2.428592205 * m__ + 0.4505937099 * s__;
  const bVal = 0.0259040371 * l__ + 0.7827717662 * m__ - 0.808675766 * s__;

  // OKLab to OKLCH
  const c = Math.sqrt(a * a + bVal * bVal);
  let h = Math.atan2(bVal, a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return { l: L, c, h };
}

/**
 * Convert RGB values to hex string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert HSL to RGB.
 * h: 0-360, s: 0-100, l: 0-100
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  if (sNorm === 0) {
    const gray = Math.round(lNorm * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  };
}

/**
 * Convert OKLCH to RGB.
 * l: 0-1 (lightness), c: chroma (typically 0-0.4), h: 0-360 (hue)
 */
export function oklchToRgb(
  l: number,
  c: number,
  h: number,
): { r: number; g: number; b: number } {
  // OKLCH to OKLab
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab to LMS
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  // Cube the values
  const l__ = l_ * l_ * l_;
  const m__ = m_ * m_ * m_;
  const s__ = s_ * s_ * s_;

  // LMS to linear RGB
  const lr = +4.0767416621 * l__ - 3.3077115913 * m__ + 0.2309699292 * s__;
  const lg = -1.2684380046 * l__ + 2.6097574011 * m__ - 0.3413193965 * s__;
  const lb = -0.0041960863 * l__ - 0.7034186147 * m__ + 1.707614701 * s__;

  // Linear RGB to sRGB
  const toSrgb = (value: number) => {
    const v = Math.max(0, Math.min(1, value));
    return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };

  return {
    r: Math.round(toSrgb(lr) * 255),
    g: Math.round(toSrgb(lg) * 255),
    b: Math.round(toSrgb(lb) * 255),
  };
}

/**
 * Validate and parse a hex color string.
 * Returns normalized hex (with #) or null if invalid.
 */
export function parseHex(input: string): string | null {
  const cleaned = input.trim().replace(/^#/, '');
  // Support 3-char hex
  if (/^[a-f\d]{3}$/i.test(cleaned)) {
    const expanded = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.toLowerCase()}`;
  }
  // Support 6-char hex
  if (/^[a-f\d]{6}$/i.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }
  return null;
}

/**
 * Format color as RGB string.
 */
export function formatRgb(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Format color as HSL string.
 */
export function formatHsl(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const h = Math.round(hsl.h * 360);
  const s = Math.round(hsl.s * 100);
  const l = Math.round(hsl.l * 100);

  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Format color as OKLCH string.
 */
export function formatOklch(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';

  const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);
  // L is 0-1, display as percentage
  // C is typically 0-0.4 for sRGB gamut
  // H is 0-360 degrees
  const l = (oklch.l * 100).toFixed(1);
  const c = oklch.c.toFixed(3);
  const h = oklch.h.toFixed(1);

  return `oklch(${l}% ${c} ${h})`;
}

export interface ColorFormats {
  hex: string;
  rgb: {
    string: string;
    r: number;
    g: number;
    b: number;
  };
  hsl: {
    string: string;
    h: number;
    s: number;
    l: number;
  };
  oklch: {
    string: string;
    l: string;
    c: string;
    h: string;
  };
}

// Color mode types for internal storage
export type ColorMode = 'hex' | 'rgb' | 'hsl' | 'oklch';

export type HexColor = { mode: 'hex'; value: string };
export type RgbColor = { mode: 'rgb'; r: number; g: number; b: number };
export type HslColor = { mode: 'hsl'; h: number; s: number; l: number };
export type OklchColor = { mode: 'oklch'; l: number; c: number; h: number };

export type InternalColor = HexColor | RgbColor | HslColor | OklchColor;

/**
 * Convert any internal color to RGB values.
 */
export function colorToRgb(color: InternalColor): {
  r: number;
  g: number;
  b: number;
} {
  switch (color.mode) {
    case 'hex': {
      const rgb = hexToRgb(color.value);
      return rgb ?? { r: 0, g: 0, b: 0 };
    }
    case 'rgb':
      return { r: color.r, g: color.g, b: color.b };
    case 'hsl':
      return hslToRgb(color.h, color.s, color.l);
    case 'oklch':
      return oklchToRgb(color.l / 100, color.c, color.h);
  }
}

/**
 * Convert any internal color to hex string for display.
 */
export function colorToHex(color: InternalColor): string {
  if (color.mode === 'hex') return color.value;
  const rgb = colorToRgb(color);
  return rgbToHex(
    Math.max(0, Math.min(255, rgb.r)),
    Math.max(0, Math.min(255, rgb.g)),
    Math.max(0, Math.min(255, rgb.b)),
  );
}

/**
 * Convert any internal color to a specific mode.
 */
export function convertColor(
  color: InternalColor,
  targetMode: ColorMode,
): InternalColor {
  if (color.mode === targetMode) return color;

  const rgb = colorToRgb(color);

  switch (targetMode) {
    case 'hex':
      return {
        mode: 'hex',
        value: rgbToHex(
          Math.max(0, Math.min(255, rgb.r)),
          Math.max(0, Math.min(255, rgb.g)),
          Math.max(0, Math.min(255, rgb.b)),
        ),
      };
    case 'rgb':
      return {
        mode: 'rgb',
        r: Math.max(0, Math.min(255, Math.round(rgb.r))),
        g: Math.max(0, Math.min(255, Math.round(rgb.g))),
        b: Math.max(0, Math.min(255, Math.round(rgb.b))),
      };
    case 'hsl': {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      return {
        mode: 'hsl',
        // Store full precision internally
        h: hsl.h * 360,
        s: hsl.s * 100,
        l: hsl.l * 100,
      };
    }
    case 'oklch': {
      const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);
      return {
        mode: 'oklch',
        // Store full precision internally
        l: oklch.l * 100,
        c: oklch.c,
        h: oklch.h,
      };
    }
  }
}

/**
 * Get the formatted string for a color in its current mode.
 */
export function colorToString(color: InternalColor): string {
  switch (color.mode) {
    case 'hex':
      return color.value;
    case 'rgb':
      return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
    case 'hsl':
      return `hsl(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%)`;
    case 'oklch':
      return `oklch(${color.l.toFixed(1)}% ${color.c.toFixed(3)} ${color.h.toFixed(1)})`;
  }
}

/**
 * Create an internal color from RGB values in the specified mode.
 */
export function rgbToColor(
  r: number,
  g: number,
  b: number,
  mode: ColorMode,
): InternalColor {
  const rgb: RgbColor = { mode: 'rgb', r, g, b };
  return convertColor(rgb, mode);
}

/**
 * Get all color format strings and channel values for a hex color.
 */
export function getColorFormats(hex: string | null): ColorFormats {
  if (!hex) {
    return {
      hex: '',
      rgb: { string: '', r: 0, g: 0, b: 0 },
      hsl: { string: '', h: 0, s: 0, l: 0 },
      oklch: { string: '', l: '0', c: '0', h: '0' },
    };
  }

  const rgbValues = hexToRgb(hex);
  const r = rgbValues?.r ?? 0;
  const g = rgbValues?.g ?? 0;
  const b = rgbValues?.b ?? 0;

  const hslValues = rgbToHsl(r, g, b);
  const hslH = Math.round(hslValues.h * 360);
  const hslS = Math.round(hslValues.s * 100);
  const hslL = Math.round(hslValues.l * 100);

  const oklchValues = rgbToOklch(r, g, b);
  const oklchL = (oklchValues.l * 100).toFixed(1);
  const oklchC = oklchValues.c.toFixed(3);
  const oklchH = oklchValues.h.toFixed(1);

  return {
    hex: hex.toLowerCase(),
    rgb: {
      string: `rgb(${r}, ${g}, ${b})`,
      r,
      g,
      b,
    },
    hsl: {
      string: `hsl(${hslH}, ${hslS}%, ${hslL}%)`,
      h: hslH,
      s: hslS,
      l: hslL,
    },
    oklch: {
      string: `oklch(${oklchL}% ${oklchC} ${oklchH})`,
      l: oklchL,
      c: oklchC,
      h: oklchH,
    },
  };
}
