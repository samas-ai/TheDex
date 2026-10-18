import type { BuildContext } from '../context';

const REGIONAL = ['alola', 'galar', 'hisui', 'paldea'] as const;

/**
 * pokemon_forms.form_kind (RF02.5 tabs). Order matters: the first matching rule wins.
 * - default: default form of a default variety;
 * - mega / primal / gmax / regional_<region> / totem: from the form identifier;
 * - cosmetic: non-default form sharing a variety (Unown letters, Vivillon patterns…);
 * - battle / item: from Showdown form changes (Aegislash, Arceus plates…), else `other`.
 */
export function deriveFormKinds(ctx: BuildContext): void {
  const regional = REGIONAL.map(
    (region) => `WHEN f.form_identifier = '${region}' OR f.form_identifier LIKE '${region}-%'
      THEN 'regional_${region}'`,
  ).join('\n      ');
  ctx.db.exec(`
    UPDATE pokemon_forms AS f SET form_kind = CASE
      WHEN f.is_default = 1 AND (SELECT is_default FROM pokemon p WHERE p.id = f.pokemon_id) = 1
        THEN 'default'
      WHEN f.is_mega = 1 OR f.form_identifier = 'mega' OR f.form_identifier LIKE 'mega-%'
        THEN 'mega'
      WHEN f.form_identifier = 'primal' THEN 'primal'
      WHEN f.form_identifier = 'gmax' OR f.form_identifier LIKE '%-gmax' THEN 'gmax'
      ${regional}
      WHEN f.form_identifier LIKE 'totem%' THEN 'totem'
      WHEN f.is_default = 0 THEN 'cosmetic'
      WHEN EXISTS (SELECT 1 FROM form_changes fc WHERE fc.to_pokemon_id = f.pokemon_id AND fc.kind = 'item')
        THEN 'item'
      WHEN f.is_battle_only = 1 THEN 'battle'
      ELSE 'other' END;`);
  const counts = ctx.all<{ form_kind: string; n: number }>(
    'SELECT form_kind, count(*) AS n FROM pokemon_forms GROUP BY form_kind ORDER BY n DESC',
  );
  ctx.log(`  form_kind: ${counts.map((row) => `${row.form_kind} ${row.n}`).join(', ')}`);
}
