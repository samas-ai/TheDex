import { describe, expect, it } from 'vitest';
import {
  cryStyleFor,
  cryVariantFor,
  formatBytes,
  isCompleteDownload,
  localMediaPath,
  runPool,
} from './media-paths';

describe('media helpers', () => {
  it('places assets under style/variant', () => {
    expect(localMediaPath({ style: 'official', variant: 'shiny', path: '25.png' })).toEqual([
      'official',
      'shiny',
      '25.png',
    ]);
  });

  it('prefers legacy cries in Gen 1–5 games', () => {
    const both = new Set(['latest', 'legacy']);
    expect(cryVariantFor(1, both)).toBe('legacy');
    expect(cryVariantFor(9, both)).toBe('latest');
    expect(cryVariantFor(3, new Set(['latest']))).toBe('latest');
    expect(cryVariantFor(9, new Set(['legacy']))).toBe('legacy');
    expect(cryVariantFor(9, new Set())).toBeNull();
  });

  it('serves AAC cries on iOS and the .ogg ones elsewhere', () => {
    expect(cryStyleFor('ios')).toBe('cry-aac');
    expect(cryStyleFor('android')).toBe('cry');
    expect(cryStyleFor('web')).toBe('cry');
  });

  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(360_526_333)).toBe('344 MB');
    expect(formatBytes(5 * 1024 ** 4)).toBe('5120 GB');
  });

  it('bounds concurrency and honours aborts', async () => {
    let inFlight = 0;
    let peak = 0;
    const done: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      done.push(n);
      inFlight--;
    });
    expect(peak).toBe(2);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);

    const signal = { aborted: false };
    const seen: number[] = [];
    await runPool(
      [1, 2, 3, 4],
      1,
      async (n) => {
        seen.push(n);
        if (n === 2) signal.aborted = true;
      },
      signal,
    );
    expect(seen).toEqual([1, 2]);
  });
});

describe('isCompleteDownload', () => {
  it('checks the size against the listing, or that the file is not empty', () => {
    expect(isCompleteDownload(1059, 1059)).toBe(true);
    expect(isCompleteDownload(512, 1059)).toBe(false);
    expect(isCompleteDownload(0, 1059)).toBe(false);
    expect(isCompleteDownload(10, null)).toBe(true);
    expect(isCompleteDownload(0, null)).toBe(false);
    expect(isCompleteDownload(10, 0)).toBe(true);
  });
});
