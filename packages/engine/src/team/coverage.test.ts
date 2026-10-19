import { describe, expect, it } from 'vitest';
import { teamDefense, teamOffense, type CoverageMember } from './coverage';

const TEAM: CoverageMember[] = [
  { types: ['fire', 'flying'], moveTypes: ['fire', 'flying', 'fire'] },
  { types: ['water'], ability: 'water-absorb', moveTypes: ['water', 'ice'] },
  { types: ['water', 'flying'], moveTypes: [] },
  { types: ['ghost', 'poison'], ability: 'levitate' },
];

describe('teamDefense (RF08.3)', () => {
  const rows = new Map(teamDefense(TEAM, 9).map((row) => [row.attacking, row]));

  it('has one row per type of the generation', () => {
    expect(rows.size).toBe(18);
    expect(teamDefense(TEAM.slice(0, 2), 1)).toHaveLength(15);
  });

  it('flags 3+ weak members as critical', () => {
    expect(rows.get('electric')).toEqual({
      attacking: 'electric',
      multipliers: [2, 2, 4, 1],
      weak: 3,
      resist: 0,
      immune: 0,
      severity: 'critical',
    });
  });

  it('flags 2 weak members nobody covers as a warning', () => {
    expect(rows.get('rock')).toMatchObject({
      multipliers: [4, 1, 2, 1],
      weak: 2,
      severity: 'warning',
    });
  });

  it('applies ability immunities', () => {
    expect(rows.get('ground')).toMatchObject({
      multipliers: [0, 1, 0, 0],
      immune: 3,
      severity: null,
    });
    expect(rows.get('water')).toMatchObject({
      multipliers: [2, 0, 0.5, 1],
      weak: 1,
      resist: 1,
      immune: 1,
      severity: null,
    });
  });
});

describe('teamOffense (RF08.3)', () => {
  const rows = new Map(teamOffense(TEAM, 9).map((row) => [row.defending, row]));

  it('takes the best damaging move per type and counts super-effective members', () => {
    expect(rows.get('grass')).toEqual({ defending: 'grass', best: 2, superEffective: 2 });
    expect(rows.get('fire')).toEqual({ defending: 'fire', best: 2, superEffective: 1 });
    expect(rows.get('water')).toEqual({ defending: 'water', best: 1, superEffective: 0 });
    expect(rows.get('dragon')).toEqual({ defending: 'dragon', best: 2, superEffective: 1 });
  });

  it('reports null without damaging moves', () => {
    expect(teamOffense([{ types: ['normal'] }], 9).every((row) => row.best === null)).toBe(true);
  });
});
