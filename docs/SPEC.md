# Projeto: TheDex — Aplicativo & Software Completo de Pokédex Offline

> Especificação original do produto, preservada como referência. As decisões de arquitetura derivadas dela estão no [`CLAUDE.md`](../CLAUDE.md).

Atue como um Arquiteto de Software Principal e Engenheiro Full-Stack/Mobile Sênior. Sua missão é projetar, estruturar e implementar o **TheDex**, uma enciclopédia e suíte de ferramentas Pokémon 100% offline, ultra-rápida e multiplataforma, inspirada no dataDex.

---

## 1. Arquitetura e Requisitos Não Funcionais (RNF)

- **RNF01. Operação 100% Offline:** Todo o banco de dados textual, relacional e ícones básicos devem ser embarcados localmente (SQLite com índices otimizados e FTS5 / Drizzle ORM ou Prisma / Room) para que o app funcione sem conexão com a internet. Inclua um script de _seeding_ automatizado que popule o banco local a partir dos dados da PokeAPI (via dump JSON/CSV local).
- **RNF02. Gestão de Mídia sob Demanda:** Para não inflar o tamanho inicial do instalador, _sprites_ em alta definição (3D/HOME) e arquivos de áudio (_Cries_) devem ser baixados sob demanda e salvos em cache no sistema de arquivos local, com uma opção nas configurações para "Baixar todos os pacotes de mídia para uso offline".
- **RNF03. Design Dinâmico por Tipo:** A interface (UI) deve alterar sua paleta de cores de destaque, fundos e abas dinamicamente conforme o tipo primário do Pokémon ou golpe visualizado (ex: tons avermelhados para Fogo, azulados para Água).
- **RNF04. Temas e Personalização:** Suporte nativo a Modo Claro (_Light Mode_), Modo Escuro (_Dark Mode_) e Modo AMOLED (Preto absoluto `#000000`), além de permitir trocar globalmente o estilo dos _sprites_ padrão (Arte Oficial, Pixel Art 2D, Modelos 3D, Pokémon HOME).
- **RNF05. Multilíngue Dual (UI vs. Game Data):** Permitir que o idioma da interface do aplicativo seja independente do idioma dos dados do jogo (ex: interface em Português, mas nomes de Golpes, Habilidades, Naturezas e Itens em Inglês para facilitar o uso competitivo).
- **RNF06. Backup e Sincronização:** Permitir backup manual (exportar/importar arquivo `.json` / `.thedex` local) e estrutura pronta para sincronização em nuvem (Google Drive / iCloud) salvando times criados, favoritos e o progresso do _Checklist_ de capturas.
- **RNF07. Performance de Busca (<100ms):** A barra de busca global e os filtros da Pokédex devem retornar resultados em menos de 100ms utilizando índices SQLite/FTS, com suporte a busca parcial (ex: digitar "char" retorna Charmander, Charmeleon, Charizard, Chimchar, Charcadet).
- **RNF08. Modelo Freemium (Feature Flags & Monetização):** Arquitetar um sistema limpo de controle de acesso (`isProUser`) separando funcionalidades gratuitas (com suporte a componentes de espaço reservado para banners de anúncios não intrusivos) de uma versão **PRO** (pagamento único ou assinatura) que remove anúncios e desbloqueia recursos avançados (Team Builder ilimitado, Checklist Shiny, filtros combinados avançados e temas AMOLED/extras).

---

## 2. Requisitos Funcionais (RF) — Core & Enciclopédias (Dexes)

### RF01. Pokédex Principal (Listagem e Busca de Pokémon)

- **RF01.1. Listagem Completa:** Listar todos os Pokémon da Geração 1 até a geração atual (incluindo DLCs e jogos spin-off principais como Legends: Arceus).
- **RF01.2. Seletor Global de Jogo/Versão:** O usuário deve poder selecionar um jogo específico (ex: Emerald, Platinum, Scarlet/Violet) para que toda a base de dados (numeração da Dex, golpes aprendidos, habilidades, localizações, tipagem histórica e sprites) se adapte exatamente às regras daquela versão.
- **RF01.3. Filtros Avançados:** Filtrar a lista por: Tipo (1 ou 2 combinados), Geração, Região, Habilidade, Grupo de Ovo (Egg Group), Status de Captura (Visto, Capturado, Shiny) e Categoria (Inicial, Lendário, Mítico, Ultra Beast, Paradoxo).
- **RF01.4. Ordenação:** Ordenar por Número (Nacional ou Regional), Nome (A-Z / Z-A), Peso, Altura e Base Stats (Total, HP, Attack, Defense, Sp. Atk, Sp. Def, Speed).

