import {
  getGameFeatures,
  resolveGameContext,
  type GameContext,
  type GameFeatures,
} from '@thedex/db';
import { useAppDatabase } from '../db/DatabaseProvider';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../settings/SettingsProvider';
import { useGame } from './GameProvider';

/**
 * GameContext of a game other than the selected one (a team is built for its own game,
 * RF08.1), in the user's game-data languages. Reuses the global context for the selected game.
 */
export function useGameContextFor(
  gameId: number | null | undefined,
): { ctx: GameContext; features: GameFeatures } | null {
  const { db } = useAppDatabase();
  const global = useGame();
  const { settings } = useSettings();
  const langKey = settings.gameLangs.join(',');
  const same = gameId == null || gameId === global.ctx.gameId;
  const other = useAsync(async () => {
    if (same || gameId == null) return null;
    const ctx = await resolveGameContext(db, gameId, settings.gameLangs);
    return { ctx, features: await getGameFeatures(db, ctx) };
    // langKey stands for settings.gameLangs.
  }, [db, gameId, same, langKey]);
  if (same) return { ctx: global.ctx, features: global.features };
  return other.data && other.data.ctx.gameId === gameId ? other.data : null;
}
