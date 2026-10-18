import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { listStats, listTypes, type NamedEntity } from '@thedex/db';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { capitalize } from '../../shared/format';

interface Catalog {
  /** Battle types of the context generation, in PokeAPI order. */
  readonly types: readonly NamedEntity[];
  /** Localized type name by identifier (game-data language). */
  readonly typeName: (identifier: string) => string;
  /** Localized stat name by identifier (`hp` … `speed`, `special`). */
  readonly statName: (identifier: string) => string;
}

const CatalogContext = createContext<Catalog | null>(null);

/** Small lookup tables every screen needs (type and stat names), loaded per game context. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const { data } = useAsync(
    async () => ({ types: await listTypes(db, ctx), stats: await listStats(db, ctx) }),
    [db, ctx],
  );
  const value = useMemo((): Catalog | null => {
    if (!data) return null;
    const typeNames = new Map(data.types.map((t) => [t.identifier, t.name]));
    const statNames = new Map(data.stats.map((s) => [s.identifier, capitalize(s.name)]));
    return {
      types: data.types,
      typeName: (identifier) => typeNames.get(identifier) ?? capitalize(identifier),
      statName: (identifier) => statNames.get(identifier) ?? capitalize(identifier),
    };
  }, [data]);
  if (!value) return null;
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Catalog {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog must be used inside <CatalogProvider>');
  return value;
}
