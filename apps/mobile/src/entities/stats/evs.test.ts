import { describe, expect, it } from 'vitest';
import { evsValid, evTotal, setEv } from './evs';

const zero = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

describe('EVs', () => {
  it('clamps to the per-stat cap and the 510 total', () => {
    let evs = setEv(zero, 'atk', 300, 9);
    expect(evs.atk).toBe(252);
    evs = setEv(evs, 'spe', 252, 9);
    evs = setEv(evs, 'hp', 252, 9);
    expect(evs.hp).toBe(6);
    expect(evTotal(evs)).toBe(510);
    expect(setEv(evs, 'atk', 4.9, 9).atk).toBe(4);
    expect(setEv(zero, 'atk', -3, 9).atk).toBe(0);
    // Gen 3–5 allow 255 per stat; Gen 1–2 have no total.
    expect(setEv(zero, 'atk', 300, 4).atk).toBe(255);
    const gen2 = (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).reduce(
      (acc, stat) => setEv(acc, stat, 252, 2),
      zero,
    );
    expect(evTotal(gen2)).toBe(1512);
  });

  it('validates imported spreads', () => {
    expect(evsValid({ ...zero, atk: 252, spe: 252 }, 9)).toBe(true);
    expect(evsValid({ ...zero, atk: 255 }, 9)).toBe(false);
    expect(evsValid({ ...zero, atk: 252, spe: 252, hp: 252 }, 9)).toBe(false);
    expect(evsValid({ hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 }, 1)).toBe(true);
  });
});
