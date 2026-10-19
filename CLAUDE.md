# TheDex — Diretrizes do projeto

TheDex é uma Pokédex **100% offline**, multi-geração, com multilíngue dual (idioma da UI ≠ idioma dos dados de jogo) e modelo freemium. A especificação completa do produto está em [`docs/SPEC.md`](docs/SPEC.md).

**Fases:**

| Fase | Escopo                                                                 | Status      |
| ---- | ---------------------------------------------------------------------- | ----------- |
| 1    | Monorepo, schema SQLite, pipeline de dados, busca FTS5                 | concluída\* |
| 2    | Temas e paleta por tipo, seletor de jogo, RF01–RF02, cache de mídia    | concluída\* |
| 3    | RF03–RF07 (Move, Ability, Item, Location, Type e Nature Dex)           | concluída\* |
| 4    | RF08–RF11 (Team Builder/Showdown, Checklist, Comparador, Calculadoras) | concluída†  |
| 5    | Backup/restore e feature flags PRO                                     | concluída‡  |

\* As telas das Fases 2 e 3 rodaram num emulador Android 35 (Expo Go, dados reais), mas falta validar num aparelho real (APK de release em modo avião) e num iPhone. Os bundles Android e iOS compilam (`npx expo export --platform android|ios`).

† As telas da Fase 4 rodaram no emulador Android 35 (Expo Go, FireRed/LeafGreen): importação/exportação do Showdown, slot, cobertura, card em PNG com a folha de compartilhamento, checklist, comparador e calculadoras. Valem as mesmas pendências: aparelho real e iPhone.

‡ A Fase 5 rodou no emulador Android 35 (Expo Go): exportação pela folha de compartilhamento, restauração (mesclar) de um `.thedex` escolhido no seletor do sistema, tela PRO com a simulação de plano e os bloqueios do plano grátis (limite de times, shiny no checklist, filtros combinados, AMOLED, banner). O modo "Substituir" só foi testado nos testes unitários. A compra do PRO pela loja (expo-iap, produto `thedex_pro`) já está no código, mas só foi verificada em testes unitários com uma loja falsa e na compilação dos bundles: ainda não rodou num build de desenvolvimento nem contra as lojas, que dependem dos produtos criados nos consoles (ver "Freemium"). Falta também um provedor de nuvem para o sync.

---

## Comandos

Requisitos: Node ≥ 24 LTS e pnpm 10 via corepack. Rode `corepack enable`; sem admin no Windows, use `corepack enable pnpm --install-directory "%APPDATA%\npm"`.

O `better-sqlite3` ≥ 13 já traz binários prontos. Ele fica em `ignoredBuiltDependencies` para o pnpm não tentar compilá-lo, o que exigiria o Visual Studio.

| Comando                                         | O que faz                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm install`                                  | Instala o workspace (`node-linker=hoisted`)                                                    |
| `pnpm data:fetch`                               | Baixa os CSVs da PokeAPI e a listagem de sprites/cries/ícones (SHAs fixados) para `.cache/`    |
| `pnpm data:build`                               | Gera `tools/data-pipeline/dist/thedex-data.db` + `manifest.json` e copia para o app            |
| `pnpm data:validate`                            | Integridade, FKs, contagens, fatos pontuais, teste cruzado com o engine e orçamento de tamanho |
| `pnpm bench:search`                             | Benchmark de busca, lista da Pokédex e Dexes da Fase 3 contra o `.db` real (p95 < 100 ms)      |
| `pnpm media:pack`                               | Gera o pacote de gritos AAC do iOS (`cries-aac`, exige ffmpeg) e a listagem versionada         |
| `pnpm media:verify`                             | Confere o pacote publicado (cada arquivo na URL fixada, com o tamanho listado)                 |
| `pnpm test`                                     | Vitest em todos os projetos, inclusive a lógica pura do app (o engine exige 100% de cobertura) |
| `pnpm typecheck` / `pnpm lint` / `pnpm format`  | Qualidade                                                                                      |
| `pnpm db:generate`                              | Gera migration do user DB (drizzle-kit) e o bundle `migrations.generated.ts`                   |
| `pnpm --filter @thedex/mobile start`            | Metro/Expo (rode `pnpm data:build` antes: o app embarca o `.db`)                               |
| `npx expo install <pkg>` (em `apps/mobile`)     | Única forma de adicionar dependências ao app (resolve versões compatíveis com o SDK)           |
| `npx expo export --platform android` (ou `ios`) | Gera o bundle JS + assets (verifica a resolução do monorepo sem aparelho)                      |

**Emulador Android:** com o Metro rodando (`pnpm --filter @thedex/mobile start`), rode `adb reverse tcp:8081 tcp:8081` e abra `exp://127.0.0.1:8081` no Expo Go. Pelo IP da LAN o bundle carrega, mas o download do banco de 56 MB falha ("Unable to download asset"). Rotas abrem direto com `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081/--/move/85"`.

---

## Arquitetura

```
apps/mobile/            @thedex/mobile        Expo SDK 58 + Expo Router (rotas em src/app/)
packages/engine/        @thedex/engine        mecânicas puras (TS, zero deps, zero I/O): stats, tipos, Showdown, cobertura, captura
packages/db/            @thedex/db            schema Drizzle (game + user), DDL, repositórios, busca
packages/ui-tokens/     @thedex/ui-tokens     só tokens: paleta dos 18 tipos, temas, espaçamentos
tools/data-pipeline/    @thedex/data-pipeline CSV PokeAPI + @pkmn/dex + curados → thedex-data.db
tools/media-pack/       @thedex/media-pack    gritos .ogg → pacote AAC do iOS (ffmpeg), publicado à parte
data/curated/           JSONs curados versionados (jogos, tags, pt-BR, aliases, overrides, efeitos fora de batalha, tipos de local)
data/generated/         listagens geradas e versionadas (media-packs/cries-aac.json)
```

**Dependências permitidas:** `engine` ← `db` ← `mobile` e `ui-tokens` ← `mobile` (o `db` usa o engine para naturezas/tipos e o `zod` para validar os times). O `data-pipeline` depende de `db` e `engine`, e o `media-pack` depende do `data-pipeline` (config e formato da listagem). O engine e o `ui-tokens` não importam nada do monorepo (o `ui-tokens` repete a lista dos 18 tipos para continuar sem dependências), e a UI nunca importa `better-sqlite3` nem o pipeline.

**Pacotes internos não têm build.** O `package.json` exporta `./src/index.ts`, e Metro, Vitest e tsx consomem o TypeScript direto.

### Dois bancos SQLite

