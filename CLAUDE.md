# TheDex — Diretrizes do projeto

TheDex é uma Pokédex **100% offline**, multi-geração, com multilíngue dual (idioma da UI ≠ idioma dos dados de jogo) e modelo freemium. A especificação completa do produto está em [`docs/SPEC.md`](docs/SPEC.md).

**Fases:**

| Fase | Escopo                                                                 | Status      |
| ---- | ---------------------------------------------------------------------- | ----------- |
| 1    | Monorepo, schema SQLite, pipeline de dados, busca FTS5                 | concluída\* |
| 2    | Temas e paleta por tipo, seletor de jogo, RF01–RF02, cache de mídia    | —           |
| 3    | RF03–RF07 (Move, Ability, Item, Location, Type e Nature Dex)           | —           |
| 4    | RF08–RF11 (Team Builder/Showdown, Checklist, Comparador, Calculadoras) | —           |
| 5    | Backup/restore e feature flags PRO                                     | —           |

\* Falta validar a tela de diagnóstico num aparelho Android real (Expo Go / APK de release em modo avião).

---

## Comandos

Requisitos: Node ≥ 24 LTS e pnpm 10 via corepack. Rode `corepack enable`; sem admin no Windows, use `corepack enable pnpm --install-directory "%APPDATA%\npm"`.

O `better-sqlite3` ≥ 13 já traz binários prontos. Ele fica em `ignoredBuiltDependencies` para o pnpm não tentar compilá-lo, o que exigiria o Visual Studio.

