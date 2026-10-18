import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { listGames, resolveGameContext, type GameContext, type GameSummary } from '@thedex/db';
import { useAppDatabase } from '../db/DatabaseProvider';
import { DEFAULT_GAME_IDENTIFIER } from '../settings/settings';
import { useSettings } from '../settings/SettingsProvider';
import { useTheme } from '../theme/ThemeProvider';

interface GameValue {
  /** Explicit context passed to every game-data query (never a hidden global). */
  readonly ctx: GameContext;
  readonly game: GameSummary;
  /** Every curated game, in display order (RF01.2 selector). */
  readonly games: readonly GameSummary[];
  readonly selectGame: (gameId: number) => void;
}

const GameContextReact = createContext<GameValue | null>(null);

/** Resolves the selected game + game-data languages into a GameContext (RF01.2, RNF05). */
export function GameProvider({ children }: { children: ReactNode }) {
  const { db } = useAppDatabase();
  const { settings, updateSettings } = useSettings();
  const theme = useTheme();
  const [games, setGames] = useState<readonly GameSummary[] | null>(null);
  const [ctx, setCtx] = useState<GameContext | null>(null);
  const langKey = settings.gameLangs.join(',');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listGames(db, settings.gameLangs);
      const selected =
        list.find((game) => game.id === settings.gameId) ??
        list.find((game) => game.identifier === DEFAULT_GAME_IDENTIFIER) ??
        list[list.length - 1];
      if (!selected) throw new Error('No games in the game database');
      const resolved = await resolveGameContext(db, selected.id, settings.gameLangs);
      if (cancelled) return;
      setGames(list);
      setCtx(resolved);
    })();
    return () => {
      cancelled = true;
    };
    // langKey stands for settings.gameLangs (a new array on every settings update).
  }, [db, settings.gameId, langKey]);

  const value = useMemo((): GameValue | null => {
    if (!ctx || !games) return null;
    const game = games.find((g) => g.id === ctx.gameId);
    if (!game) return null;
    return { ctx, game, games, selectGame: (gameId) => updateSettings({ gameId }) };
  }, [ctx, games, updateSettings]);

  if (!value) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  return <GameContextReact.Provider value={value}>{children}</GameContextReact.Provider>;
}

export function useGame(): GameValue {
  const value = useContext(GameContextReact);
  if (!value) throw new Error('useGame must be used inside <GameProvider>');
  return value;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