|             | `thedex-data.db`                                                        | `thedex-user.db`                                           |
| ----------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| Conteúdo    | Dados de jogo (Pokémon, golpes, itens, locais, traduções, busca)        | Configurações, favoritos, times, checklist, cache de mídia |
| Origem      | Gerado no build pelo pipeline e embarcado como asset                    | Criado no aparelho                                         |
| Escrita     | **Somente leitura** em runtime                                          | Leitura/escrita                                            |
| Evolução    | Arquivo substituído inteiro a cada versão; **o schema muda livremente** | **Só via migration** Drizzle                               |
| Backup/sync | Nunca                                                                   | Sim (exceto `media_cache` e `sync_state`)                  |

Em runtime o app abre o user DB e faz `ATTACH` do data DB. Os nomes de tabela não colidem, então as consultas de jogo funcionam sem prefixo e os joins entre os dois bancos (ex.: filtro "Capturado") são SQL simples.

O bundle do app carrega um `DATA_VERSION` (`packages/db/src/generated/data-manifest.ts`, gerado pelo pipeline). No boot (`apps/mobile/src/shared/db/bootstrap.ts`), se ele diferir de `meta.data_version` do banco instalado, o asset é recopiado.

O `DATA_VERSION` é **determinístico**: é um hash do SHA da PokeAPI, da versão do `@pkmn/dex`, dos JSONs curados, das listagens dos pacotes de mídia e do código do schema/pipeline. Rebuild sem mudança de entrada gera a mesma versão. Depois de mexer no pipeline ou no schema, rode `pnpm data:build` e commite o `data-manifest.ts` atualizado.

### Pipeline no build (o "seeding" do RNF01)

Etapas: `fetch → load → derive → finalize → validate`. As fontes são fixadas para builds reproduzíveis:

1. **PokeAPI CSV** (`data/v2/csv`), no SHA em `tools/data-pipeline/src/config.ts`.
2. **`@pkmn/dex`** (dados do Pokémon Showdown, MIT), na versão fixada no `package.json`. Fornece IDs do Showdown, flags de golpe, Z/Max power, efeitos e boosts dos golpes Z de status, os golpes G-Max (que a PokeAPI não tem), mudanças de forma e o Special da Gen 1.
3. **`data/curated/*.json`**, que cobre as lacunas da PokeAPI.
4. **`data/generated/media-packs/*.json`**: listagem dos pacotes de mídia que o próprio TheDex publica (ver "Mídia").

### Histórico materializado

As tabelas `*_past` e `move_changelog` da PokeAPI são **insumo** do pipeline. Em runtime só existem tabelas já resolvidas:

- `pokemon_types_by_gen`, `pokemon_abilities_by_gen`, `pokemon_stats_by_gen`: uma linha por geração em que o Pokémon existe.
- `move_stats_by_vg`: tipo, poder, PP, precisão, prioridade e categoria por version group. Nas Gen 1–3 a categoria física/especial vem do tipo (`legacyDamageClass` do engine).

Assim, filtros e ordenação por jogo são joins indexados, sem lógica de resolução em runtime.

### Jogos e `GameContext`

"Jogo" é uma entidade curada (`data/curated/games.json`). Um jogo agrupa version groups, versões e pokédexes, porque a PokeAPI separa as DLCs: Scarlet/Violet = `scarlet-violet` + `the-teal-mask` + `the-indigo-disk`. O seletor global (RF01.2) trabalha com jogos.

Toda consulta de jogo recebe um contexto explícito, nunca um global escondido:

```ts
interface GameContext {
  gameId: number;
  gameIdentifier: string;
  generationId: number;
  versionGroupIds: readonly number[]; // VG base primeiro, depois as DLCs
  versionIds: readonly number[]; // todas as versões desses VGs (flavor text, encontros)
  langChain: readonly string[]; // ex.: ['pt-BR', 'en'] ou ['ja', 'ja-Hrkt', 'en']
}
```

No app, o `GameProvider` monta o contexto a partir de `settings.game_id` (padrão: Scarlet/Violet) e `settings.game_langs`, e o expõe por `useGame()`. A cadeia de idiomas sai de `gameLangChain(primário)` (`@thedex/db`): `ja` → `['ja', 'ja-Hrkt', 'en']`, `es-419` → `['es-419', 'es', 'en']` etc.

### Multilíngue dual

- **UI:** i18next + react-i18next. Os locales são módulos TS em `apps/mobile/src/shared/i18n/locales/` (`en.ts` define a forma; `pt-BR.ts` é tipado como `Translations`). As chaves são checadas pelo `tsc` (augmentation de `CustomTypeOptions`). O idioma da UI é `settings.ui_lang` (`system` segue o aparelho via expo-localization).
- **Dados de jogo:** vêm só do banco, tabelas `*_i18n`, resolvidos pela `langChain` na ordem; o último elemento é sempre `en`.
- A PokeAPI declara pt-BR mas não tem textos. `data/curated/i18n-pt-BR.json` preenche o essencial (18 tipos, 25 naturezas, 6 atributos e mais os sabores), e o resto cai para inglês. Os tipos seguem a Pokédex oficial brasileira; as naturezas usam os nomes consagrados pela comunidade, já que não há tradução oficial. O build falha se faltar algum dos 18/25/6.

### Busca (RNF07)

- `search_terms` (tabela normal) guarda um nome por entidade, por idioma e por alias. `search_fts` é FTS5 de conteúdo externo sobre `name_norm`, com `tokenize='trigram'`.
- **Normalização** (`normalizeSearchText`, em `@thedex/db`, compartilhada entre o pipeline e a consulta), nesta ordem:
  1. NFD removendo só U+0300–036F;
  2. NFKC;
  3. minúsculas;
  4. hiragana → katakana;
  5. ♀/♂ → ` f`/` m`;
  6. apóstrofo e ponto removidos;
  7. hífen e outros separadores → espaço.
- **Consultas ≥ 3 caracteres:** `search_fts.name_norm LIKE '%q%'` (o índice trigram atende ao LIKE; parametrizado, sem risco de sintaxe FTS).
- **Consultas < 3 caracteres:** range de prefixo indexado em `(lang, name_norm)`, mais LIKE de substring só nas linhas CJK.
- **Ranking:** exato > prefixo > início de palavra > substring, depois `priority` e `sort_key`. A deduplicação por entidade usa `ROW_NUMBER()`, e há limite por tipo de entidade.

---

## Schema

### `thedex-data.db` (dados de jogo)

**Convenções:**

- Colunas nomeadas **explicitamente em snake_case** no Drizzle; propriedades TS em camelCase.
- PKs são os IDs estáveis da PokeAPI. As tabelas de entidade também têm `identifier` (slug da PokeAPI) e, quando aplicável, `ps_id` (ID do Showdown).
- `lang` usa código BCP-47: `en`, `ja`, `ja-Hrkt`, `ja-Latn`, `ko`, `zh-Hans`, `zh-Hant`, `fr`, `de`, `es`, `es-419`, `it`, `cs`, `pt-BR`.
- **DDL:** o schema Drizzle é a fonte única. `packages/db/src/ddl.ts` emite o `CREATE TABLE`/`CREATE INDEX` a partir de `getTableConfig`. As tabelas em `WITHOUT_ROWID_TABLES` recebem `WITHOUT ROWID`, e as FTS5 são criadas por SQL bruto no pipeline.

