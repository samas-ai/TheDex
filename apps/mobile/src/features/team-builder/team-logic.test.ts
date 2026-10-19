import { describe, expect, it } from 'vitest';
import { exportShowdownSet, parseShowdownSets } from '@thedex/engine';
import { newTeamMember, type MoveSummary, type PokemonAbility, type TeamMember } from '@thedex/db';
import {
  coverageMembers,
  fromShowdownSet,
  gameForFormat,
  genderOptions,
  HIDDEN_POWER_TYPES,
  illegalMoves,
  moveClassFor,
  moveSlots,
  moveTypeFor,
  setMove,
  showdownIdsOf,
  showdownNamesOf,
  slotDefaults,
  toShowdownSet,
  withSlotDefaults,
} from './team-logic';

const ability = (id: number, identifier: string, isHidden = false): PokemonAbility => ({
  id,
  identifier,
  name: identifier,
  slot: isHidden ? 3 : 1,
  isHidden,
});
const move = (id: number, type: string, damageClass: string): MoveSummary => ({
  id,
  identifier: `move-${id}`,
  name: `Move ${id}`,
  type,
  damageClass,
  power: 80,
  accuracy: 100,
  pp: 10,
});

describe('slot options', () => {
  it('derives genders from the gender rate', () => {
    expect(genderOptions(4, 1)).toEqual(['']);
    expect(genderOptions(-1, 9)).toEqual(['']);
    expect(genderOptions(0, 9)).toEqual(['M']);
    expect(genderOptions(8, 9)).toEqual(['F']);
    expect(genderOptions(1, 9)).toEqual(['', 'M', 'F']);
  });

  it('defaults to the first regular ability and the only gender', () => {
    const abilities = [ability(9, 'static'), ability(31, 'lightning-rod', true)];
    expect(slotDefaults(abilities, 4, 9)).toEqual({ abilityId: 9, gender: '' });
    expect(slotDefaults([ability(31, 'x', true)], 8, 9)).toEqual({ abilityId: 31, gender: 'F' });
    expect(slotDefaults(abilities, -1, 2)).toEqual({ abilityId: null, gender: '' });
    expect(slotDefaults([], 0, 9)).toEqual({ abilityId: null, gender: 'M' });
  });

  it('fills only the missing ability and gender of an imported slot', () => {
    const imported = { ...newTeamMember(94), abilityId: null, gender: '' as const };
    expect(withSlotDefaults(imported, { abilityId: 26, gender: 'M' })).toMatchObject({
      abilityId: 26,
      gender: 'M',
    });
    expect(
      withSlotDefaults({ ...imported, abilityId: 9, gender: 'F' }, { abilityId: 26, gender: '' }),
    ).toMatchObject({ abilityId: 9, gender: 'F' });
  });

  it('keeps four move slots and moves duplicates', () => {
    expect(moveSlots({ moveIds: [85] })).toEqual([85, null, null, null]);
    expect(setMove({ moveIds: [85, 53] }, 2, 85)).toEqual([null, 53, 85, null]);
    expect(setMove({ moveIds: [85, 53] }, 1, null)).toEqual([85, null, null, null]);
    expect(illegalMoves({ moveIds: [85, null, 53] }, new Set([85]))).toEqual([53]);
  });
});

describe('Hidden Power', () => {
  const hiddenPower = { ...move(237, 'normal', 'special'), identifier: 'hidden-power' };

  it('hits with the chosen type, and its category follows the type in Gen 1–3', () => {
    expect(moveTypeFor(hiddenPower, { hpType: 'bug' })).toBe('bug');
    expect(moveTypeFor(hiddenPower, { hpType: null })).toBe('normal');
    expect(moveTypeFor(move(85, 'electric', 'special'), { hpType: 'bug' })).toBe('electric');
    expect(moveClassFor(hiddenPower, { hpType: 'bug' }, 3)).toBe('physical');
    expect(moveClassFor(hiddenPower, { hpType: 'fire' }, 3)).toBe('special');
    expect(moveClassFor(hiddenPower, { hpType: 'bug' }, 4)).toBe('special');
    expect(HIDDEN_POWER_TYPES).not.toContain('normal');
    expect(HIDDEN_POWER_TYPES).not.toContain('fairy');
    expect(HIDDEN_POWER_TYPES).toHaveLength(16);
  });

  it('counts the chosen type in the offensive coverage', () => {
    const member: TeamMember = { ...newTeamMember(248), moveIds: [237], hpType: 'bug' };
    const info = new Map([[248, { types: ['rock', 'dark'], abilities: [] }]]);
    expect(
      coverageMembers([member], info, new Map([[237, hiddenPower]]))[0]?.coverage.moveTypes,
    ).toEqual(['bug']);
  });
});

describe('coverageMembers', () => {
  it('maps typings, abilities and damaging move types', () => {
    const gengar: TeamMember = { ...newTeamMember(94), abilityId: 26, moveIds: [1, 2, 3, null] };
    const unknown = newTeamMember(9999);
    const info = new Map([
      [94, { types: ['ghost', 'poison'], abilities: [ability(26, 'levitate')] }],
      [9999, { types: ['shadow'], abilities: [] }],
    ]);
    const moves = new Map([
      [1, move(1, 'ghost', 'special')],
      [2, move(2, 'psychic', 'status')],
    ]);
    expect(coverageMembers([gengar, unknown], info, moves)).toEqual([
      {
        member: gengar,
        coverage: { types: ['ghost', 'poison'], ability: 'levitate', moveTypes: ['ghost'] },
      },
    ]);
    expect(
      coverageMembers([{ ...gengar, abilityId: 1 }], info, moves)[0]?.coverage.ability,
    ).toBeNull();
  });
});

