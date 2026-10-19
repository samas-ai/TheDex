/** Crockford base32, as in the ULID spec. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * ULID (26 chars: 48-bit millisecond time + 80 random bits), for user-DB rows without a natural
 * key (teams). Time and randomness are parameters so callers and tests control them; ids sort
 * by creation time.
 */
export function createUlid(time: number, random: () => number): string {
  if (!Number.isInteger(time) || time < 0 || time > 2 ** 48 - 1) {
    throw new RangeError(`Invalid ULID time: ${time}`);
  }
  let encodedTime = '';
  let rest = time;
  for (let i = 0; i < 10; i++) {
    encodedTime = ALPHABET[rest % 32]! + encodedTime;
    rest = Math.floor(rest / 32);
  }
  let encodedRandom = '';
  for (let i = 0; i < 16; i++) {
    encodedRandom += ALPHABET[Math.min(31, Math.floor(random() * 32))]!;
  }
  return encodedTime + encodedRandom;
}
