export { DATA_MANIFEST, DATA_VERSION } from './generated/data-manifest';
export { gameLangChain } from './lang';
export { stripProseMarkup } from './prose';
export {
  getAbilityDetail,
  getAbilityHolders,
  listAbilityDex,
  type AbilityDetail,
  type AbilityFilters,
  type AbilityHolder,
  type AbilityListEntry,
} from './repos/abilities';
export {
  BACKUP_DATA_TABLES,
  BACKUP_EXTENSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  backupSchema,
  exportBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  summarizeBackup,
  type Backup,
  type BackupData,
  type BackupErrorCode,
  type BackupSummary,
  type BackupTable,
  type RestoreMode,
  type RestoreResult,
  type TableRestoreResult,
} from './repos/backup';
export {
  checklistScope,
  getChecklistEntries,
  getChecklistFlags,
  listChecklistDex,
  setChecklistEntries,
  type ChecklistDexEntry,
  type ChecklistEntry,
  type ChecklistFlags,
  type ChecklistKind,
} from './repos/checklist';
export {
  listAbilities,
  listDamageClasses,
  listEggGroups,
  listGameLanguages,
  listGenerations,
  listRegions,
  listSpeciesTags,
  listStats,
  listTypes,
  type NamedEntity,
} from './repos/catalog';
export {
  getLocationEncounters,
  getPokemonEncounters,
  type AreaEncounter,
  type EncounterEntry,
  type LocationAreaEncounters,
} from './repos/encounters';
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
export {
  FAVORITE_ENTITY_TYPES,
  isFavorite,
  isFavoriteEntityType,
  listFavoriteEntries,
  listFavorites,
  setFavorite,
  toggleFavorite,
  type Favorite,
  type FavoriteEntityType,
  type FavoriteEntry,
} from './repos/favorites';
export { latestFlavorText, type FlavorTable } from './repos/flavor';
export {
  getGameFeatures,
  listGames,
  resolveGameContext,
  type GameFeatures,
  type GameSummary,
} from './repos/game-context';
export {
  getItemDetail,
  isItemGroup,
  ITEM_GROUPS,
  listItems,
  type BerryInfo,
  type ItemDetail,
  type ItemFilters,
  type ItemGroup,
  type ItemListEntry,
  type ItemPokemonRef,
  type MachineMove,
} from './repos/items';
export {
  getLearnableMoveIds,
  getPokemonMoves,
  machineLabel,
  type LearnsetMove,
  type LearnTab,
  type PokemonLearnset,
} from './repos/learnset';
export {
  compareNatural,
  getLocation,
  listLocationRegions,
  listLocations,
  LOCATION_KINDS,
  type LocationDetail,
  type LocationKind,
  type LocationListEntry,
  type LocationRegion,
} from './repos/locations';
export {
  CRY_AAC_STYLE,
  CRY_STYLE,
  deleteMediaCacheEntries,
  getMediaCacheEntry,
  getMediaCacheStats,
  getMediaPackSizes,
  getMediaSources,
  getItemIcon,
  getPokemonMedia,
  isSpriteStyle,
  ITEM_ICON_STYLE,
  itemIconCacheKey,
  itemIconSource,
  listItemIcons,
  listMediaAssets,
  listMediaCacheKeys,
  mediaCacheKey,
  mediaUrl,
  putMediaCacheEntry,
  SPRITE_STYLES,
  touchMediaCacheEntry,
  type ItemIcon,
  type MediaAsset,
  type MediaCacheEntry,
  type MediaCacheStats,
  type MediaPackSize,
  type MediaSource,
  type SpriteStyle,
} from './repos/media';
export { getDataMeta, getTableCounts } from './repos/meta';
export {
  DAMAGE_CLASSES,
  getMoveDetail,
  getMoveLearners,
  listGmaxMoves,
  listMoves,
  MOVE_SORT_KEYS,
  type DamageClass,
  type GmaxMove,
  type MaxMoveInfo,
  type MoveDetail,
  type MoveFilters,
  type MoveFlag,
  type MoveLearner,
  type MoveLearnMethod,
  type MoveListEntry,
  type MoveMeta,
  type MoveQuery,
  type MoveSortKey,
  type MoveStats,
  type MoveVariantSource,
  type ZMoveInfo,
} from './repos/moves';
export { listNatures, type NatureEntry } from './repos/natures';
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
  getFlavorTexts,
  getPokemonProfile,
  type EvYield,
  type FlavorTextEntry,
  type PokemonProfile,
} from './repos/profile';
export { readSettings, SETTING_KEYS, writeSetting, type SettingKey } from './repos/settings';
export {
  getSyncState,
  syncUserData,
  type SyncResult,
  type SyncState,
  type SyncTransport,
} from './repos/sync';
export {
  getEntityNames,
  getMoveSummaries,
  getShowdownNames,
  natureFromShowdown,
  resolveShowdownNames,
  type MoveSummary,
  type NamedKind,
  type ShowdownIdMaps,
  type ShowdownNameMaps,
  type ShowdownNameQuery,
} from './repos/team-data';
export {
  decodeTeamMembers,
  deleteTeam,
  getTeam,
  listTeams,
  MOVE_SLOTS,
  newTeamMember,
  nextTeamSortOrder,
  parseTeamMembers,
  saveTeam,
  TEAM_SIZE,
  teamMemberSchema,
  type Team,
  type TeamMember,
  type TeamMemberInput,
} from './repos/teams';
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
export { createUlid } from './ulid';