describe('Showdown round trip', () => {
  const ids = {
    pokemon: new Map([['garchomp', 445]]),
    items: new Map([['rockyhelmet', 540]]),
    abilities: new Map([['roughskin', 24]]),
    moves: new Map([
      ['earthquake', 89],
      ['dragontail', 525],
      ['stealthrock', 446],
      ['spikes', 191],
      ['hiddenpower', 237],
    ]),
  };
  const names = {
    pokemon: new Map([[445, 'Garchomp']]),
    items: new Map([[540, 'Rocky Helmet']]),
    abilities: new Map([[24, 'Rough Skin']]),
    moves: new Map([
      [89, 'Earthquake'],
      [525, 'Dragon Tail'],
      [446, 'Stealth Rock'],
      [191, 'Spikes'],
    ]),
  };
  const text = `Chompy (Garchomp) (F) @ Rocky Helmet
Ability: Rough Skin
Level: 50
Shiny: Yes
Tera Type: Steel
EVs: 252 HP / 4 Atk / 252 Spe
Jolly Nature
IVs: 0 SpA
- Earthquake
- Dragon Tail
- Stealth Rock
- Spikes`;

  it('imports a set as a slot and exports it back', () => {
    const [set] = parseShowdownSets(text);
    const imported = fromShowdownSet(set!, ids, 9);
    expect(imported.unresolved).toEqual([]);
    expect(imported.member).toMatchObject({
      pokemonId: 445,
      nickname: 'Chompy',
      level: 50,
      gender: 'F',
      shiny: true,
      abilityId: 24,
      nature: 'jolly',
      itemId: 540,
      teraType: 'steel',
      moveIds: [89, 525, 446, 191],
      evs: { hp: 252, atk: 4, def: 0, spa: 0, spd: 0, spe: 252 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
    });
    expect(exportShowdownSet(toShowdownSet(imported.member!, names, 9))).toBe(text);
    expect(showdownIdsOf([imported.member!])).toEqual({
      pokemon: [445],
      items: [540],
      abilities: [24],
      moves: [89, 525, 446, 191],
    });
    expect(showdownNamesOf([set!])).toEqual({
      species: ['Garchomp'],
      items: ['Rocky Helmet'],
      abilities: ['Rough Skin'],
      moves: ['Earthquake', 'Dragon Tail', 'Stealth Rock', 'Spikes'],
    });
  });

  it('reports unknown names and clamps out-of-range values', () => {
    const [set] = parseShowdownSets(`Garchomp @ Mystery Orb
Ability: Unknown
Level: 150
Tera Type: Stellar
Hidden Power: Ice
EVs: 300 Atk
IVs: 40 Spe
- Hidden Power [Fire]
- Splash`);
    const imported = fromShowdownSet(set!, ids, 9);
    expect(imported.unresolved).toEqual(['Mystery Orb', 'Unknown', 'Splash']);
    expect(imported.member).toMatchObject({
      level: 100,
      itemId: null,
      abilityId: null,
      teraType: 'stellar',
      hpType: 'fire',
      moveIds: [237],
      evs: { atk: 255 },
      ivs: { spe: 31 },
    });
    expect(fromShowdownSet({ ...set!, species: 'Missingno' }, ids, 9)).toEqual({
      member: null,
      unresolved: ['Missingno', 'Mystery Orb', 'Unknown', 'Splash'],
    });
  });

  it('follows Showdown’s Gen 1–2 conventions', () => {
    const [set] = parseShowdownSets('Garchomp\n- Earthquake');
    const member = fromShowdownSet(set!, ids, 2).member!;
    expect(member.evs).toEqual({ hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 });
    const exported = toShowdownSet(
      { ...member, nature: 'jolly', abilityId: 24, teraType: 'fire', hpType: 'ice', itemId: 1 },
      names,
      1,
    );
    expect(exported).toMatchObject({
      nature: '',
      ability: '',
      item: '',
      gender: '',
      teraType: undefined,
      hpType: undefined,
    });
    // Hidden Power left in Gen 8; Gigantamax only exists there.
    expect(toShowdownSet({ ...member, hpType: 'ice', gigantamax: true }, names, 8)).toMatchObject({
      hpType: undefined,
      gigantamax: true,
      dynamaxLevel: 10,
    });
    expect(toShowdownSet({ ...member, hpType: 'ice', gigantamax: true }, names, 7)).toMatchObject({
      hpType: 'Ice',
      gigantamax: false,
      dynamaxLevel: undefined,
    });
  });
});

describe('gameForFormat', () => {
  const games = [
    { id: 1, identifier: 'red-green-japan', generationId: 1 },
    { id: 3, identifier: 'red-blue', generationId: 1 },
    { id: 22, identifier: 'sword-shield', generationId: 8 },
    { id: 25, identifier: 'scarlet-violet', generationId: 9 },
  ];

  it('keeps the selected game of the same generation, else picks one of the format’s', () => {
    expect(gameForFormat('gen9ou', games, 25)).toBe(25);
    expect(gameForFormat('gen8vgc2022', games, 25)).toBe(22);
    expect(gameForFormat('gen1ou', games, 25)).toBe(3);
    expect(gameForFormat('gen5ou', games, 25)).toBe(25);
    expect(gameForFormat('vgc', games, 25)).toBe(25);
    expect(gameForFormat(null, games, 22)).toBe(22);
  });
});