| Comando                                        | O que faz                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm install`                                 | Instala o workspace (`node-linker=hoisted`)                                                    |
| `pnpm data:fetch`                              | Baixa os CSVs da PokeAPI (SHA fixado) para `.cache/sources/`                                   |
| `pnpm data:build`                              | Gera `tools/data-pipeline/dist/thedex-data.db` + `manifest.json` e copia para o app            |
| `pnpm data:validate`                           | Integridade, FKs, contagens, fatos pontuais, teste cruzado com o engine e orçamento de tamanho |
| `pnpm bench:search`                            | Benchmark de busca contra o `.db` real (p95 < 100 ms)                                          |
| `pnpm test`                                    | Vitest em todos os projetos (o engine exige 100% de cobertura)                                 |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | Qualidade                                                                                      |
| `pnpm db:generate`                             | Gera migration do user DB (drizzle-kit) e o bundle `migrations.generated.ts`                   |
| `pnpm --filter @thedex/mobile start`           | Metro/Expo (rode `pnpm data:build` antes: o app embarca o `.db`)                               |
| `npx expo install <pkg>` (em `apps/mobile`)    | Única forma de adicionar dependências ao app (resolve versões compatíveis com o SDK)           |
| `npx expo export --platform android`           | Gera o bundle JS + assets (verifica a resolução do monorepo sem aparelho)                      |

---

## Arquitetura

```
apps/mobile/            @thedex/mobile        Expo SDK 58 + Expo Router (rotas em src/app/)
packages/engine/        @thedex/engine        mecânicas puras (TS, zero deps, zero I/O)
packages/db/            @thedex/db            schema Drizzle (game + user), DDL, repositórios, busca
tools/data-pipeline/    @thedex/data-pipeline CSV PokeAPI + @pkmn/dex + curados → thedex-data.db
data/curated/           JSONs curados versionados (jogos, tags, pt-BR, aliases, overrides)
```

**Dependências permitidas:** `engine` ← `db` ← `mobile`. O `data-pipeline` depende de `db` e `engine`. O engine não importa nada do monorepo, e a UI nunca importa `better-sqlite3` nem o pipeline.

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

O `DATA_VERSION` é **determinístico**: é um hash do SHA da PokeAPI, da versão do `@pkmn/dex`, dos JSONs curados e do código do schema/pipeline. Rebuild sem mudança de entrada gera a mesma versão. Depois de mexer no pipeline ou no schema, rode `pnpm data:build` e commite o `data-manifest.ts` atualizado.

### Pipeline no build (o "seeding" do RNF01)

Etapas: `fetch → load → derive → finalize → validate`. As fontes são fixadas para builds reproduzíveis:

1. **PokeAPI CSV** (`data/v2/csv`), no SHA em `tools/data-pipeline/src/config.ts`.
2. **`@pkmn/dex`** (dados do Pokémon Showdown, MIT), na versão fixada no `package.json`. Fornece IDs do Showdown, flags de golpe, Z/Max power, mudanças de forma e o Special da Gen 1.
3. **`data/curated/*.json`**, que cobre as lacunas da PokeAPI.

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
  generationId: number;
  versionGroupIds: readonly number[];
  langChain: readonly string[]; // ex.: ['pt-BR', 'en'] ou ['ja', 'ja-Hrkt', 'en']
}
```

### Multilíngue dual

- **UI:** i18next, com arquivos de locale no app.
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
| Golpes              | `moves`, `move_stats_by_vg`, `move_meta`, `move_meta_stat_changes`, `move_flags`, `move_flag_map`, `move_targets`, `move_damage_classes`, `move_learn_methods`, `move_variants`, `pokemon_moves`, `machines`                                                                                                                              |
| Habilidades / itens | `abilities`, `items`, `item_categories`, `item_pockets`, `item_fling_effects`, `item_flags`, `item_flag_map`, `berries`, `berry_flavor_map`, `item_locations`                                                                                                                                                                             |
| Locais              | `locations`, `location_areas`, `encounter_methods`, `encounter_slots`, `encounters`, `encounter_conditions`, `encounter_condition_values`, `encounter_condition_value_map`                                                                                                                                                                |
| Outros              | `natures`, `flavors`, `types`, `stats`, `media_assets`                                                                                                                                                                                                                                                                                    |
| Traduções           | `<entidade>_i18n` (nomes; espécie + `genus`; forma + `form_name`/`pokemon_name`), `move_effect_i18n`, `ability_prose_i18n` (+ `overworld_effect`), `item_prose_i18n`, `flavor_texts` (texto deduplicado) + `species_flavor_text`, `move_flavor_text`, `ability_flavor_text`, `item_flavor_text`                                           |
| Busca               | `search_terms`, `search_fts` (FTS5 trigram)                                                                                                                                                                                                                                                                                               |

**Notas de modelagem:**

- `pokemon` = variedade com stats próprios (ex.: Charizard, Mega Charizard X, Raichu de Alola). `pokemon_forms` = formas, incluindo as cosméticas que compartilham o `pokemon_id` (Unown, Vivillon).
- `pokemon_moves` é a maior tabela. PK `(pokemon_id, version_group_id, method_id, move_id, level)`, `WITHOUT ROWID`, mais o índice `(move_id, version_group_id)`. A aba "Evolução" = level-up nível 0 em version groups da Gen 7+.
- `encounters.slot_id` é anulável, e `rate_pct`/`extra_json` comportam os modelos dos jogos novos (clima, alpha, outbreak).
- A **tabela de efetividade de tipos não fica no banco**: o engine é a fonte da verdade. O `validate` confere a tabela da PokeAPI contra o engine.
- `item_locations` e `media_assets` existem no schema mas são populadas em fases futuras.
- `flavor_texts(id, text)` não tem idioma: o mesmo texto é guardado uma vez, mesmo entre idiomas (o `es-419` reaproveita o `es`). O idioma fica na tabela que referencia.
- `ps_id`: todos os Pokémon da série principal estão mapeados. Ficam sem mapeamento, de propósito, os modos cosméticos de Koraidon/Miraidon, os golpes Shadow (Colosseum/XD) e os itens que não são de batalha.

### `thedex-user.db` (dados do usuário, pronto para sync)

**Convenções:**

- PK natural quando existe; ULID só para entidades sem chave natural.
- Toda linha tem `updated_at` (epoch ms) e `deleted_at` (tombstone). O merge é last-write-wins.
- Referências ao jogo usam IDs da PokeAPI, sem FK física entre os bancos.

| Tabela              | Chave                              | Notas                                                                                                                                                                                      |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `settings`          | `key`                              | `ui_lang`, `game_langs`, `theme` (`system\|light\|dark\|amoled`), `sprite_style` (`official\|pixel\|3d\|home`), `game_id`                                                                  |
| `favorites`         | `(entity_type, entity_id)`         |                                                                                                                                                                                            |
| `teams`             | `id` (ULID)                        | `members_json` = até 6 `PokemonSet` compatíveis com o Showdown, validados com Zod. O time é a unidade de sync. Limites de EV por geração vivem no engine (na Gen 1–2, 252 em tudo é legal) |
| `checklist_entries` | `(dex_scope, pokemon_id, form_id)` | `dex_scope` = `national` ou `version:<id>`; `form_id = 0` = forma padrão, senão `pokemon_forms.id` (Living Dex por forma)                                                                  |
| `media_cache`       | `key`                              | Local ao aparelho, fora do backup                                                                                                                                                          |
| `sync_state`        | `provider`                         | Fora do backup                                                                                                                                                                             |

**Migrations:** `pnpm db:generate` roda o drizzle-kit (driver expo) em `packages/db/migrations/user/`, e `scripts/bundle-migrations.ts` gera `migrations.generated.ts` com o SQL como string. Funciona em Metro, Vitest e Tauri, sem plugin babel. **Nunca edite uma migration já publicada.**

---

## Fontes de dados, lacunas e orçamento

| Lacuna na PokeAPI                               | Tratamento                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| pt-BR sem textos                                | `data/curated/i18n-pt-BR.json` + fallback `en`                                     |
| Encontros de SV, Legends: Arceus, BDSP          | Schema pronto; curadoria futura                                                    |
| Learnsets do Legends: Z-A (VG 30–31)            | Ausentes no SHA fixado; aguardar a PokeAPI ou curar                                |
| Learnsets próprios das DLCs (VG 21, 22, 26, 27) | Ausentes: os golpes ficam no version group base; o `GameContext` já une os VGs     |
| Localização de itens (RF05.2)                   | `item_locations` curada (futuro)                                                   |
| Efeito fora de batalha das habilidades          | `ability_prose_i18n.overworld_effect` (curado, futuro)                             |
| Tags inicial / Ultra Beast / Paradoxo / fóssil  | `data/curated/species-tags.json`                                                   |
| IDs do Showdown que fogem da regra              | `data/curated/ps-id-overrides.json`                                                |
| Cries em `.ogg` (o iOS não toca)                | Transcodificar para AAC/m4a na Fase 2                                              |
| Sprites (repositório de ~25 GB)                 | Sob demanda, a partir de um commit fixado; `media_assets` gerado no build (Fase 2) |

**Orçamento de tamanho do `thedex-data.db`:** alerta em 50 MB, falha em 60 MB.

- O `finalize` imprime o peso por tabela e índice (via `dbstat`) e o grava em `dist/manifest.json`, com a `pokemon_moves` em destaque.
- A `pokemon_moves` é sempre `WITHOUT ROWID`.
- **Deduplicação por jogo** (`--dedupe-learnsets`): linhas idênticas entre os version groups de um mesmo jogo ficam só no version group base, e o repo faz a união pelos `versionGroupIds`. Um teste de equivalência protege essa troca. Ela é ligada automaticamente só se o banco passar de 60 MB e houver o que remover. O `manifest.json` informa o potencial em `learnsetDedupePotential`.
- **Estado no SHA fixado:** 52,4 MB (alerta ativo). `pokemon_moves` ocupa 18,9 MB (36%, sendo 8,8 MB de índices), `flavor_texts` 9,2 MB, `encounters` 5,9 MB e busca (termos + FTS) 7,4 MB. O potencial da deduplicação é 0, porque a PokeAPI não tem learnsets de DLC.
- **Próximas alavancas, se precisar:** remover `es-419`/`cs` dos textos longos, ou deixar o índice `(move_id, version_group_id)` como tabela inversa compacta.

**Propriedade intelectual:** os repositórios de sprites e cries são CC0, mas o conteúdo é © The Pokémon Company. Faça uma revisão jurídica antes de publicar nas lojas.

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
- **A geração é sempre um parâmetro explícito** (`gen: Generation`), nunca um default.
- Entradas e saídas são objetos simples. Os tipos usam os identifiers da PokeAPI (`'fire'`, `'special-attack'`…).
- **100% de cobertura** (threshold no Vitest). Os testes usam valores de referência da Bulbapedia e do Showdown e cobrem os casos extremos: Shedinja HP = 1, DV/Stat Exp na Gen 1–2, floors da natureza, tabela de tipos da Gen 1 (Ghost × Psychic = 0) e Fada/Aço antes e depois da Gen 6.

### Banco (`@thedex/db`)

- SQL só nos repositórios de `@thedex/db`, nunca em componentes ou hooks de UI.
- Os repos recebem a instância Drizzle por parâmetro (better-sqlite3 em testes e no pipeline, expo-sqlite no app).
- O data DB é tratado como read-only.
- Toda consulta quente tem teste de `EXPLAIN QUERY PLAN`. O teste reprova `SCAN <tabela grande>` sem índice; scans de virtual table FTS são permitidos.

### UI (Fase 2+)

- Feature-Sliced: `src/app/` (rotas do Expo Router, finas) → `src/features/` → `src/entities/` → `src/shared/`.
- O banco chega aos componentes por `useAppDatabase()` (`src/shared/db/DatabaseProvider.tsx`). Os repos de `@thedex/db` recebem `db` desse hook.
- Dependências nativas só via `npx expo install`. Antes de usar uma API do Expo/RN, confira a doc da versão do SDK em uso (`https://docs.expo.dev/versions/v58.0.0/`): elas mudam a cada SDK.
- Cores só via `@thedex/ui-tokens` e `useTypeAccent(typeId)`. Nada de hex solto.
- Strings de UI via i18next. Strings de jogo só vindas do banco.
- Sprites e cries só via `MediaService` (URLs nunca hard-coded; expo-image para `.webp`).
- Listas longas com FlashList.

### Freemium (Fase 5)

- Registro de features em `features.ts`, com `useFeature('team.unlimited')`, `<ProGate feature>` e `<AdSlot placement>`.
- **Componentes nunca leem `isProUser` direto.**

### Backup e sync (Fase 5)

- `.thedex` = JSON versionado (`{ format: 'thedex-backup', version, exportedAt, data }`), validado com Zod.
- Inclui tombstones, e o merge é LWW por `updated_at`.
