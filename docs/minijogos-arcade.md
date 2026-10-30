[minijogos-arcade.md](https://github.com/user-attachments/files/34189996/minijogos-arcade.md)
# Minijogos arcade

Os quatro jogos compartilham uma base pequena, `games/arcade.js`. Ela monta a tela inicial, a pausa e o resultado, ajusta o canvas à tela, mantém um único ciclo de animação e registra o fim da partida pelo `WowGames.evento`.

| Jogo | ID | Arquivo | Prefixo CSS |
|---|---|---|---|
| Não Deixe Cair | `naocair` | `games/naocair.js` | `.arc-` |
| Repita a Sequência | `repita` | `games/repita.js` | `.rps-` |
| Passe pelo Buraco | `buraco` | `games/buraco.js` | `.arc-` |
| Torre Instável | `torre` | `games/torre.js` | `.arc-` |

## Recordes, XP e pontuação

- **Recordes:** ficam no perfil, como nos outros jogos (`wowgames.perfil.v1`, em `recordes`). Só são atualizados quando a nova marca é maior.

  | Jogo | Recordes |
  |---|---|
  | Não Deixe Cair | `naocair:pontos` e `naocair:tempo` |
  | Repita a Sequência | `repita:pontos` e `repita:sequencia` |
  | Passe pelo Buraco | `buraco:pontos` e `buraco:passagens` |
  | Torre Instável | `torre:pontos` e `torre:altura` |

- **Envio:** cada partida terminada envia um único evento `{ jogo, tipo: 'fim', partida: true, ... }`. Recarregar a página não envia nada.
- **Pontuação global:** pelo `WowGames.Pontos.registrar`, com limite diário de 5 partidas cheias por jogo, igual aos jogos antigos.
- **XP:** de 8 a 40 por partida.
- **Fora do sistema:**
  - Os jogos não dão moedas.
  - Não entram no placar global: isso exigiria mudar a tabela do Supabase.
  - Não adicionam desafios do dia.
- **Dado próprio:** só o Repita a Sequência guarda algo seu, a preferência de som em `wowgames.repita.v1`.

## Conquistas

| ID | Nome | Critério |
|---|---|---|
| `naocairsobrevivente` | Sobrevivente | 45 s no ar |
| `naocairreflexos` | Reflexos Rápidos | 1.200 pontos |
| `repitamemoria` | Boa Memória | sequência de 8 |
| `repitaextra` | Memória Extraordinária | sequência de 15 |
| `buracolivre` | Passagem Livre | 25 barreiras |
| `buracoperfeito` | Desvio Perfeito | 700 pontos |
| `torreengenheiro` | Engenheiro | 15 andares |
| `torremestre` | Mestre da Torre | 30 andares |

## Física e lógica para testes

A física e a lógica ficam em objetos sem DOM, que podem ser testados direto:

- `WowGames.NaoCairFisica`
- `WowGames.BuracoFisica`
- `WowGames.TorreLogica`

Os ajustes de dificuldade estão no topo de cada arquivo.
