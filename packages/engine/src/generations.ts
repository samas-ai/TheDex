/** Main-series generation number. Always passed explicitly — never defaulted. */
export type Generation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const LATEST_GENERATION: Generation = 9;

export function isGeneration(value: number): value is Generation {
  return Number.isInteger(value) && value >= 1 && value <= LATEST_GENERATION;
}

export function assertGeneration(value: number): Generation {
  if (!isGeneration(value)) throw new RangeError(`Invalid generation: ${value}`);
  return value;
}
