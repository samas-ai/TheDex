import { describe, expect, it } from 'vitest';
import { splitOverworldProse, stripProseMarkup } from './prose';

describe('stripProseMarkup', () => {
  it('keeps link labels and humanizes empty ones', () => {
    expect(stripProseMarkup('Has a 10% chance to [burn]{mechanic:burn} the target.')).toBe(
      'Has a 10% chance to burn the target.',
    );
    expect(stripProseMarkup('Prevents []{move:self-destruct} from working.')).toBe(
      'Prevents self destruct from working.',
    );
    expect(stripProseMarkup('  Plain text.  \n')).toBe('Plain text.');
  });
});

describe('splitOverworldProse', () => {
  it('moves "Overworld:" paragraphs out of the battle prose', () => {
    expect(
      splitOverworldProse(
        'May paralyze on contact.\n\nOverworld: Electric Pokémon appear more often.\n\nNotes.',
      ),
    ).toEqual({
      battle: 'May paralyze on contact.\n\nNotes.',
      overworld: 'Electric Pokémon appear more often.',
    });
    expect(splitOverworldProse('No field effect.')).toEqual({
      battle: 'No field effect.',
      overworld: null,
    });
  });
});
