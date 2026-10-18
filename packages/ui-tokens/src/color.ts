/** `#RRGGBB` color string. Tokens are always opaque 6-digit hex. */
export type HexColor = `#${string}`;

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): value is HexColor {
  return HEX_PATTERN.test(value);
}

function toRgb(color: HexColor): Rgb {
  if (!isHexColor(color)) throw new RangeError(`Invalid color "${color}" (expected #RRGGBB)`);
  const value = Number.parseInt(color.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

function toHex({ r, g, b }: Rgb): HexColor {
  const channel = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase() as HexColor;
}

/** Linear blend: `amount` 0 returns `color`, 1 returns `target`. */
export function mix(color: HexColor, target: HexColor, amount: number): HexColor {
  const from = toRgb(color);
  const to = toRgb(target);
  const t = Math.min(1, Math.max(0, amount));
  return toHex({
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  });
}

/** `rgba()` string for translucent overlays (scrims, pressed states). */
export function withAlpha(color: HexColor, alpha: number): string {
  const { r, g, b } = toRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(color: HexColor): number {
  const { r, g, b } = toRgb(color);
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2.x contrast ratio (1–21). */
export function contrastRatio(a: HexColor, b: HexColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const BLACK: HexColor = '#000000';
export const WHITE: HexColor = '#FFFFFF';

/** Black or white, whichever reads better on `background` (always ≥ 4.58:1). */
export function onColor(background: HexColor): HexColor {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE) ? BLACK : WHITE;
}

/**
 * Shifts `color` toward black or white (whichever increases contrast) in 5% steps until it
 * reaches `minRatio` against `background`. Used for accent text on themed surfaces.
 */
export function ensureContrast(color: HexColor, background: HexColor, minRatio: number): HexColor {
  const target = onColor(background);
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, target, step / 20);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return target;
}
