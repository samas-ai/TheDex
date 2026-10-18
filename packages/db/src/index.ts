export { DATA_MANIFEST, DATA_VERSION } from './generated/data-manifest';
export { listGames, resolveGameContext, type GameSummary } from './repos/game-context';
export { getDataMeta, getTableCounts } from './repos/meta';
export {
  getLearnset,
  getPokemon,
  listGamePokemon,
  type PokemonAbility,
  type PokemonDetail,
  type PokemonListItem,
  type PokemonStats,
} from './repos/pokemon';
export {
  containsCjk,
  normalizeSearchText,
  prefixUpperBound,
  searchQuery,
  TRIGRAM_MIN_LENGTH,
  type MatchRank,
  type SearchHit,
  type SearchOptions,
  type SearchResult,
} from './search/index';
export { ALIAS_LANG, SEARCH_ENTITY_TYPES, type SearchEntityType } from './schema/game/search';
export { langRank, pickI18n, sqlList } from './sql';
export { CJK_LANGS, type AnySQLiteDatabase, type GameContext } from './types';
