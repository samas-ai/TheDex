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

/** Sell price of an item: half its buy price (null when it cannot be bought, RF05.2). */
export function sellPrice(cost: number | null): number | null {
  return cost !== null && cost > 0 ? Math.floor(cost / 2) : null;
}

/** Pokédollar amount with the UI locale's digit grouping (`₽40,000`, `₽40.000`). */
export function formatPrice(value: number, locale: string): string {
  return `₽${new Intl.NumberFormat(locale).format(value)}`;
}

/** Date and time in the UI locale (`Oct 19, 2026, 08:52`, `19 de out. de 2026, 08:52`). */
export function formatDateTime(epochMs: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(epochMs));
}
