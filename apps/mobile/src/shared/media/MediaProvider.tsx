import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAppDatabase } from '../db/DatabaseProvider';
import { MediaService } from './media-service';

const MediaContext = createContext<MediaService | null>(null);

export function MediaProvider({ children }: { children: ReactNode }) {
  const { db } = useAppDatabase();
  const [service, setService] = useState<MediaService | null>(null);
  useEffect(() => {
    let cancelled = false;
    void MediaService.create(db).then((created) => {
      if (!cancelled) setService(created);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);
  if (!service) return null;
  return <MediaContext.Provider value={service}>{children}</MediaContext.Provider>;
}

export function useMediaService(): MediaService {
  const service = useContext(MediaContext);
  if (!service) throw new Error('useMediaService must be used inside <MediaProvider>');
  return service;
}

/**
 * Local URI of a sprite (null while loading, or when offline and not cached). Keyed by the
 * request so a recycled list row never shows the previous Pokémon's sprite.
 */
export function useSpriteUri(pokemonId: number, style: string, shiny = false): string | null {
  const media = useMediaService();
  const key = `${pokemonId}/${style}/${shiny ? 1 : 0}`;
  const [state, setState] = useState(() => ({
    key,
    uri: media.peekSprite(pokemonId, style, shiny),
  }));
  useEffect(() => {
    let cancelled = false;
    const peeked = media.peekSprite(pokemonId, style, shiny);
    if (peeked) {
      setState({ key, uri: peeked });
      return;
    }
    void media.sprite(pokemonId, style, shiny).then((uri) => {
      if (!cancelled) setState({ key, uri });
    });
    return () => {
      cancelled = true;
    };
  }, [media, key, pokemonId, style, shiny]);
  return state.key === key ? state.uri : media.peekSprite(pokemonId, style, shiny);
}

/** Local URI of an item icon (null while loading, or when offline and not cached). */
export function useItemIconUri(itemId: number): string | null {
  const media = useMediaService();
  const [state, setState] = useState(() => ({ itemId, uri: media.peekItemIcon(itemId) }));
  useEffect(() => {
    let cancelled = false;
    const peeked = media.peekItemIcon(itemId);
    if (peeked) {
      setState({ itemId, uri: peeked });
      return;
    }
    void media.itemIcon(itemId).then((uri) => {
      if (!cancelled) setState({ itemId, uri });
    });
    return () => {
      cancelled = true;
    };
  }, [media, itemId]);
  return state.itemId === itemId ? state.uri : media.peekItemIcon(itemId);
}
