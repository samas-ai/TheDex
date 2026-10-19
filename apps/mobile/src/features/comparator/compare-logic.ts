import { assertGeneration, defensiveMultipliers, isTypeName, type TypeName } from '@thedex/engine';

/** Comparator columns (RF10.1): "2 or more", capped so the table stays readable. */
export const MAX_COMPARED = 6;

/** `?ids=6,9,3` → [6, 9, 3]: unique positive integers, at most MAX_COMPARED. */
export function parseCompareIds(param: string | string[] | undefined): number[] {
  const text = Array.isArray(param) ? param.join(',') : (param ?? '');
  const ids: number[] = [];
  for (const part of text.split(',')) {
    const id = Number(part.trim());
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, MAX_COMPARED);
}

/** Positions holding the highest value (highlighted); none unless 2+ values are compared. */
export function bestIndices(values: readonly (number | null)[]): Set<number> {
  const present = values.filter((value): value is number => value !== null);
  if (present.length < 2) return new Set();
  const best = Math.max(...present);
  return new Set(values.flatMap((value, index) => (value === best ? [index] : [])));
}

/** Attacking types that hit a typing super effectively in the generation, ×4 first. */
export function weaknessesOf(
  types: readonly string[],
  generationId: number,
): { type: TypeName; multiplier: number }[] {
  const defending = types.filter(isTypeName);
  if (defending.length === 0) return [];
  const multipliers = defensiveMultipliers(defending, assertGeneration(generationId));
  return (Object.entries(multipliers) as [TypeName, number][])
    .filter(([, multiplier]) => multiplier > 1)
    .map(([type, multiplier]) => ({ type, multiplier }))
    .sort((a, b) => b.multiplier - a.multiplier);
}
