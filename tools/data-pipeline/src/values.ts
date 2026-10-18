export type SqlValue = string | number | null;

/** CSV cell → integer (empty → null). Throws on non-integers to catch column mix-ups. */
export function toInt(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`Expected integer, got "${value}"`);
  return number;
}

/** CSV cell → required integer. */
export function toIntRequired(value: string | undefined, label = 'value'): number {
  const number = toInt(value);
  if (number === null) throw new Error(`Missing required integer ${label}`);
  return number;
}

/** CSV cell → 0/1 (empty → 0). */
export function toBool(value: string | undefined): 0 | 1 {
  if (value === undefined || value === '' || value === '0' || value.toLowerCase() === 'false') {
    return 0;
  }
  return 1;
}

/** CSV cell → trimmed text (empty → null). */
export function toText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Showdown ID rule: lowercase alphanumerics only. */
export function toPsId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