**Tabelas por domínio** (os arquivos estão em `packages/db/src/schema/game/`):

| Domínio             | Tabelas                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meta / jogos        | `meta`, `languages`, `generations`, `regions`, `version_groups`, `version_group_regions`, `versions`, `pokedexes`, `pokedex_version_groups`, `games`, `game_version_groups`, `game_versions`, `game_pokedexes`                                                                                                                            |
| Pokémon             | `pokemon_species`, `species_tags`, `pokemon`, `pokemon_forms`, `pokemon_form_types`, `form_changes`, `pokemon_types_by_gen`, `pokemon_abilities_by_gen`, `pokemon_stats_by_gen`, `egg_groups`, `pokemon_egg_groups`, `growth_rates`, `pokemon_dex_numbers`, `game_pokemon`, `evolution_chains`, `evolution_triggers`, `pokemon_evolution` |
| Golpes              | `moves`, `move_stats_by_vg`, `move_meta`, `move_meta_stat_changes`, `move_flags`, `move_flag_map`, `move_targets`, `move_damage_classes`, `move_learn_methods`, `move_variants`, `gmax_moves`, `pokemon_moves`, `machines`                                                                                                                |
| Habilidades / itens | `abilities`, `items`, `item_categories`, `item_pockets`, `item_fling_effects`, `item_flags`, `item_flag_map`, `item_generations`, `item_icons`, `berries`, `berry_flavor_map`, `item_locations`                                                                                                                                           |
| Locais              | `locations`, `location_generations`, `location_areas`, `encounter_methods`, `encounter_slots`, `encounters`, `encounter_conditions`, `encounter_condition_values`, `encounter_condition_value_map`                                                                                                                                        |
| Outros              | `natures`, `flavors`, `types`, `stats`, `media_sources`, `media_assets`                                                                                                                                                                                                                                                                   |
| Traduções           | `<entidade>_i18n` (nomes; espécie + `genus`; forma + `form_name`/`pokemon_name`), `move_effect_i18n`, `ability_prose_i18n` (+ `overworld_effect`), `item_prose_i18n`, `flavor_texts` (texto deduplicado) + `species_flavor_text`, `move_flavor_text`, `ability_flavor_text`, `item_flavor_text`                                           |
| Busca               | `search_terms`, `search_fts` (FTS5 trigram)                                                                                                                                                                                                                                                                                               |

**Notas de modelagem:**

- `pokemon` = variedade com stats próprios (ex.: Charizard, Mega Charizard X, Raichu de Alola). `pokemon_forms` = formas, incluindo as cosméticas que compartilham o `pokemon_id` (Unown, Vivillon).
- `pokemon_forms.form_kind` é derivado no pipeline (`derive/forms.ts`): `default`, `mega`, `primal`, `gmax`, `regional_alola|galar|hisui|paldea`, `totem`, `cosmetic`, `item`, `battle`, `other`. O `validate` falha se alguma forma ficar sem tipo.
- Nome de exibição (`pokemonName`): a variedade padrão usa o nome da espécie ("Ogerpon", não "Teal Mask Ogerpon"); as alternativas usam o nome completo da forma ("Mega Charizard X").
- `pokemon_evolution.version_group_id` é o VG que **introduziu** o método. `resolveEvolutionMethods` mantém, por "trilha" (espécie + forma evoluída + região), só o método mais recente até o jogo do contexto; métodos presos a uma região (Raichu de Alola) só valem em jogos dessa região. Ex.: Sylveon evolui por afeto em X/Y e por amizade em Scarlet/Violet.
- Jogos com várias Pokédex regionais (SV: Paldea → Kitakami → Blueberry) ordenam pela ordem da dex no jogo (`game_pokedexes.sort_order`) e depois pelo número.
- `pokemon_moves` é a maior tabela. PK `(pokemon_id, version_group_id, method_id, move_id, level)`, `WITHOUT ROWID`, mais o índice `(move_id, version_group_id)`. A aba "Evolução" = level-up nível 0 em version groups da Gen 7+.
- `encounters.slot_id` é anulável, e `rate_pct`/`extra_json` comportam os modelos dos jogos novos (clima, alpha, outbreak).
- A **tabela de efetividade de tipos não fica no banco**: o engine é a fonte da verdade. O `validate` confere a tabela da PokeAPI contra o engine.
- `item_locations` existe no schema mas ainda está vazia (curadoria futura); o detalhe do item avisa. `media_assets` e `media_sources` são populadas desde a Fase 2 (ver "Mídia").
- **Fase 3 (schema v3, `GAME_SCHEMA_VERSION = 3`):**
  - `items.app_group` (Item Dex, RF05.1) é derivado em `derive/items.ts`, primeiro pela categoria da PokeAPI e depois pelo bolso: `held` (itens segurados + bolso de batalha: X Attack, flautas), `berry`, `machine`, `medicine`, `ball`, `evolution`, `treasure` (inclui fósseis), `key`, `other`. O `validate` falha se algum item ficar sem grupo.
  - `locations.location_kind` (Location Dex, RF06.1) sai de regras sobre as palavras do identifier (`derive/locations.ts`): `city`, `route`, `cave` (inclui montanhas), `water`, `building`, `area`. Cidades sem sufixo (Galar, Paldea, Orre) e nomes enganosos ficam em `data/curated/location-kinds.json`.
  - `item_generations` e `location_generations` vêm de `item_game_indices`/`location_game_indices` da PokeAPI: dizem em que geração o item/local existe. O filtro "Neste jogo" usa isso (MTs/MOs: a máquina tem golpe nos VGs do jogo; locais: região do jogo + geração, ou encontros nas versões do jogo).
  - `moves.z_boosts` (JSON por atributo, ex.: `{"speed":1}`) completa `z_power`/`z_effect`. Os golpes Z da PokeAPI existem em duas linhas (`--physical`/`--special`) com o mesmo `ps_id`; o detalhe liga a variante da categoria do golpe. Os cristais Z também são duplicados (`--held`/`--bag`) e os dois recebem o `ps_id`.
  - `gmax_moves(ps_id, name, type_id, pokemon_id, power, description)`: os 33 golpes G-Max, com nome e descrição em inglês do Showdown (a PokeAPI não os tem). `power` só para os de poder fixo (160).
  - `pokemon_evolution` ganhou índices em `trigger_item_id` e `held_item_id` ("usado para evoluir" no detalhe do item).
