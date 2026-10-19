import { useCallback, useSyncExternalStore } from 'react';
import { isFavorite, setFavorite, type FavoriteEntityType } from '@thedex/db';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useUserDataVersion } from '../../shared/db/user-data-events';
import { useAsync } from '../../shared/hooks/useAsync';

let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  version++;
  for (const listener of listeners) listener();
}

/**
 * Changes whenever a favorite is added or removed on this device: screens that list favorites
 * (the favorites screen, the Pokédex filter) put it in their deps, next to `useUserDataVersion`.
 */
export function useFavoritesVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** Whether an entity is a favorite (undefined while loading), and a toggle that saves it. */
export function useFavorite(
  entityType: FavoriteEntityType,
  entityId: number,
): { readonly favorite: boolean | undefined; readonly toggle: () => void } {
  const { db } = useAppDatabase();
  const userData = useUserDataVersion();
  const favorites = useFavoritesVersion();
  const { data } = useAsync(
    () => isFavorite(db, entityType, entityId),
    [db, entityType, entityId, userData, favorites],
  );
  const toggle = useCallback(() => {
    if (data === undefined) return;
    void setFavorite(db, entityType, entityId, !data, Date.now()).then(emit);
  }, [db, entityType, entityId, data]);
  return { favorite: data, toggle };
}
