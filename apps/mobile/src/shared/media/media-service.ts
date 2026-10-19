import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import {
  deleteMediaCacheEntries,
  getMediaCacheEntry,
  getMediaCacheStats,
  getMediaPackSizes,
  getItemIcon,
  getMediaSources,
  getPokemonMedia,
  ITEM_ICON_STYLE,
  itemIconCacheKey,
  itemIconSource,
  listItemIcons,
  listMediaAssets,
  listMediaCacheKeys,
  mediaCacheKey,
  mediaUrl,
  putMediaCacheEntry,
  touchMediaCacheEntry,
  type AnySQLiteDatabase,
  type ItemIcon,
  type MediaAsset,
  type MediaCacheStats,
  type MediaPackSize,
  type MediaSource,
} from '@thedex/db';
import {
  cryStyleFor,
  cryVariantFor,
  isCompleteDownload,
  localMediaPath,
  runPool,
} from './media-paths';

const RETRY_AFTER_MS = 30_000;

export interface DownloadProgress {
  readonly done: number;
  readonly total: number;
  readonly failed: number;
}

/** A file to download: a Pokémon asset or an item icon, with its cache key. */
interface MediaFile {
  readonly key: string;
  readonly style: string;
  readonly variant: string;
  readonly path: string;
  readonly bytes: number | null;
}

const assetFile = (asset: MediaAsset): MediaFile => ({ ...asset, key: mediaCacheKey(asset) });
const iconFile = (icon: ItemIcon, source: MediaSource): MediaFile => ({
  key: itemIconCacheKey(icon.itemId),
  style: source.style,
  variant: source.variant,
  path: icon.path,
  bytes: icon.bytes,
});

/**
 * The only way the app gets sprites, cries and item icons (RNF02). Files are downloaded on
 * demand from the pinned PokeAPI/sprites and PokeAPI/cries commits, or the AAC cry pack on iOS
 * (URLs come from media_sources in the game DB, never from code), stored under the document
 * directory (not purged by the OS) and tracked in thedex-user.db `media_cache`. Offline + not
 * cached = null (placeholder UI).
 */
export class MediaService {
  /** Resolved local URIs of this session (avoids a DB round-trip per list row). */
  private readonly memory = new Map<string, string>();
  private readonly inFlight = new Map<string, Promise<string | null>>();
  /** Recent failures (offline, HTTP error): not retried for RETRY_AFTER_MS while scrolling. */
  private readonly failedAt = new Map<string, number>();
  private readonly root = new Directory(Paths.document, 'media');

  private constructor(
    private readonly db: AnySQLiteDatabase,
    private readonly sources: ReadonlyMap<string, MediaSource>,
  ) {}

  static async create(db: AnySQLiteDatabase): Promise<MediaService> {
    const sources = await getMediaSources(db);
    return new MediaService(db, new Map(sources.map((s) => [`${s.style}/${s.variant}`, s])));
  }

  /**
   * Cry style of this platform: iOS cannot decode the `.ogg` cries of PokeAPI/cries, so it
   * plays the AAC pack (`cry-aac`) TheDex transcodes and hosts (CLAUDE.md, "Mídia").
   */
  readonly cryStyle = cryStyleFor(Platform.OS);

  /** False only with a data DB that lacks this platform's cry sources. */
  get canPlayCries(): boolean {
    return [...this.sources.values()].some((source) => source.style === this.cryStyle);
  }

  /** Assets of a variety, keyed `style/variant`. */
  async assetsOf(pokemonId: number): Promise<Map<string, MediaAsset>> {
    const assets = await getPokemonMedia(this.db, pokemonId);
    return new Map(assets.map((asset) => [`${asset.style}/${asset.variant}`, asset]));
  }

  /** Already-resolved sprite URI of this session, synchronously (no flash when scrolling). */
  peekSprite(pokemonId: number, style: string, shiny: boolean): string | null {
    const variant = shiny ? 'shiny' : 'default';
    return this.memory.get(mediaCacheKey({ style, variant, pokemonId })) ?? null;
  }

  /** Already-resolved item icon URI of this session, synchronously. */
  peekItemIcon(itemId: number): string | null {
    return this.memory.get(itemIconCacheKey(itemId)) ?? null;
  }

  /** Local URI of an item icon (RF05.2), downloading it when needed. */
  async itemIcon(itemId: number): Promise<string | null> {
    const source = itemIconSource([...this.sources.values()]);
    const icon = source ? await getItemIcon(this.db, itemId) : null;
    return source && icon ? this.resolveFile(iconFile(icon, source)) : null;
  }