- `flavor_texts(id, text)` não tem idioma: o mesmo texto é guardado uma vez, mesmo entre idiomas (o `es-419` reaproveita o `es`). O idioma fica na tabela que referencia.
- **Fase 4 (schema v4, `GAME_SCHEMA_VERSION = 4`):** `pokemon`, `moves`, `abilities` e `items` ganharam `ps_name`, o nome de exibição do Showdown (`Charizard-Mega-X`, `U-turn`), preenchido pelo `@pkmn/dex` no `derive/pkmn.ts`. A exportação de times usa `ps_name` e cai no nome em inglês quando falta (TMs, Potion). A importação resolve nomes por `toShowdownId` contra `ps_id`, depois contra o identifier sem hífens, e as espécies também contra `pokemon_forms.ps_id` (formas cosméticas como `Vivillon-Pokeball` viram a variedade).
- `ps_id`: todos os Pokémon da série principal estão mapeados. Ficam sem mapeamento, de propósito, os modos cosméticos de Koraidon/Miraidon, os golpes Shadow (Colosseum/XD) e os itens que não são de batalha.

### `thedex-user.db` (dados do usuário, pronto para sync)

**Convenções:**

- PK natural quando existe; ULID só para entidades sem chave natural.
- Toda linha tem `updated_at` (epoch ms) e `deleted_at` (tombstone). O merge é last-write-wins.
- Referências ao jogo usam IDs da PokeAPI, sem FK física entre os bancos.

