import type { BuildContext } from '../context';

const IDENTICAL_TO_BASE = `
  EXISTS (
    SELECT 1 FROM pokemon_moves b
    WHERE b.pokemon_id = pokemon_moves.pokemon_id AND b.version_group_id = @base
      AND b.method_id = pokemon_moves.method_id AND b.move_id = pokemon_moves.move_id
      AND b.level = pokemon_moves.level)`;

function dlcPairs(ctx: BuildContext) {
  return ctx.all<{ base: number; dlc: number }>(`
    SELECT b.version_group_id AS base, d.version_group_id AS dlc
    FROM game_version_groups b
    JOIN game_version_groups d ON d.game_id = b.game_id AND d.is_base = 0
    WHERE b.is_base = 1`);
}

/** How many learnset rows the per-game dedupe would remove (reported in manifest.json). */
export function countDedupableLearnsets(ctx: BuildContext): number {
  const count = ctx.db.prepare(
    `SELECT count(*) AS n FROM pokemon_moves WHERE version_group_id = @dlc AND ${IDENTICAL_TO_BASE}`,
  );
  return dlcPairs(ctx).reduce((sum, pair) => sum + (count.get(pair) as { n: number }).n, 0);
}

/**
 * Size fallback (CLAUDE.md, "Orçamento de tamanho"): removes learnset rows of DLC version
 * groups that are identical to the base version group of the same game. Per-game queries
 * (`version_group_id IN game versionGroupIds` + DISTINCT) return exactly the same moves;
 * only per-DLC-version-group queries would change, and the app never issues those.
 */
export function dedupeLearnsetsByGame(ctx: BuildContext): number {
  const pairs = dlcPairs(ctx);
  const remove = ctx.db.prepare(
    `DELETE FROM pokemon_moves WHERE version_group_id = @dlc AND ${IDENTICAL_TO_BASE}`,
  );
  let removed = 0;
  ctx.db.transaction(() => {
    for (const pair of pairs) removed += remove.run(pair).changes;
  })();
  ctx.log(`  pokemon_moves: removed ${removed} DLC rows identical to the base game`);
  return removed;
}
