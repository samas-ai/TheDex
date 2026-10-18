export { DATA_MANIFEST, DATA_VERSION } from './generated/data-manifest';
export { gameLangChain } from './lang';
export { stripProseMarkup } from './prose';
export {
  listAbilities,
  listEggGroups,
  listGameLanguages,
  listGenerations,
  listRegions,
  listSpeciesTags,
  listStats,
  listTypes,
  type NamedEntity,
} from './repos/catalog';
export { getPokemonEncounters, type EncounterEntry } from './repos/encounters';
export {
  getEvolutionChain,
  getPokemonForms,
  resolveEvolutionMethods,
  type CosmeticForm,
  type EvolutionChain,
  type EvolutionMethod,
  type EvolutionNode,
  type FormKind,
  type PokemonForms,
  type PokemonVariety,
} from './repos/evolution';
export { listGames, resolveGameContext, type GameSummary } from './repos/game-context';
export {
  getPokemonMoves,
  type LearnsetMove,
  type LearnTab,
  type PokemonLearnset,
} from './repos/learnset';
export {
  CRY_STYLE,
  deleteMediaCacheEntries,
  getMediaCacheEntry,
  getMediaCacheStats,
  getMediaPackSizes,
  getMediaSources,
  getPokemonMedia,
  isSpriteStyle,
  listMediaAssets,
  listMediaCacheKeys,
  mediaCacheKey,
  mediaUrl,
  putMediaCacheEntry,
  SPRITE_STYLES,
  touchMediaCacheEntry,
  type MediaAsset,
  type MediaCacheEntry,
  type MediaCacheStats,
  type MediaPackSize,
  type MediaSource,
  type SpriteStyle,
} from './repos/media';
export { getDataMeta, getTableCounts } from './repos/meta';
export {
  listPokedex,
  POKEDEX_SORT_KEYS,
  type CaptureStatus,
  type PokedexEntry,
  type PokedexFilters,
  type PokedexQuery,
  type PokedexSortKey,
  type SortDirection,
} from './repos/pokedex';
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
  getAbilityDetail,
  getFlavorTexts,
  getPokemonProfile,
  type AbilityDetail,
  type EvYield,
  type FlavorTextEntry,
  type PokemonProfile,
} from './repos/profile';
export { readSettings, SETTING_KEYS, writeSetting, type SettingKey } from './repos/settings';
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