| Tabela              | Chave                              | Notas                                                                                                                                                                           |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings`          | `key`                              | `ui_lang`, `game_langs`, `theme` (`system\|light\|dark\|amoled`), `sprite_style` (`official\|pixel\|3d\|home`), `game_id`, `checklist_kind` (`national\|game`)                  |
| `favorites`         | `(entity_type, entity_id)`         |                                                                                                                                                                                 |
| `teams`             | `id` (ULID)                        | `members_json` = até 6 `TeamMember` (Zod em `repos/teams.ts`), exportáveis como `PokemonSet` do Showdown. O time é a unidade de sync. Limites de EV por geração vivem no engine |
| `checklist_entries` | `(dex_scope, pokemon_id, form_id)` | `dex_scope` = `national` ou `game:<id do jogo curado>`; `form_id = 0` = forma padrão, senão `pokemon_forms.id` (Living Dex por forma; a UI ainda marca só a forma padrão)       |

- **`TeamMember`:** ids da PokeAPI para tudo que é entidade (variedade, habilidade, item, golpes por slot, `null` = vazio) e as convenções do Showdown para o resto: EVs 0–255 e IVs 0–31 em todas as gerações. Na Gen 1–2 o DV é ⌊IV/2⌋ (15 → IV 31), o DV de PS é derivado dos outros, a Sp. Def segue o Special e o Stat Exp é EV² (o bônus ⌊EV/4⌋ fica igual ao das gerações seguintes). Natureza, Tera Type e tipo do Hidden Power são identifiers (`adamant`, `steel`, `stellar`). `decodeTeamMembers` descarta membros inválidos em vez de perder o time; acima dos limites da geração (um 255 importado, um time movido para a Gen 6+), EVs e IVs contam como o limite.
- **Checklist:** um nível por Pokémon (nada → visto → capturado → shiny), gravado como as três flags; o filtro "Capturado" da Pokédex lê a coleção escolhida em `checklist_kind`.
  | `media_cache` | `key` | Local ao aparelho, fora do backup. `key` = `<style>/<variant>/<pokemon_id>` (ícones de item: `item/default/<item_id>`) |
  | `sync_state` | `provider` | Fora do backup |

**Migrations:** `pnpm db:generate` roda o drizzle-kit (driver expo) em `packages/db/migrations/user/`, e `scripts/bundle-migrations.ts` gera `migrations.generated.ts` com o SQL como string. Funciona em Metro, Vitest e Tauri, sem plugin babel. **Nunca edite uma migration já publicada.**

---

## Fontes de dados, lacunas e orçamento

| Lacuna na PokeAPI                               | Tratamento                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| pt-BR sem textos                                | `data/curated/i18n-pt-BR.json` + fallback `en`                                 |
| Learnsets do Legends: Z-A (VG 30–31)            | Ausentes no SHA fixado; aguardar a PokeAPI ou curar                            |
| Learnsets próprios das DLCs (VG 21, 22, 26, 27) | Ausentes: os golpes ficam no version group base; o `GameContext` já une os VGs |
| Localização de itens (RF05.2)                   | `item_locations` curada (futuro); o detalhe do item avisa que falta            |
| Efeito fora de batalha das habilidades          | `data/curated/ability-overworld.json` (en + pt-BR, conferido na Bulbapedia)    |
| Golpes G-Max                                    | `gmax_moves`, do `@pkmn/dex` (nome e descrição só em inglês)                   |
| Tipo de local (cidade, rota, caverna…)          | Regras no identifier + `data/curated/location-kinds.json`                      |
| Tags inicial / Ultra Beast / Paradoxo / fóssil  | `data/curated/species-tags.json`                                               |
| IDs do Showdown que fogem da regra              | `data/curated/ps-id-overrides.json`                                            |
| Encontros de SV, Legends: Arceus, BDSP, Z-A     | Schema pronto; curadoria futura. `getGameFeatures` detecta e a UI avisa        |
| Flavor text de SV e de outros jogos recentes    | O perfil mostra a entrada mais recente de outro jogo, sinalizada               |
| Cries em `.ogg` (o iOS não toca)                | Android/web tocam `.ogg`; o iOS toca o pacote AAC `cry-aac` (Mídia)            |
| Sprites (repositório de ~25 GB)                 | Sob demanda, a partir de commits fixados; `media_assets` gerado no build       |

**Orçamento de tamanho do `thedex-data.db`:** alerta em 50 MB, falha em 60 MB.

- O `finalize` imprime o peso por tabela e índice (via `dbstat`) e o grava em `dist/manifest.json`, com a `pokemon_moves` em destaque.
- A `pokemon_moves` é sempre `WITHOUT ROWID`.
- **Deduplicação por jogo** (`--dedupe-learnsets`): linhas idênticas entre os version groups de um mesmo jogo ficam só no version group base, e o repo faz a união pelos `versionGroupIds`. Um teste de equivalência protege essa troca. Ela é ligada automaticamente só se o banco passar de 60 MB e houver o que remover. O `manifest.json` informa o potencial em `learnsetDedupePotential`.
- **Estado no SHA fixado:** 53,2 MB (alerta ativo). `pokemon_moves` ocupa 18,9 MB (36%, sendo 8,8 MB de índices), `flavor_texts` 9,2 MB, `encounters` 5,9 MB e busca (termos + FTS) 7,4 MB. O manifesto de mídia (`media_assets`, ~14,6 mil arquivos, e `item_icons`, ~2,2 mil) soma ~0,5 MB. As tabelas da Fase 3 somam ~0,2 MB, e o `ps_name` da Fase 4 pouco mais de 0,05 MB. O potencial da deduplicação é 0, porque a PokeAPI não tem learnsets de DLC.
- **Próximas alavancas, se precisar:** remover `es-419`/`cs` dos textos longos, ou deixar o índice `(move_id, version_group_id)` como tabela inversa compacta.

**Propriedade intelectual:** os repositórios de sprites e cries são CC0, mas o conteúdo é © The Pokémon Company. O pacote `cry-aac` redistribui esses sons a partir do repositório público do TheDex. Faça uma revisão jurídica antes de publicar nas lojas.

### Mídia (RNF02)

- **Commits fixados:** `SPRITES_SHA` e `CRIES_SHA` em `tools/data-pipeline/src/config.ts`, junto com `MEDIA_SOURCES` (estilo/variante → diretório do repositório). O `data:fetch` lista esses diretórios pela API de árvores do GitHub (~17 requisições, abaixo do limite anônimo de 60/h; `GITHUB_TOKEN` aumenta o limite) e grava `.cache/sources/media-<sha>-<sha>.json`; a listagem em cache é refeita sozinha quando falta algum diretório novo de `MEDIA_SOURCES`. O build não baixa nenhum arquivo de mídia.
- **No banco:** `media_sources(style, variant, base_url, format)` guarda o prefixo imutável da URL (com o SHA), e `media_assets(pokemon_id, style, variant, path, bytes)` lista os arquivos que existem. URL = `base_url/path`. `meta` registra `source_sprites_sha` e `source_cries_sha`.
- **Estilos:** `official` (official-artwork), `pixel` (sprites/pokemon), `3d` (GIFs animados do Showdown, renderizados dos modelos 3D), `home`, cada um com `default` e `shiny`; `cry` e `cry-aac` com `latest` e `legacy`; `item` (`sprites/items`, ícones da Item Dex). Pacotes completos: arte oficial ~344 MB, HOME ~320 MB, 3D ~238 MB, pixel ~3 MB, gritos ~27 MB (`.ogg`) ou ~20 MB (AAC), ícones de itens ~14 MB.
- **Ícones de itens (RF05.2):** a fonte `item` tem `entity: 'item'` em `MEDIA_SOURCES`: os arquivos se chamam `<identifier>.png` e vão para `item_icons(item_id, path, bytes)` (2.222 dos 2.223 itens). No app, `MediaService.itemIcon(itemId)`/`useItemIconUri` usam o mesmo cache e o "Baixar todos" inclui o pacote `item`.
- **`MediaService`** (`apps/mobile/src/shared/media/`): baixa sob demanda com `File.downloadFileAsync` para `Paths.document/media/<style>/<variant>/` (o SO não limpa), registra em `media_cache` do user DB e mantém um cache em memória da sessão. Sem rede e sem cache, devolve `null` e a UI mostra um placeholder; falhas só são tentadas de novo após 30 s. O tamanho do arquivo é conferido com os bytes da listagem (`isCompleteDownload`) ao baixar e ao ler o cache: um download cortado é apagado e baixado de novo, em vez de ficar no cache sem renderizar. "Baixar todos os pacotes" e "Apagar mídia baixada" ficam em Configurações.
- **Listas usam `pixel`** (~600 B por sprite), qualquer que seja o estilo global; o estilo escolhido vale no perfil e na árvore de evolução.
- **Gritos:** jogos da Gen 1–5 tocam o `legacy` (original), os demais o `latest`, via expo-audio.
- **Gritos no iOS (`cry-aac`):** o iOS não decodifica os `.ogg` do PokeAPI/cries (Vorbis; vários são MP3 com extensão `.ogg`). O `MediaService.cryStyle` (`cryStyleFor`, em `media-paths.ts`) escolhe `cry-aac` no iOS e `cry` nos demais; `canPlayCries` só é `false` se o data DB não tiver as fontes da plataforma. A UI não sabe qual formato toca.
  1. `pnpm media:pack` (`tools/media-pack`) lê a listagem do `data:fetch`, baixa `cries/pokemon/{latest,legacy}` no `CRIES_SHA` (cache em `.cache/media-pack/`) e converte com ffmpeg: AAC-LC 64 kbit/s em `.m4a`, sem metadados e com `+bitexact` (mesmo ffmpeg = mesmos bytes). As taxas que o AAC não aceita (10 512 Hz dos `legacy`) viram 11 025 Hz. Resultado: 2.024 arquivos, ~20 MB (0,72× os `.ogg`).
  2. A saída fica em `tools/media-pack/dist/cries-aac/`, já na estrutura publicada (`cries/pokemon/<variante>/<id>.m4a`, `README.md` com a origem e o comando, `listing.json`). A mesma listagem vai para `data/generated/media-packs/cries-aac.json` (versionada), no formato do `data:fetch`, com `repos.cries` = o `CRIES_SHA` de origem.
  3. **Publicação:** branch `media/cries-aac` do próprio TheDex, sem histórico em comum com a `main`. `MEDIA_PACKS['cries-aac'].baseUrl` em `config.ts` aponta para `raw.githubusercontent.com/samas-ai/TheDex/<sha do commit>/cries-aac`. **Nunca apague nem reescreva essa branch:** versões antigas do app baixam pelos SHAs antigos. Uma versão nova do pacote entra como commit novo por cima. Depois, atualize o `baseUrl`, rode `pnpm media:verify` e `pnpm data:build`, e commite a listagem junto.
  4. O pipeline lê a listagem versionada para as fontes com `pack` em `MEDIA_SOURCES` (`cry-aac/latest` e `cry-aac/legacy`, `format = 'm4a'`). O build falha se o pacote foi gerado de outro `CRIES_SHA`; ao mudar o `CRIES_SHA`, gere e publique o pacote de novo. O `data:validate` confere que todo grito `.ogg` tem par AAC (e vice-versa) e que toda URL de mídia está fixada num commit.
  5. Ainda não foi tocado num iPhone de verdade. O bundle iOS compila (`npx expo export --platform ios`), e um arquivo publicado foi conferido com ffprobe (AAC-LC, mono).

---

## Convenções de código

- Código, identificadores e mensagens de commit em **inglês**; documentação em **pt-BR**.
- TypeScript strict + `noUncheckedIndexedAccess`, ESM.
- Named exports. `export default` só nas rotas do Expo Router.
- Arquivos em `kebab-case.ts`, componentes React em `PascalCase.tsx`.
- Testes colocados ao lado do código (`foo.ts` + `foo.test.ts`). Fixtures em `test/fixtures/`.
- Conventional Commits (`feat(db): …`, `fix(engine): …`).
- Zod nas fronteiras: arquivos curados, backup `.thedex`, import do Showdown.
- Arquivos gerados terminam em `.generated.ts` (ou ficam em `src/generated/`) e nunca são editados à mão.

### Engine (`@thedex/engine`)

- **Funções puras:** sem I/O, sem React, sem banco, sem `Date.now()`/`Math.random()` implícitos.
- **Atributos (`stats/`):** `calcStat` usa a aritmética inteira dos jogos (Gen 1–2: DV + Stat Exp, raiz limitada a 255; Gen 3+: IV/EV/natureza; Shedinja = 1 PS) e `statBounds` dá as faixas do perfil (mín.: 0 IV/0 EV/natureza desfavorável; máx.: 31/252/favorável).
- **A geração é sempre um parâmetro explícito** (`gen: Generation`), nunca um default.
- Entradas e saídas são objetos simples. Os tipos usam os identifiers da PokeAPI (`'fire'`, `'special-attack'`…).
- **Showdown (`showdown/`):** `parseShowdownTeams` lê um set, um time ou um backup com cabeçalhos `=== [formato] Pasta/Nome ===`; `exportShowdownSet`/`exportShowdownTeam` omitem os padrões como o Showdown (na Gen 1–2 o EV padrão é 252, então zeros são escritos). Os nomes ficam em texto; o mapeamento para ids é do `@thedex/db`.
- **Cobertura de time (`team/`):** `teamDefense` (matriz por tipo atacante, alerta `critical` com 3+ fracos e `warning` com 2 fracos sem resistência) e `teamOffense` (melhor multiplicador dos golpes de dano). As imunidades de habilidade (`types/abilities.ts`: Levitate, Flash Fire, Volt Absorb…, Lightning Rod/Storm Drain só a partir da Gen 5, Wonder Guard) entram na defesa; outros efeitos de habilidade e item, não.
- **Captura (`catch/`, RF11.2):** `catchChance` segue as decompilações da pret (Gen 1–4) e o ponto fixo de 4096 documentado por Bulbapedia/Dragonfly Cave (Gen 5–9), com os bugs dos jogos (Gen 2: status só conta sono/congelamento, Level Ball ignora PS e status, Love Ball com o mesmo gênero, Moon Ball nunca vale; Heavy Ball da HGSS sem a faixa 0). Os testes usam exemplos calculados passo a passo. Decisões onde as fontes divergem:
  - Gen 1 usa a forma fechada com RNG independente (as Great/Ultra Balls reais têm RNG correlacionado).
  - Gen 3–4: `a = 0` (Heavy Ball da HGSS em lendários leves) divide por zero no jogo; o engine usa 1 e marca `clamped`.
  - Gen 6+: `pow(…, 3/16)` em float32; Roto Catch ×2; Safari/Sport Ball ×1 na Gen 8 (SwSh); Heavy Ball com mínimo 1 (regra de USUM em diante; em SM era 0).
  - Let's Go, Legends: Arceus/Z-A e Colosseum/XD têm sistemas próprios: a calculadora mostra a fórmula da geração e avisa.
- **100% de cobertura** (threshold no Vitest). Os testes usam valores de referência da Bulbapedia e do Showdown e cobrem os casos extremos: Shedinja HP = 1, DV/Stat Exp na Gen 1–2, floors da natureza, tabela de tipos da Gen 1 (Ghost × Psychic = 0) e Fada/Aço antes e depois da Gen 6.

### Banco (`@thedex/db`)

- SQL só nos repositórios de `@thedex/db`, nunca em componentes ou hooks de UI.
- Os repos recebem a instância Drizzle por parâmetro (better-sqlite3 em testes e no pipeline, expo-sqlite no app).
- O data DB é tratado como read-only.
- Toda consulta quente tem teste de `EXPLAIN QUERY PLAN`. O teste reprova `SCAN <tabela grande>` sem índice; scans de virtual table FTS são permitidos.
- As consultas quentes rodam numa conexão igual à do app (`openAppLikeConnection`: user DB em memória migrado + game DB anexado), então o filtro de captura, que cruza os dois bancos, também é verificado. Hoje são 118 consultas (busca, lista com cada ordenação e filtro, abas do perfil, listas e detalhes das Dexes da Fase 3, times, checklist e nomes do Showdown da Fase 4).
- Repositórios da Fase 4: `teams.ts` (`teamMemberSchema`, `listTeams`, `getTeam`, `saveTeam`, `deleteTeam` com tombstone), `checklist.ts` (`checklistScope`, `listChecklistDex`, `getChecklistEntries`, `setChecklistEntries` em lotes de 200, `getChecklistFlags`) e `team-data.ts` (`getMoveSummaries`, `getEntityNames`, `resolveShowdownNames`, `getShowdownNames`). A legalidade dos golpes usa `getLearnableMoveIds` (`learnset.ts`): o learnset da variedade, o da variedade base (Mega, G-Max, formas de batalha) e o das pré-evoluções (golpes de ovo do Larvitar valem para o Tyranitar), como o validador do Showdown. `createUlid(time, random)` gera os ids dos times.
- Repositórios da Fase 5: `backup.ts` (`backupSchema`, `parseBackup` com `BackupError`, `exportBackup`, `summarizeBackup`, `restoreBackup`) e `sync.ts` (`SyncTransport`, `syncUserData`, `getSyncState`). Os testes rodam num user DB em memória (`packages/db/test/backup.test.ts`), sem o data DB.
- Repositórios da Fase 3: `moves.ts` (`listMoves`, `getMoveDetail`, `getMoveLearners`, `listGmaxMoves`), `abilities.ts` (`listAbilityDex`, `getAbilityDetail`, `getAbilityHolders`), `items.ts` (`listItems`, `getItemDetail`), `locations.ts` (`listLocationRegions`, `listLocations`, `getLocation`), `encounters.ts` (`getLocationEncounters`), `natures.ts` (`listNatures`) e `getGameFeatures` (o que a PokeAPI tem do jogo: learnsets, encontros; e as mecânicas). Os dados de golpe vêm do VG base do jogo (`ctx.versionGroupIds[0]`); golpes Z/Max só aparecem na lista em jogos com a mecânica (`games.has_z`/`has_dynamax`).

### UI (Fase 2+)

- Feature-Sliced: `src/app/` (rotas do Expo Router, finas) → `src/features/` → `src/entities/` → `src/shared/`. Features não importam umas às outras; o que é comum vai para `entities/` ou `shared/`.
- **Rotas:** abas em `src/app/(tabs)/` (`expo-router/js-tabs`): `/` (Pokédex, RF01), `/moves` (RF03), `/abilities` (RF04), `/items` (RF05) e `/more` (busca global em todas as entidades + atalhos). No stack raiz, sobre as abas: `/pokemon/[id]` (RF02), `/move/[id]`, `/ability/[id]`, `/item/[id]`, `/location/[id]`, `/locations` (RF06), `/types?type=<id>` (RF07.1), `/natures` (RF07.2), `/game` (seletor, modal), `/settings`, `/pro` (TheDex PRO, modal), `/diagnostics` (só em `__DEV__`). O cabeçalho das abas tem o chip do jogo e Configurações (`features/navigation/HeaderActions.tsx`).
- **Ferramentas (Fase 4)**, abertas pela seção "Ferramentas" de `/more` e pelos atalhos do cabeçalho do perfil (comparar, calculadoras): `/teams` (RF08.1), `/team/[id]` (abas Time, Cobertura e Exportar), `/team/[id]/[slot]` (RF08.2), `/team-import` (modal, RF08.4), `/checklist` (RF09), `/compare?ids=6,9` (RF10, até 6), `/calc/stats?pokemon=<id>` e `/calc/catch?pokemon=<id>` (RF11).
- Um time é montado para o **seu** jogo, não o selecionado: `useGameContextFor(team.gameId)` resolve o contexto dele. `team-store.ts` guarda em memória os times abertos (lista, time e slot ficam em sincronia) e grava cada mudança no user DB na hora.
- Seletores reutilizáveis: `PokemonPicker` (Pokédex do jogo + busca FTS), `PickerModal` (lista com busca local normalizada por `normalizeSearchText`), `NumberField`, `ProgressBar`. Exportação: texto via `expo-clipboard` e `Share` do RN; card em PNG via `react-native-view-shot` + `expo-sharing`.
- Ordem dos providers em `src/app/_layout.tsx`: `DatabaseProvider` → `SettingsProvider` → `ProProvider` (plano; o tema precisa de `theme.amoled`) → i18n → `ThemeProvider` (+ tema do React Navigation) → `GameProvider` (contexto + `features` do jogo) → `MediaProvider` → `CatalogProvider` (nomes de tipos, atributos e categorias de golpe do jogo).
- Listas das Dexes: `ListToolbar` (busca + chips + contagem), `SortSheet` genérico, `useEntitySearch(tipo, texto)` + `applySearch` (busca FTS cruzada com a lista filtrada), `toSectionRows` para listas com seções no FlashList. Detalhes com listas longas (quem aprende o golpe, portadores da habilidade, encontros do local) usam FlashList com o conteúdo no `ListHeaderComponent`. Ícones: `@expo/vector-icons` (`shared/ui/Icon.tsx`, Material Community Icons, fonte embarcada).
- O banco chega aos componentes por `useAppDatabase()` (`src/shared/db/DatabaseProvider.tsx`). Os repos de `@thedex/db` recebem `db` desse hook, e o contexto de jogo vem de `useGame().ctx`. Carregamentos assíncronos usam `useAsync(load, deps)` (`src/shared/hooks/`), que ignora respostas obsoletas.
- **Configurações** ficam na tabela `settings` do user DB (JSON por chave: `ui_lang`, `game_langs`, `theme`, `sprite_style`, `game_id`). `decodeSettings` valida o que vier do banco e cai nos padrões; `useSettings().updateSettings(patch)` grava com `updated_at`.
- Lógica pura do app (formatação, filtros, faixas de atributos, texto de evolução, mídia) fica em módulos `.ts` sem React Native, testados pelo projeto Vitest `mobile` (`apps/mobile/vitest.config.mts`).
- Dependências nativas só via `npx expo install`. Antes de usar uma API do Expo/RN, confira a doc da versão do SDK em uso (`https://docs.expo.dev/versions/v58.0.0/`): elas mudam a cada SDK.
- Cores só via `@thedex/ui-tokens` e `useTypeAccent(typeId)`. Nada de hex solto. `useTheme()` dá o tema (claro, escuro ou AMOLED `#000000`); `useTypeAccent` aceita o identifier ou o id da PokeAPI e devolve `base`, `onBase`, `tint`, `tintStrong`, `text` e `border`, com contraste ≥ 4,5:1 testado para os 18 tipos nos três temas.
- Strings de UI via i18next. Strings de jogo só vindas do banco (nomes de tipos, atributos e categorias de golpe via `useCatalog()`). Grupos de item e tipos de local são conceitos do app e ficam no i18next.
- Sprites, cries e ícones de item só via `MediaService` (URLs nunca hard-coded; expo-image para imagens, expo-audio para gritos).
- Listas longas com FlashList.

