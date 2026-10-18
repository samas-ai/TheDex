/** Adds or removes `id` (multi-select chips). */
export function toggle<T>(list: readonly T[], id: T): T[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}
