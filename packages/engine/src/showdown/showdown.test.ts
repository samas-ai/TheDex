import { describe, expect, it } from 'vitest';
import {
  dvFromIv,
  exportShowdownSet,
  exportShowdownTeam,
  fillStats,
  ivFromDv,
  parseShowdownSets,
  parseShowdownTeams,
  toShowdownId,
  type ShowdownSet,
} from './showdown';

const GARCHOMP = `Chompy (Garchomp) (F) @ Rocky Helmet
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

describe('toShowdownId', () => {
  it('keeps lower-case letters and digits only', () => {
    expect(toShowdownId('Mr. Mime')).toBe('mrmime');
    expect(toShowdownId('Charizard-Mega-X')).toBe('charizardmegax');
    expect(toShowdownId("King's Rock")).toBe('kingsrock');
    expect(toShowdownId('Porygon2')).toBe('porygon2');
  });
});

describe('parseShowdownSets', () => {
  it('reads every attribute of a set', () => {
    expect(parseShowdownSets(GARCHOMP)).toEqual([
      {
        name: 'Chompy',
        species: 'Garchomp',
        gender: 'F',
        item: 'Rocky Helmet',
        ability: 'Rough Skin',
        level: 50,
        shiny: true,
        teraType: 'Steel',
        evs: { hp: 252, atk: 4, spe: 252 },
        nature: 'Jolly',
        ivs: { spa: 0 },
        moves: ['Earthquake', 'Dragon Tail', 'Stealth Rock', 'Spikes'],
      },
    ]);
  });

  it('reads minimal head lines and Gen 8 / legacy attributes', () => {
    const sets = parseShowdownSets(`Pikachu
- Thunderbolt

Rotom-Wash (M)
Trait: Levitate
Happiness: 0
Pokeball: Dusk Ball
Dynamax Level: 5
Gigantamax: Yes
Shiny: No
Hidden Power: Ice
~Volt Switch

Snorlax @ Leftovers
Level: lots
Happiness: max
Dynamax Level: ?
Friendship: 70
Ball: Heavy Ball
EVs: 252 HitPoints / 4 SAtk / x Def / 8 SDef / 2 speed / 6 Accuracy
IVs: 30 Spc
Unknown: line
no colon line
-`);
    expect(sets).toEqual([
      {
        name: '',
        species: 'Pikachu',
        gender: '',
        item: '',
        ability: '',
        nature: '',
        evs: {},
        ivs: {},
        moves: ['Thunderbolt'],
      },
      {
        name: '',
        species: 'Rotom-Wash',
        gender: 'M',
        item: '',
        ability: 'Levitate',
        nature: '',
        evs: {},
        ivs: {},
        happiness: 0,
        pokeball: 'Dusk Ball',
        dynamaxLevel: 5,
        gigantamax: true,
        shiny: false,
        hpType: 'Ice',
        moves: ['Volt Switch'],
      },
      {
        name: '',
        species: 'Snorlax',
        gender: '',
        item: 'Leftovers',
        ability: '',
        nature: '',
        evs: { hp: 252, spa: 4, spd: 8, spe: 2 },
        ivs: { spa: 30 },
        happiness: 70,
        pokeball: 'Heavy Ball',
        moves: [],
      },
    ]);
  });

  it('turns "Hidden Power [Type]" into the move plus its type', () => {
    const [set] = parseShowdownSets('Magnezone\n- Hidden Power [ Fire ]\n- Flash Cannon');
    expect(set?.moves).toEqual(['Hidden Power', 'Flash Cannon']);
    expect(set?.hpType).toBe('Fire');
  });

  it('keeps a nickname with parentheses-free species and CRLF input', () => {
    const [set] = parseShowdownSets(
      'The Boss (Kingambit) @ Black Glasses\r\nAbility: Supreme Overlord',
    );
    expect(set).toMatchObject({ name: 'The Boss', species: 'Kingambit', item: 'Black Glasses' });
  });

  it('drops sets without a species', () => {
    expect(parseShowdownSets('Nick ()\n- Tackle')).toEqual([]);
    expect(parseShowdownSets('')).toEqual([]);
  });
});

describe('parseShowdownTeams', () => {
  it('splits backups by their === [format] Folder/Name === headers', () => {
    const teams = parseShowdownTeams(`Mew

=== [gen9ou] Rain/Pelipper Rain ===

Pelipper @ Damp Rock

=== Untitled ===