### Freemium (Fase 5, RNF08)

- **Registro:** `apps/mobile/src/shared/pro/features.ts` (lógica pura, testada). `FEATURES` diz o plano mínimo de cada feature: `ads.removed`, `team.unlimited` (o grátis guarda `FREE_TEAM_LIMIT = 3` times), `checklist.shiny` (marcar shiny, filtro "Sem shiny", lote shiny), `pokedex.combinedFilters` (filtros de mais de um grupo ao mesmo tempo; dois tipos contam como um grupo) e `theme.amoled`. Liberar uma feature para todos é trocar `plan: 'pro'` por `'free'`.
- **Componentes nunca leem o plano (`isProUser`) direto.** Usam `useFeature(key)`, `useRequirePro()` (`requirePro(feature, ação)`: roda a ação ou abre `/pro`), `<ProGate feature label? fallback?>` (bloco travado com cadeado) e `<AdSlot placement>`. Só a tela `/pro` usa `usePro()` (plano, comprar, restaurar, simulação).
- **Dados do usuário nunca ficam presos:** times acima do limite continuam editáveis, marcas shiny existentes aparecem, um AMOLED salvo vira escuro (`unlockedTheme`) e volta sozinho com o PRO, e restaurar backup não passa pelo limite. Só o que é novo (criar/importar time, marcar shiny, combinar filtros, escolher AMOLED) é bloqueado.
- **Origem do plano:** `EntitlementSource` (`entitlement-source.ts`) com `load`/`purchase`/`restore` e o `subscribe` opcional (mudanças que a loja avisa sozinha). `load` responde pelo cache offline da loja (StoreKit e Play Billing guardam as compras no aparelho), porque o `ProProvider` só renderiza depois dele. `_layout.tsx` cria a fonte uma vez com `createEntitlementSource()` (`expo-iap-store.ts`): a loja num build nativo, `noStoreSource` onde falta o módulo nativo `ExpoIap` (Expo Go, web; todos no grátis, botões desativados e a tela avisa). Em `__DEV__`, a tela PRO simula o plano (em memória) por cima de qualquer fonte.
- **Compra na loja (expo-iap):** PRO é **um único produto não consumível** ("PRO para sempre", sem assinatura), id `PRO_PRODUCT_ID = 'thedex_pro'` nas duas lojas. O app é `com.thedex.app` (bundle id do iOS e package do Android, em `app.json`). A lógica fica em `store-source.ts` (`createStoreSource(api)`), sem React Native e testada com uma loja falsa. `expo-iap-store.ts` só liga a `StoreApi` às funções do expo-iap (OpenIAP: StoreKit 2 e Play Billing).
  - `load`: conecta, lê `getAvailablePurchases` (StoreKit `currentEntitlements` e o cache do app da Play Store, sem rede) e vira PRO se houver o produto com `purchaseState = 'purchased'`. Uma compra reembolsada some da lista, e o próximo boot volta ao grátis. Se a loja falhar ou não responder em `STORE_LOAD_TIMEOUT_MS` (3 s), o app abre no grátis, e a resposta atrasada chega pelo `subscribe`.
  - `purchase`: confere o produto (`fetchProducts`, precisa de rede), abre a folha da loja e espera o evento. Comprado: finaliza a transação (no Android isso é o acknowledge; sem ele o Google reembolsa em 3 dias) e devolve `pro`. Cancelado: devolve o plano atual, sem erro. Pendente (Ask to Buy, boleto, cartão lento): rejeita com `PurchasePendingError`, a tela avisa e o PRO chega pelo `subscribe` quando a loja confirmar. `already-owned` relê as compras. Só roda um fluxo por vez.
  - `restore`: `restorePurchases` (no iOS é o `AppStore.sync`, que usa a rede e pode pedir login) e depois relê o cache. Transações não finalizadas são finalizadas de novo no boot (o StoreKit as reenvia; no Android o `load` faz o acknowledge das pendentes).
  - **Sem servidor de validação**, de propósito (app offline): o StoreKit 2 só entrega transações que ele verificou no aparelho, e no Android o app confia no cache do Play Billing (não confere a `signatureAndroid` com a chave pública do app). Um aparelho com root consegue forjar o PRO; é o risco aceito.
