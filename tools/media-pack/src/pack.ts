import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MEDIA_REPOS,
  MEDIA_SOURCES,
  REPO_ROOT,
  type MediaPack,
  type MediaSourceConfig,
} from '@thedex/data-pipeline/config';
import { listingKey, type MediaListing } from '@thedex/data-pipeline/media-listing';

export const MEDIA_PACK_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
/** Built packs, one directory per pack, laid out exactly as published. */
export const PACK_DIST_DIR = path.join(MEDIA_PACK_ROOT, 'dist');
/** Upstream files downloaded at their pinned commit (reused across runs). */
export const DOWNLOAD_DIR = path.join(REPO_ROOT, '.cache', 'media-pack');

/** A pack source and the upstream source its files are transcoded from. */
export interface PackSource {
  readonly source: MediaSourceConfig;
  readonly upstream: MediaSourceConfig;
}

/** Sources of a pack (`MEDIA_SOURCES` with `pack`), each paired with its upstream directory. */
export function packSources(
  pack: MediaPack,
  sources: readonly MediaSourceConfig[] = MEDIA_SOURCES,
): PackSource[] {
  const result = sources
    .filter((source) => source.pack === pack)
    .map((source) => {
      const upstream = sources.find(
        (s) => !s.pack && s.repo === source.repo && s.dir === source.dir,
      );
      if (!upstream) throw new Error(`${pack}: no upstream source for ${source.dir}`);
      if (source.format !== 'm4a') throw new Error(`${pack}: unsupported format ${source.format}`);
      return { source, upstream };
    });
  if (result.length === 0) throw new Error(`No media source uses the pack ${pack}`);
  return result;
}

/** Upstream files to transcode: the `<pokemon id>.<format>` entries of a listed directory. */
export function packInputs(listing: MediaListing, upstream: MediaSourceConfig): [string, number][] {
  const entries = listing.dirs[listingKey(upstream.repo, upstream.dir)];
  if (!entries) {
    throw new Error(`Media listing lacks ${upstream.repo}/${upstream.dir} — run pnpm data:fetch`);
  }
  const pattern = new RegExp(`^\\d+\\.${upstream.format}$`);
  return entries.filter(([name]) => pattern.test(name));
}

/** `25.ogg` → `25.m4a`. */
export function outputName(input: string, format: string): string {
  const dot = input.lastIndexOf('.');
  return `${dot < 0 ? input : input.slice(0, dot)}.${format}`;
}

/**
 * ffmpeg arguments for one cry: AAC-LC at 64 kbit/s in an `.m4a` (MP4) container, metadata
 * stripped. The bit-exact flags make reruns with the same ffmpeg byte-identical. Inputs are
 * Vorbis or MP3 (despite the `.ogg` name); sample rates AAC lacks (the 10 512 Hz legacy cries)
 * are resampled by ffmpeg to the nearest supported one.
 */
export function aacArgs(input: string, output: string): string[] {
  return [
    '-nostdin',
    '-hide_banner',
    '-v',
    'error',
    '-y',
    '-i',
    input,
    '-vn',
    '-map_metadata',
    '-1',
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    '-movflags',
    '+faststart',
    '-f',
    'ipod',
    output,
  ];
}

const byName = ([a]: [string, number], [b]: [string, number]) =>
  a.localeCompare(b, 'en', { numeric: true });

/**
 * Listing of a built pack, in the format of `pnpm data:fetch`: keyed by the upstream
 * directories, with `repos` recording the upstream commits the files were transcoded from.
 */
export function packListing(
  files: readonly { source: MediaSourceConfig; entries: [string, number][] }[],
): MediaListing {
  const repos: Record<string, string> = {};
  const dirs: MediaListing['dirs'] = {};
  for (const { source, entries } of files) {
    repos[source.repo] = MEDIA_REPOS[source.repo];
    dirs[listingKey(source.repo, source.dir)] = [...entries].sort(byName);
  }
  return { repos, dirs };
}

export interface PackReadmeInput {
  readonly pack: MediaPack;
  readonly ffmpegVersion: string;
  readonly sources: readonly PackSource[];
  readonly listing: MediaListing;
  readonly upstreamUrl: (upstream: MediaSourceConfig) => string;
}

/** README published at the pack root: provenance, encoding and license notice. */
export function packReadme({
  pack,
  ffmpegVersion,
  sources,
  listing,
  upstreamUrl,
}: PackReadmeInput): string {
  const rows = sources.map(({ source, upstream }) => {
    const entries = listing.dirs[listingKey(source.repo, source.dir)] ?? [];
    const bytes = entries.reduce((sum, [, size]) => sum + size, 0);
    return `| \`${source.dir}/\` | ${entries.length} | ${(bytes / 1024 / 1024).toFixed(1)} MB | ${upstreamUrl(upstream)} |`;
  });
  return `# TheDex — pacote \`${pack}\`

Gerado por \`pnpm media:pack\` (\`tools/media-pack\` do TheDex). Não edite à mão.

Os gritos do [PokeAPI/cries](https://github.com/PokeAPI/cries) são \`.ogg\` (Vorbis, alguns MP3),
que o iOS não decodifica. Este pacote traz os mesmos arquivos em AAC-LC 64 kbit/s (\`.m4a\`), com
o mesmo nome (\`<id do Pokémon>.m4a\`) e a mesma estrutura de diretórios do repositório de origem.

| Diretório | Arquivos | Tamanho | Origem |
| --------- | -------- | ------- | ------ |
${rows.join('\n')}

- Encoder: ${ffmpegVersion}
- Comando: \`ffmpeg ${aacArgs('<entrada>.ogg', '<saída>.m4a').join(' ')}\`
- \`listing.json\`: nome e tamanho de cada arquivo (o TheDex versiona uma cópia e confere com \`pnpm media:verify\`).

Os arquivos de origem são CC0, mas os sons são © Nintendo, Creatures Inc. e GAME FREAK inc.
(The Pokémon Company). Pokémon é marca registrada da Nintendo. Este pacote não é oficial nem
afiliado a essas empresas.
`;
}

/** Runs `task` over `items` with at most `concurrency` in flight. */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}
