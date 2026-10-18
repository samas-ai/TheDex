import { typeAccent, type TypeAccent } from '@thedex/ui-tokens';
import { useTheme } from './ThemeProvider';

/**
 * Accent palette of a type (PokeAPI identifier or id 1–18) in the current theme (RNF03):
 * screens tint their header, tabs and bars with the primary type of what is on screen.
 */
export function useTypeAccent(type: string | number | null | undefined): TypeAccent {
  return typeAccent(type, useTheme());
}