- **Build e teste das compras.** O Expo Go não tem o módulo do expo-iap, então as compras exigem um build de desenvolvimento. Os produtos e as contas de teste são criados pelo dono do app nos consoles; o código não cria nada.
  1. **App Store Connect:** app com o bundle `com.thedex.app`, compra não consumível `thedex_pro` com preço e textos, contrato de apps pagos assinado e um testador sandbox (Usuários e acesso → Sandbox). A capability In-App Purchase já vem ativa em toda App ID.
  2. **Play Console:** app `com.thedex.app`, produto de app `thedex_pro` ativo e um AAB enviado a uma trilha de teste interno (o Play só vende produtos de um app que já tem uma versão numa trilha). Ponha as contas de teste em Configurações → Teste de licença: elas compram sem cobrança e têm cartões de teste, incluindo um que aprova com atraso (fluxo pendente).
  3. **Build:** em `apps/mobile`, `npx expo prebuild --clean` e depois `npx expo run:android --device` (Android SDK + JDK) ou `npx expo run:ios --device` (só no macOS, com Xcode). Sem Mac, use o EAS Build com um perfil `development` (`eas build --profile development --platform ios`; o repositório ainda não tem `eas.json`). O plugin do expo-iap já está em `app.json`, e a permissão `BILLING` vem do manifesto da biblioteca. Se o `pod install` reclamar da versão do iOS, defina `ios.deploymentTarget` pelo `expo-build-properties`.
  4. **Roteiro:** em `/pro` o botão fica ativo (no Expo Go fica desativado, com o aviso); comprar → PRO; fechar e abrir em modo avião → continua PRO; cancelar a folha → continua grátis, sem erro; cartão de aprovação lenta (Android) ou Ask to Buy (sandbox do iOS) → aviso de pendente e PRO sozinho quando aprovar; desinstalar, reinstalar e "Restaurar compra" → PRO; reembolsar no Play Console (com revogação) → grátis no próximo boot.
  - **Ainda não verificado:** nada disso rodou num aparelho ou numa loja. Até agora foram verificados os testes de `store-source.test.ts` (loja falsa: cache, timeout, compra, cancelamento, pendente, já comprado, restauração, reembolso), o typecheck e a compilação dos bundles Android/iOS (`npx expo export`). O botão de compra ainda não mostra o preço (`fetchProducts` traz o `displayPrice`).
