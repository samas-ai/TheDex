# TheDex — pacote `cries-aac`

Gerado por `pnpm media:pack` (`tools/media-pack` do TheDex). Não edite à mão.

Os gritos do [PokeAPI/cries](https://github.com/PokeAPI/cries) são `.ogg` (Vorbis, alguns MP3),
que o iOS não decodifica. Este pacote traz os mesmos arquivos em AAC-LC 64 kbit/s (`.m4a`), com
o mesmo nome (`<id do Pokémon>.m4a`) e a mesma estrutura de diretórios do repositório de origem.

| Diretório | Arquivos | Tamanho | Origem |
| --------- | -------- | ------- | ------ |
| `cries/pokemon/latest/` | 1351 | 14.8 MB | https://raw.githubusercontent.com/PokeAPI/cries/b3a9044bb839b5e3152aaa536c7b463a0fcf0140/cries/pokemon/latest |
| `cries/pokemon/legacy/` | 673 | 5.1 MB | https://raw.githubusercontent.com/PokeAPI/cries/b3a9044bb839b5e3152aaa536c7b463a0fcf0140/cries/pokemon/legacy |

- Encoder: ffmpeg version 9.0.2-full_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers
- Comando: `ffmpeg -nostdin -hide_banner -v error -y -i <entrada>.ogg -vn -map_metadata -1 -c:a aac -b:a 64k -fflags +bitexact -flags:a +bitexact -movflags +faststart -f ipod <saída>.m4a`
- `listing.json`: nome e tamanho de cada arquivo (o TheDex versiona uma cópia e confere com `pnpm media:verify`).

Os arquivos de origem são CC0, mas os sons são © Nintendo, Creatures Inc. e GAME FREAK inc.
(The Pokémon Company). Pokémon é marca registrada da Nintendo. Este pacote não é oficial nem
afiliado a essas empresas.
