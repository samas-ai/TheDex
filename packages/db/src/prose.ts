/**
 * PokeAPI prose embeds links as `[label]{kind:identifier}` (e.g. `[burn]{mechanic:burn}`,
 * `[]{move:tackle}`). Keeps the label, or a readable identifier when the label is empty.
 */
export function stripProseMarkup(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\{[a-z-]+:([a-z0-9-]+)\}/g, (_, label: string, identifier: string) =>
      label !== '' ? label : identifier.replaceAll('-', ' '),
    )
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