### RF02. Perfil Detalhado do Pokémon

- **RF02.1. Cabeçalho e Mídia:** Exibir nome, número, categoria (espécie), tipos, sprites normais e shiny (alternáveis com um toque) e reprodução do grito (_Cry_) original em áudio.
- **RF02.2. Informações Gerais:** Exibir entradas de texto da Pokédex (por versão do jogo), altura, peso, habilidades (normais e Hidden Ability com modal/sheet de descrição ao clicar), EV Yield, taxa de captura (Catch Rate), amizade base, proporção de gênero, ciclos de ovo e grupo de experiência.
- **RF02.3. Efetividade de Tipos (Defensiva):** Exibir tabela visual mostrando as fraquezas, resistências e imunidades do Pokémon (4×, 2×, 1×, 0.5×, 0.25×, 0×) com base na tipagem e geração selecionada (respeitando mudanças históricas como o tipo Aço/Fada na Gen 1-5 vs Gen 6+).
- **RF02.4. Atributos Base (Base Stats):** Exibir barras visuais animadas com os valores base de HP, Atk, Def, SpA, SpD, Spe e o Total (BST), além de calcular automaticamente os valores mínimos e máximos no Nível 50 e Nível 100 (considerando IVs 0-31, EVs 0-252 e Natureza neutra/favorável/desfavorável).
- **RF02.5. Linha Evolutiva e Formas Alternativas:** Exibir a árvore de evolução completa e clicável com os métodos exatos de evolução (nível, pedra, amizade, troca, item, horário, local) e abas para formas alternativas (Mega Evoluções, Formas Regionais de Alola/Galar/Hisui/Paldea, Gigantamax, Formas de Clima/Item).
- **RF02.6. Lista de Golpes (Moveset):** Listar todos os golpes que o Pokémon aprende no jogo selecionado, divididos em abas: Por Nível (Level Up), por TM/HM/TR, por Cruzamento (Egg Moves), por Tutor e por Evolução.
- **RF02.7. Localizações (Locations):** Listar todas as rotas e áreas onde o Pokémon pode ser encontrado em cada versão de jogo, incluindo método de encontro (grama, surf, pesca, caverna), nível e taxa de aparição (% de spawn).

### RF03. Move Dex (Enciclopédia de Golpes)

- **RF03.1. Catálogo de Golpes:** Listar todos os golpes existentes com busca e filtro por Tipo, Categoria (Físico, Especial, Status), Geração e Jogo.
- **RF03.2. Detalhes do Golpe:** Exibir Poder (Power), Precisão (Accuracy), PP (base e máximo), Prioridade, Alvo (único, múltiplos, campo), flags (contato físico, som, soco, etc.), interação com Protect/Detect e descrição mecânica detalhada.
- **RF03.3. Compatibilidade:** Exibir a lista completa de quais Pokémon aprendem aquele golpe e por qual método.
- **RF03.4. Mecânicas Especiais:** Incluir dados de Z-Moves, Max Moves e G-Max Moves correspondentes.

### RF04. Ability Dex (Enciclopédia de Habilidades)

- **RF04.1. Catálogo e Detalhes:** Listar todas as habilidades com descrição do efeito em batalha e efeito fora de batalha (Overworld effect, se houver).
- **RF04.2. Portadores:** Listar todos os Pokémon que possuem a habilidade (separando quem a possui como habilidade regular e quem a possui como Hidden Ability).

### RF05. Item Dex (Enciclopédia de Itens)

- **RF05.1. Categorização:** Listar todos os itens divididos por categorias: Itens de Batalha (Held Items), Berries, TMs/HMs, Medicina, Pokébolas, Itens de Evolução, Tesouros e Key Items.
- **RF05.2. Detalhes do Item:** Exibir ícone, descrição do efeito, preço de compra/venda, poder e efeito do golpe _Fling_ ao segurar o item, e localização onde encontrá-lo nos jogos.

### RF06. Location Dex (Enciclopédia de Rotas e Locais)

- **RF06.1. Mapeamento por Região/Jogo:** Listar todas as cidades, rotas, cavernas e áreas especiais divididas por Região (Kanto a Paldea).
- **RF06.2. Encontros da Área:** Ao abrir um local, exibir todos os Pokémon disponíveis naquela área, detalhando a temporada/horário (Manhã, Dia, Noite), método de encontro, níveis e porcentagem de chance.

### RF07. Type Dex e Nature Dex

