import { CRIES_SHA, type MediaSourceConfig } from '@thedex/data-pipeline/config';
import type { MediaListing } from '@thedex/data-pipeline/media-listing';
import { describe, expect, it } from 'vitest';
import {
  aacArgs,
  outputName,
  packInputs,
  packListing,
  packReadme,
  packSources,
  runPool,
} from './pack';

describe('packSources', () => {
  it('pairs each cry-aac source with the .ogg directory it is transcoded from', () => {
    const sources = packSources('cries-aac');
    expect(sources.map(({ source }) => `${source.style}/${source.variant}`)).toEqual([
      'cry-aac/latest',
      'cry-aac/legacy',
    ]);
    for (const { source, upstream } of sources) {
      expect(upstream).toMatchObject({ style: 'cry', format: 'ogg', dir: source.dir });
      expect(upstream.pack).toBeUndefined();
    }
  });

  it('rejects packs without an upstream directory or with an unsupported format', () => {
    const orphan: MediaSourceConfig = {
      style: 'cry-aac',
      variant: 'latest',
      repo: 'cries',
      dir: 'cries/pokemon/nowhere',
      format: 'm4a',
      pack: 'cries-aac',
    };
    expect(() => packSources('cries-aac', [orphan])).toThrow(/no upstream source/);
    const upstream = { ...orphan, style: 'cry', format: 'ogg' as const, pack: undefined };
    expect(() => packSources('cries-aac', [upstream, { ...orphan, format: 'gif' }])).toThrow(
      /unsupported format gif/,
    );
    expect(() => packSources('cries-aac', [])).toThrow(/No media source/);
  });
});

describe('packInputs', () => {
  const listing: MediaListing = {
    repos: { cries: CRIES_SHA },
    dirs: {
      'cries/cries/pokemon/latest': [
        ['1.ogg', 10],
        ['25.ogg', 20],
        ['readme.txt', 5],
        ['10001.ogg', 30],
      ],
    },
  };

  it('keeps only `<id>.<format>` files of the upstream directory', () => {
    const latest = packSources('cries-aac')[0]!.upstream;
    expect(packInputs(listing, latest)).toEqual([
      ['1.ogg', 10],
      ['25.ogg', 20],
      ['10001.ogg', 30],
    ]);
  });

  it('asks for data:fetch when the directory is not listed', () => {
    const legacy = packSources('cries-aac')[1]!.upstream;
    expect(() => packInputs(listing, legacy)).toThrow(/pnpm data:fetch/);
  });
});

describe('outputName / aacArgs', () => {
  it('swaps the extension', () => {
    expect(outputName('25.ogg', 'm4a')).toBe('25.m4a');
    expect(outputName('25', 'm4a')).toBe('25.m4a');
  });

  it('encodes AAC-LC 64 kbit/s into an .m4a container, bit-exact and without metadata', () => {
    const args = aacArgs('in.ogg', 'out.part');
    expect(args.slice(-1)).toEqual(['out.part']);
    expect(args.join(' ')).toContain('-i in.ogg -vn -map_metadata -1 -c:a aac -b:a 64k');
    expect(args.join(' ')).toContain('-fflags +bitexact -flags:a +bitexact');
    expect(args.join(' ')).toContain('-f ipod');
  });
});

describe('packListing / packReadme', () => {
  it('writes the data:fetch listing format, keyed by the upstream directories', () => {
    const sources = packSources('cries-aac');
    const listing = packListing([
      {
        source: sources[0]!.source,
        entries: [
          ['10.m4a', 3],
          ['2.m4a', 2],
        ],
      },
      { source: sources[1]!.source, entries: [['1.m4a', 1]] },
    ]);
    expect(listing).toEqual({
      repos: { cries: CRIES_SHA },
      dirs: {
        'cries/cries/pokemon/latest': [
          ['2.m4a', 2],
          ['10.m4a', 3],
        ],
        'cries/cries/pokemon/legacy': [['1.m4a', 1]],
      },
    });
    const readme = packReadme({
      pack: 'cries-aac',
      ffmpegVersion: 'ffmpeg version 9',
      sources,
      listing,
      upstreamUrl: (upstream) => `https://example.invalid/${upstream.dir}`,
    });
    expect(readme).toContain('| `cries/pokemon/latest/` | 2 | 0.0 MB |');
    expect(readme).toContain('ffmpeg version 9');
  });
});

describe('runPool', () => {
  it('runs every item with bounded concurrency', async () => {
    let running = 0;
    let peak = 0;
    const seen: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, async (item) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      seen.push(item);
      running--;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });
});
