import { describe, expect, it } from 'vitest';
import { createUlid } from './ulid';

describe('createUlid', () => {
  it('encodes the time in the first 10 characters and randomness in the last 16', () => {
    expect(createUlid(0, () => 0)).toBe('00000000000000000000000000');
    expect(createUlid(1469918176385, () => 0.999999)).toBe('01ARYZ6S41ZZZZZZZZZZZZZZZZ');
    expect(createUlid(2 ** 48 - 1, () => 0.5)).toBe('7ZZZZZZZZZGGGGGGGGGGGGGGGG');
  });

  it('sorts by creation time', () => {
    const random = () => 0.42;
    const ids = [3, 1_700_000_000_000, 31, 32].map((time) => createUlid(time, random));
    expect([...ids].sort()).toEqual([ids[0], ids[2], ids[3], ids[1]]);
  });

  it('rejects times outside 48 bits', () => {
    expect(() => createUlid(-1, Math.random)).toThrow(RangeError);
    expect(() => createUlid(2 ** 48, Math.random)).toThrow(RangeError);
    expect(() => createUlid(1.5, Math.random)).toThrow(RangeError);
  });
});
