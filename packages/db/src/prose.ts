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

/**
 * Splits PokeAPI ability prose into its battle part and its "Overworld: …" paragraphs (the
 * effect outside battle, RF04.1). Paragraphs are separated by blank lines.
 */
export function splitOverworldProse(text: string): { battle: string; overworld: string | null } {
  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim());
  const isOverworld = (paragraph: string) => paragraph.startsWith('Overworld:');
  const overworld = paragraphs
    .filter(isOverworld)
    .map((paragraph) => paragraph.replace(/^Overworld:\s*/, ''));
  return {
    battle: paragraphs.filter((paragraph) => !isOverworld(paragraph)).join('\n\n'),
    overworld: overworld.length > 0 ? overworld.join('\n\n') : null,
  };
}
