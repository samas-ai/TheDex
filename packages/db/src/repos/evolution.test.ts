import { describe, expect, it } from 'vitest';
import { resolveEvolutionMethods } from './evolution';

const row = (vg: number | null, extra: { form?: number; region?: number; id?: number } = {}) => ({
  id: extra.id ?? vg,
  evolved_species_id: 700,
  evolved_form_id: extra.form ?? null,
  region_id: extra.region ?? null,
  vg_order: vg,
});

describe('resolveEvolutionMethods', () => {
  it('keeps the latest method introduced up to the game (Sylveon: affection → friendship)', () => {
    const rows = [row(15), row(20)];
    expect(resolveEvolutionMethods(rows, 17, new Set()).map((r) => r.vg_order)).toEqual([15]);
    expect(resolveEvolutionMethods(rows, 25, new Set()).map((r) => r.vg_order)).toEqual([20]);
    expect(resolveEvolutionMethods(rows, 10, new Set())).toEqual([]);
  });

  it('keeps every row of the winning version group (two locations in one game)', () => {
    const rows = [row(8, { id: 1 }), row(17, { id: 2 }), row(17, { id: 3 })];
    expect(resolveEvolutionMethods(rows, 18, new Set()).map((r) => r.id)).toEqual([2, 3]);
  });

  it('applies region-bound tracks only in that region (Alolan Raichu)', () => {
    const rows = [row(1), row(17, { form: 10202, region: 7 })];
    expect(resolveEvolutionMethods(rows, 17, new Set([7])).map((r) => r.vg_order)).toEqual([1, 17]);
    expect(resolveEvolutionMethods(rows, 25, new Set([10])).map((r) => r.vg_order)).toEqual([1]);
  });

  it('treats rows without a version group as always valid', () => {
    expect(resolveEvolutionMethods([row(null)], 1, new Set())).toHaveLength(1);
  });
});