- **RF07.1. Type Dex:** Permitir selecionar 1 ou 2 tipos simultaneamente para visualizar a eficácia ofensiva (contra quem bate super efetivo) e defensiva (de quem apanha), além de listar os Pokémon e golpes daquela combinação.
- **RF07.2. Nature Dex:** Matriz e lista com todas as 25 Naturezas (Natures), exibindo qual atributo recebe bônus (+10%), qual recebe penalidade (-10%) e o sabor de Berry favorito/odiado.

---

## 3. Requisitos Funcionais (RF) — Ferramentas e Utilitários

### RF08. Team Builder (Construtor de Equipes)

- **RF08.1. Criação de Times:** Permitir criar múltiplos times de até 6 Pokémon, associando o time a uma geração/formato de jogo.
- **RF08.2. Customização Completa do Slot:** Para cada Pokémon no time, permitir definir: Apelido, Nível, Gênero, Status Shiny, Habilidade, Natureza, Item Segurado (Held Item), Tera Type (se Gen 9), 4 Golpes (com validação de legalidade opcional), valores de IVs (0 a 31) e distribuição de EVs (0 a 252 por atributo, máximo 510 total) com cálculo em tempo real dos atributos finais.
- **RF08.3. Análise de Cobertura do Time (Team Coverage):** Gerar uma matriz defensiva e ofensiva do time inteiro, apontando buracos críticos na defesa (ex: alerta se 3+ Pokémon são fracos contra Terra) e cobertura ofensiva dos golpes escolhidos.
- **RF08.4. Exportação/Importação:** Permitir exportar e importar times em formato texto compatível com a sintaxe oficial do _Pokémon Showdown_ e gerar um card visual (imagem/canvas) de resumo do time para compartilhamento.

### RF09. Checklist / Pokédex Tracker (Rastreador de Coleção)

- **RF09.1. Marcação de Progresso:** Permitir que o usuário marque individualmente (ou em lote por geração/caixa) cada Pokémon como Visto, Capturado ou Shiny Capturado, específico por jogo ou na National Dex.
- **RF09.2. Estatísticas de Progresso:** Exibir barra de progresso percentual (ex: "450/1025 Capturados - 43.9%") e filtros rápidos para mostrar apenas "Faltando Capturar" (focado em Living Dex e Shiny Hunting).

### RF10. Pokémon Comparator (Comparador Lado a Lado)

- **RF10.1. Comparação Direta:** Permitir selecionar 2 ou mais Pokémon para comparar lado a lado seus Base Stats (destacando o vencedor em cada atributo), tipagem, habilidades, altura/peso e fraquezas.

### RF11. Calculadoras Integradas

- **RF11.1. Calculadora de Status (Stat & IV Calculator):** Calcular os atributos exatos de um Pokémon em qualquer nível inserindo IVs, EVs e Natureza, ou realizar o cálculo reverso (descobrir a faixa de IVs possíveis inserindo o nível, natureza, EVs e status atuais).
- **RF11.2. Calculadora de Captura (Catch Rate Calculator):** Calcular a probabilidade percentual exata de captura por turno e a chance de _Critical Capture_ com base na fórmula oficial de cada geração, espécie do Pokémon, nível, HP atual (%), condição de status (Dormindo, Congelado, Paralisado, Queimado, Envenenado), tipo de Pokébola e modificadores de terreno/turno/ambiente.

---

## 4. Diretrizes de Execução

1. **Definição da Stack:** Monorepo multiplataforma (escolhido): pnpm + Turborepo, Expo para Mobile primeiro, Tauri/Web no futuro. Arquitetura limpa separando o motor de cálculo (`@thedex/engine`, puro e 100% testado), a camada de banco e a camada de UI.
2. **Motor Matemático & Regras Oficiais (`@thedex/engine`):** Fórmulas de Stats (Gen 1-2 vs Gen 3+, Shedinja HP=1), efetividade de tipos por geração, parser do Pokémon Showdown e fórmulas de Catch Rate com testes unitários cobrindo casos extremos.
3. **Plano de Implementação Incremental (Fases):**
   - **Fase 1:** Setup do repositório, banco SQLite local (schema completo multi-geração + traduções para o Multilíngue Dual), script de ingestão de dados offline e motor de busca FTS (<100ms).
   - **Fase 2:** Sistema de Temas (Light/Dark/AMOLED + Paleta Dinâmica por Tipo), Seletor Global de Versão de Jogo e RF01 + RF02 com gerenciador de cache de mídia.
   - **Fase 3:** Enciclopédias Secundárias (RF03–RF07).
   - **Fase 4:** Utilitários Avançados (RF08–RF11).
   - **Fase 5:** Backup/Restore (RNF06) e Feature Flags PRO/Freemium (RNF08).