  /** Local URI of a sprite, downloading it when needed. */
  async sprite(pokemonId: number, style: string, shiny: boolean): Promise<string | null> {
    const assets = await this.assetsOf(pokemonId);
    const asset =
      assets.get(`${style}/${shiny ? 'shiny' : 'default'}`) ?? assets.get(`${style}/default`);
    return asset ? this.resolve(asset) : null;
  }

  /** Local URI of the cry that fits the game generation (legacy cries for Gen 1–5 games). */
  async cry(pokemonId: number, generationId: number): Promise<string | null> {
    if (!this.canPlayCries) return null;
    const assets = await this.assetsOf(pokemonId);
    const available = new Set(
      [...assets.values()].filter((a) => a.style === this.cryStyle).map((a) => a.variant),
    );
    const variant = cryVariantFor(generationId, available);
    const asset = variant ? assets.get(`${this.cryStyle}/${variant}`) : undefined;
    return asset ? this.resolve(asset) : null;
  }

  /** Cached URI if present, else download; concurrent calls for one asset share a request. */
  async resolve(asset: MediaAsset): Promise<string | null> {
    return this.resolveFile(assetFile(asset));
  }

  private async resolveFile(file: MediaFile): Promise<string | null> {
    const { key } = file;
    const remembered = this.memory.get(key);
    if (remembered) return remembered;
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.load(file, key).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    return pending;
  }

  private async load(asset: MediaFile, key: string): Promise<string | null> {
    const cached = await getMediaCacheEntry(this.db, key);
    const local = cached ? new File(cached.localUri) : null;
    // A truncated file is downloaded again instead of being served forever.
    if (cached && local?.exists && isCompleteDownload(local.size, asset.bytes)) {
      this.memory.set(key, cached.localUri);
      void touchMediaCacheEntry(this.db, key, Date.now());
      return cached.localUri;
    }
    const failedAt = this.failedAt.get(key);
    if (failedAt !== undefined && Date.now() - failedAt < RETRY_AFTER_MS) return null;
    return this.download(asset, key);
  }

  private async download(asset: MediaFile, key: string): Promise<string | null> {
    const source = this.sources.get(`${asset.style}/${asset.variant}`);
    if (!source) return null;
    const [style, variant, name] = localMediaPath(asset) as [string, string, string];
    const url = mediaUrl(source, asset);
    try {
      const directory = new Directory(this.root, style, variant);
      directory.create({ intermediates: true, idempotent: true });
      const file = await File.downloadFileAsync(url, new File(directory, name), {
        idempotent: true,
      });
      if (!isCompleteDownload(file.size, asset.bytes)) {
        file.delete();
        throw new Error(`Incomplete download: ${url}`);
      }
      const now = Date.now();
      await putMediaCacheEntry(this.db, {
        key,
        kind: asset.style,
        url,
        localUri: file.uri,
        bytes: file.size || asset.bytes || 0,
        etag: null,
        fetchedAt: now,
        lastAccessAt: now,
      });
      this.memory.set(key, file.uri);
      this.failedAt.delete(key);
      return file.uri;
    } catch {
      // Offline or HTTP error: the caller shows a placeholder; retried after a pause.
      this.failedAt.set(key, Date.now());
      return null;
    }
  }

  /** "Download all media packs for offline use" (RNF02), skipping what is cached. */
  async downloadAll(
    styles: readonly string[],
    onProgress: (progress: DownloadProgress) => void,
    signal: { readonly aborted: boolean },
  ): Promise<DownloadProgress> {
    const cached = await listMediaCacheKeys(this.db);
    const files = (await listMediaAssets(this.db, styles)).map(assetFile);
    const iconSource = itemIconSource([...this.sources.values()]);
    if (styles.includes(ITEM_ICON_STYLE) && iconSource) {
      files.push(...(await listItemIcons(this.db)).map((icon) => iconFile(icon, iconSource)));
    }
    const pending = files.filter((file) => !cached.has(file.key));
    let done = 0;
    let failed = 0;
    onProgress({ done, total: pending.length, failed });
    await runPool(
      pending,
      6,
      async (file) => {
        const uri = await this.resolveFile(file);
        done++;
        if (uri === null) failed++;
        onProgress({ done, total: pending.length, failed });
      },
      signal,
    );
    return { done, total: pending.length, failed };
  }

  async packSizes(): Promise<MediaPackSize[]> {
    return getMediaPackSizes(this.db);
  }

  async stats(): Promise<MediaCacheStats> {
    return getMediaCacheStats(this.db);
  }

  /** Deletes every downloaded file and its media_cache rows. */
  async clear(): Promise<void> {
    if (this.root.exists) this.root.delete();
    await deleteMediaCacheEntries(this.db);
    this.memory.clear();
    this.failedAt.clear();
  }
}
