/** Upper-cases the first letter (PokeAPI ships some names lowercase, e.g. growth rates). */
export function capitalize(text: string): string {
  return text.length === 0 ? text : text[0]!.toLocaleUpperCase() + text.slice(1);
}

/** National/regional dex number as `#0025`. */
export function dexNumber(number: number): string {
  return `#${String(number).padStart(4, '0')}`;
}

/** Height from decimetres: metres (1 decimal) and feet/inches. */
export function formatHeight(heightDm: number): { meters: string; feet: number; inches: number } {
  const totalInches = Math.round((heightDm * 10) / 2.54);
  return {
    meters: (heightDm / 10).toFixed(1),
    feet: Math.floor(totalInches / 12),
    inches: totalInches % 12,
  };
}

/** Weight from hectograms: kilograms and pounds (1 decimal). */
export function formatWeight(weightHg: number): { kilograms: string; pounds: string } {
  return {
    kilograms: (weightHg / 10).toFixed(1),
    pounds: ((weightHg / 10) * 2.20462).toFixed(1),
  };
}

/** Gender split from the PokeAPI gender rate (eighths female; -1 = genderless). */
export function genderRatio(genderRate: number): { female: number; male: number } | null {
  if (genderRate < 0) return null;
  const female = (genderRate / 8) * 100;
  return { female, male: 100 - female };
}

/** Percentage without trailing zeros (`12.5`, `100`). */
export function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
