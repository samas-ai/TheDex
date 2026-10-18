import { describe, expect, it } from 'vitest';
import { stripProseMarkup } from './prose';

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
