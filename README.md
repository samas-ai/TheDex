# TheDex — pacotes de mídia

Branch `media/cries-aac` do [TheDex](https://github.com/samas-ai/TheDex), sem histórico em comum
com a `main`. Gerada por `pnpm media:pack` (`tools/media-pack`). Não edite à mão.

O app baixa cada arquivo sob demanda por uma URL fixada num commit desta branch
(`https://raw.githubusercontent.com/samas-ai/TheDex/<sha>/cries-aac/...`). Por isso a branch
nunca é apagada nem reescrita: uma versão nova do pacote entra como commit novo por cima, e as
versões antigas do app continuam baixando os arquivos delas.

| Pacote       | Conteúdo                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| `cries-aac/` | Gritos do [PokeAPI/cries](https://github.com/PokeAPI/cries) em AAC (`.m4a`), para o iOS |

Os sons são © Nintendo, Creatures Inc. e GAME FREAK inc. (The Pokémon Company). Projeto não
oficial, sem afiliação com essas empresas. Detalhes de origem e codificação em cada pacote.
