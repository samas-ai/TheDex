import { CRY_AAC_STYLE, CRY_STYLE, type MediaAsset } from '@thedex/db';

/** Path of a downloaded asset under the media root: `<style>/<variant>/<file>`. */
export function localMediaPath(asset: Pick<MediaAsset, 'style' | 'variant' | 'path'>): string[] {
  return [asset.style, asset.variant, asset.path];
}

/**
 * Cry variant for a game: the original 8-bit-era cries (`legacy`, Gen 1–5 Pokémon) in games of
 * those generations, else the modern one. Falls back to whatever exists.
 */
export function cryVariantFor(
  generationId: number,
  available: ReadonlySet<string>,
): 'latest' | 'legacy' | null {
  const preferred = generationId <= 5 ? 'legacy' : 'latest';
  if (available.has(preferred)) return preferred;
  if (available.has('latest')) return 'latest';
  return available.has('legacy') ? 'legacy' : null;
}

/** Cry style a platform can decode: iOS has no Ogg decoder, so it gets the AAC pack. */
export function cryStyleFor(os: string): typeof CRY_STYLE | typeof CRY_AAC_STYLE {
  return os === 'ios' ? CRY_AAC_STYLE : CRY_STYLE;
}

/** `1.2 MB`-style size for the media settings. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

/** Runs `task` over `items` with at most `concurrency` in flight; stops early when aborted. */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
  signal?: { readonly aborted: boolean },
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !signal?.aborted) {
      const item = items[next++]!;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

/**
 * Whether a downloaded file is whole: its size matches the pinned listing's when known, else it
 * is not empty. Cut-off downloads (app reloaded, network dropped) would otherwise stay cached
 * and never render.
 */
export function isCompleteDownload(size: number, expectedBytes: number | null): boolean {
  return expectedBytes !== null && expectedBytes > 0 ? size === expectedBytes : size > 0;
}