=== [gen3ou] Sand ===
Tyranitar
=== [] ===
Skarmory
=== [gen1ou] Folder/ ===
Tauros
=== /Root ===
Lapras`);
    expect(
      teams.map(({ name, format, folder, sets }) => [name, format, folder, sets.length]),
    ).toEqual([
      [null, null, null, 1],
      ['Pelipper Rain', 'gen9ou', 'Rain', 1],
      ['Sand', 'gen3ou', null, 1],
      [null, null, null, 1],
      [null, 'gen1ou', 'Folder', 1],
      ['Root', null, null, 1],
    ]);
  });
});

describe('exportShowdownSet', () => {
  it('round-trips a full set', () => {
    const [set] = parseShowdownSets(GARCHOMP);
    expect(exportShowdownSet(set!)).toBe(GARCHOMP);
  });

  it('omits defaults and the nickname when it is the species', () => {
    const set: ShowdownSet = {
      name: 'Pikachu',
      species: 'Pikachu',
      item: '',
      ability: '',
      moves: ['Hidden Power', 'Thunderbolt'],
      nature: '',
      gender: '',
      evs: { hp: 0, atk: 252 },
      ivs: { hp: 31, atk: 30 },
      level: 100,
      shiny: false,
      happiness: 255,
      hpType: 'Ice',
      dynamaxLevel: 10,
      gigantamax: false,
    };
    expect(exportShowdownSet(set)).toBe(
      'Pikachu\nEVs: 252 Atk\nIVs: 30 Atk\n- Hidden Power [Ice]\n- Thunderbolt',
    );
  });

  it('writes Gen 8 attributes and a Hidden Power type without the move', () => {
    const set: ShowdownSet = {
      name: '',
      species: 'Snorlax-Gmax',
      item: 'Leftovers',
      ability: 'Thick Fat',
      moves: ['Hidden Power'],
      nature: 'Careful',
      gender: 'M',
      evs: {},
      ivs: {},
      happiness: 0,
      pokeball: 'Heavy Ball',
      dynamaxLevel: 3,
      gigantamax: true,
    };
    expect(exportShowdownSet(set)).toBe(
      [
        'Snorlax-Gmax (M) @ Leftovers',
        'Ability: Thick Fat',
        'Happiness: 0',
        'Pokeball: Heavy Ball',
        'Dynamax Level: 3',
        'Gigantamax: Yes',
        'Careful Nature',
        '- Hidden Power',
      ].join('\n'),
    );
    expect(exportShowdownSet({ ...set, moves: [], hpType: 'Fire' })).toContain(
      'Hidden Power: Fire',
    );
  });
});

describe('Gen 1–2 EV defaults', () => {
  it('writes zeros and omits 252 when 252 is the default', () => {
    const [set] = parseShowdownSets('Tauros\nEVs: 0 HP / 252 Atk / 252 Spe');
    expect(exportShowdownSet(set!, { defaultEv: 252 })).toBe('Tauros\nEVs: 0 HP');
    expect(exportShowdownTeam([set!], undefined, { defaultEv: 252 })).toBe('Tauros\nEVs: 0 HP\n');
  });
});

describe('exportShowdownTeam', () => {
  const sets = parseShowdownSets('Mew\n\nCelebi');

  it('joins sets with a blank line', () => {
    expect(exportShowdownTeam(sets)).toBe('Mew\n\nCelebi\n');
  });

  it('adds the header when the team has a name', () => {
    expect(exportShowdownTeam(sets, { name: 'Legends', format: 'gen2ou' })).toBe(
      '=== [gen2ou] Legends ===\n\nMew\n\nCelebi\n',
    );
    expect(exportShowdownTeam(sets, { name: 'Legends' })).toBe(
      '=== Legends ===\n\nMew\n\nCelebi\n',
    );
    const reparsed = parseShowdownTeams(exportShowdownTeam(sets, { name: 'L', format: 'gen2ou' }));
    expect(reparsed[0]).toMatchObject({ name: 'L', format: 'gen2ou', folder: null });
  });
});

describe('stat helpers', () => {
  it('fills missing stats', () => {
    expect(fillStats({ atk: 0 }, 31)).toEqual({
      hp: 31,
      atk: 0,
      def: 31,
      spa: 31,
      spd: 31,
      spe: 31,
    });
    expect(fillStats({ hp: 4, def: 8, spa: 12, spd: 16, spe: 20 }, 0)).toEqual({
      hp: 4,
      atk: 0,
      def: 8,
      spa: 12,
      spd: 16,
      spe: 20,
    });
  });

  it('converts between Gen 1–2 DVs and Showdown IVs', () => {
    expect([0, 1, 30, 31].map(dvFromIv)).toEqual([0, 0, 15, 15]);
    expect([0, 7, 14, 15].map(ivFromDv)).toEqual([0, 14, 28, 31]);
    for (let dv = 0; dv <= 15; dv++) expect(dvFromIv(ivFromDv(dv))).toBe(dv);
  });
});