- **Anúncios:** `<AdSlot>` reserva 50 px (banner 320×50) no fim do conteúdo, nunca entre linhas de lista. Posições em `AD_PLACEMENTS` (`more`, `profile`). Sem rede de anúncios (o app é offline), o espaço mostra o banner do próprio TheDex PRO.

### Backup e sync (Fase 5, RNF06)

- **Formato `.thedex`:** JSON `{ format: 'thedex-backup', version, exportedAt, data: { settings, favorites, teams, checklistEntries } }`, validado com Zod (`backupSchema`). Inclui tombstones; `media_cache` e `sync_state` ficam de fora. Os membros dos times vão como objetos e são validados como no banco (inválidos caem). `BACKUP_VERSION` só sobe em mudança incompatível: campos novos não mudam a versão (o Zod descarta o que não conhece), e um arquivo de versão maior é recusado com `newer-version`.
- **Restauração** (`restoreBackup(db, backup, mode, now)`, numa transação):
  - `merge`: LWW por linha (`updated_at` maior vence, empate mantém o do aparelho). Repetir não muda nada. É o mesmo merge do sync.
  - `replace`: as linhas vivas do backup viram o estado atual e as outras linhas vivas ganham tombstone. Tudo recebe um carimbo acima do maior `updated_at` guardado, para vencer o próximo sync. É assim que um time apagado depois do backup volta (no `merge`, o tombstone mais novo vence). Configurações não têm tombstone: chaves que faltam no backup ficam como estão.
- **App:** a seção "Backup" de Configurações (`features/settings/BackupSection.tsx`) exporta para `Paths.cache` e abre a folha de compartilhamento (Drive, Arquivos, e-mail…). Para restaurar, `File.pickFileAsync()` do `expo-file-system` (sem filtro de MIME: o `.thedex` não tem tipo registrado), um resumo e a escolha Mesclar/Substituir. Depois, `notifyUserDataReplaced()` (`shared/db/user-data-events.ts`) faz as configurações, o cache de times, o checklist e a Pokédex (filtro de captura) recarregarem; quem ler dados do usuário põe `useUserDataVersion()` nas deps.
- **Sync (estrutura pronta, sem provedor):** um `SyncTransport` (`provider`, `download`, `upload`) guarda um snapshot `.thedex` por conta. `syncUserData` baixa, mescla (LWW), sobe o estado mesclado e registra `sync_state` (o `device_id` da primeira vez fica). Google Drive/iCloud entram como transportes, sem mudar o merge.
