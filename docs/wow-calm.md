[wow-calm.md](https://github.com/user-attachments/files/33939480/wow-calm.md)
# wow.calm

Um clicker relaxante. O jogador toca no **núcleo de luz** para juntar **serenidade** e compra confortos que mudam o quarto, liberam sons e produzem serenidade sozinhos.

## Arquivos

| Arquivo | O que tem |
|---|---|
| `games/calm-dados.js` | Itens, etapas, atmosferas, cores de parede e as regras da economia (sem DOM). É o único lugar para mexer no balanceamento. |
| `games/calm-som.js` | Sons sintetizados com Web Audio (ruído filtrado e osciladores). |
| `games/calm.js` | Tela, quarto, loja, painéis, salvamento e integração com perfil, conquistas e pontuação. |
| `style.css` | Seção `wow.calm (prefixo .calm-)`. |

## Regras importantes

- **Sem produção offline.** A produção automática só roda com o jogo aberto e a aba visível. Cada quadro conta no máximo 0,25 s, então travadas ou abas em segundo plano não geram serenidade acumulada.
- **Sem renascimento, prestígio ou recomeço.** Depois do final, o refúgio continua como está e ainda há itens opcionais para colecionar.
- **A serenidade não é moeda do site.** Ela não muda as moedas da Máquina de Prêmios e não compra nada na Loja.
- **Sem ranking novo.** O wow.calm não entra no placar global.

## Etapas

1. **Um cantinho vazio:** luminária, núcleo, caneca e almofada.
2. **Pequenos confortos:** chá, livros e cobertor.
3. **O mundo fica mais silencioso:** janela com chuva, chuva fraca, ruído ambiente e luzinhas.
4. **Seu próprio refúgio:** plantas, poltrona, cantinho de leitura, aquário, lareira e cantinho de culinária.
5. **Refúgio completo:** música ambiente, bebida especial, claraboia e a **Lanterna do Refúgio**, que dispara o final.

A próxima etapa abre quando todos os itens marcados com ★ da etapa atual forem comprados.

## Itens (custo inicial)

| Etapa | Item | Categoria | Custo | |
|---|---|---|---|---|
| 1 | 💡 Luminária de luz quente | Conforto | 10 | ★ |
| 1 | ✨ Núcleo de serenidade | Produção | 15 (×1,55 por nível, até 15) | ★ |
| 1 | ☕ Caneca quentinha | Conforto | 30 | ★ |
| 1 | 🌬️ Respiração calma | Produção | 25 (×1,16 por nível, até 30) |  |
| 1 | 🛋️ Almofada macia | Conforto | 60 | ★ |
| 2 | 🍵 Chá simples | Bebidas e pausas | 155 (×1,15 por nível, até 25) | ★ |
| 2 | 📚 Livros na mesa | Conforto | 310 | ★ |
| 2 | 📖 Páginas virando | Sons e atmosferas | 530 |  |
| 2 | 🧶 Cobertor confortável | Conforto | 630 | ★ |
| 2 | 🫖 Chá verde | Bebidas e pausas | 980 (×1,16 por nível, até 20) |  |
| 3 | 🪟 Janela com chuva | Experiências | 3.000 | ★ |
| 3 | 🌧️ Chuva fraca na janela | Sons e atmosferas | 4.400 | ★ |
| 3 | 🫗 Água na xícara | Sons e atmosferas | 3.600 |  |
| 3 | 🍫 Chocolate quente | Bebidas e pausas | 5.000 (×1,17 por nível, até 20) |  |
| 3 | 🌫️ Ruído ambiente suave | Sons e atmosferas | 6.400 | ★ |
| 3 | 🏮 Luzinhas quentes | Conforto | 8.400 | ★ |
| 3 | 📻 Estação de sons ambientes | Produção | 7.600 (×1,18 por nível, até 20) |  |
| 3 | 🎧 Toques suaves (ASMR) | Sons e atmosferas | 12 mil |  |
| 3 | ⛈️ Chuva mais intensa (opcional) | Sons e atmosferas | 14 mil | opcional |
| 4 | 🪴 Pequena coleção de plantas | Conforto | 24 mil | ★ |
| 4 | 🪑 Poltrona de leitura | Conforto | 31 mil | ★ |
| 4 | 📗 Cantinho de leitura | Experiências | 38,5 mil | ★ |
| 4 | 🟫 Tapete macio | Conforto | 43 mil |  |
| 4 | 🌿 Jardim contemplativo | Produção | 29 mil (×1,18 por nível, até 15) |  |
| 4 | 🐠 Mini aquário | Experiências | 53 mil | ★ |
| 4 | 🔥 Pequena lareira | Experiências | 62,5 mil | ★ |
| 4 | 🏺 Bule automático | Bebidas e pausas | 57,5 mil |  |
| 4 | 🍜 Cantinho de culinária | Experiências | 77 mil | ★ |
| 5 | 🎶 Música ambiente | Sons e atmosferas | 154 mil | ★ |
| 5 | 🧋 Bebida especial da casa | Bebidas e pausas | 196 mil | ★ |
| 5 | 🌦️ Chuva que alimenta a atmosfera | Produção | 224 mil |  |
| 5 | 🌌 Claraboia estrelada | Experiências | 308 mil | ★ |
| 5 | 🏮 Lanterna do Refúgio | Experiências | 448 mil | ★ |
| 5 | 🐈 Gatinho sonolento | Conforto | 336 mil | opcional |
| 5 | 🌙 Móbile de estrelas | Conforto | 504 mil | opcional |
| 5 | 🫖 Coleção de canecas | Bebidas e pausas | 700 mil | opcional |

Cada item tem, em `calm-dados.js`: `id`, `ordem`, `etapa`, `cat`, `icone`, `nome`, `desc`, `custo`, `cresc`, `max`, `efeito`, `essencial`, `requer`, `opcional`, `som` e `final`.

Efeitos possíveis: `clique` (+ por clique), `auto` (+ por segundo), `mult` (+% em tudo), `multClique`, `multAuto` e `multBebidas`.

## Simulação de três estilos de jogador

A simulação compra sempre o item com melhor custo-benefício e não usa os itens opcionais.

| Estilo | Cliques por segundo | Tempo para completar | Etapa 2 | Etapa 3 | Etapa 4 | Etapa 5 |
|---|---|---|---|---|---|---|
| Muitos cliques | 6 | ~18 min | 0:12 | 0:38 | 3:28 | 10:37 |
| **Equilibrado** | 3,5 (pausa em 15% do tempo) | **~27 min** | 0:20 | 1:16 | 6:04 | 17:10 |
| Casual | 1,6 (pausa em 35% do tempo) | ~37 min | 0:51 | 3:06 | 10:54 | 26:24 |
| Quase sem cliques | 0,3 (pausa em 80% do tempo) | ~51 min | 5:45 | 11:08 | 22:07 | 39:21 |

A maior espera entre duas compras fica em cerca de 2 a 4 minutos, no fim da jornada.

Para refazer a simulação, rode `node docs/calm-simulacao.js`. O script lê `games/calm-dados.js` diretamente.

## Salvamento: `wowgames.calm.v1`

```
{ v: 1, ser, total, cliques, niv: { idDoItem: nível }, intro, atm, parede, sons: {...}, vol: { mudo, ambiente, efeitos, musica },
  enviados: { marco: true }, tempo, fimTempo, refeicoes, mudouAtm, mudouParede, finalVisto }
```

- **Quando grava:** ao comprar, ao mudar uma opção, ao esconder a aba, ao sair da página e ao sair do jogo. Enquanto só produz, grava no máximo a cada 10 s.
- **Dados ilegíveis ou de outra versão:** são copiados para `wowgames.calm.v1.copia` (nada é apagado) e o jogo começa do zero.
- **Campos inválidos:** são corrigidos. Números negativos ou não numéricos voltam ao padrão, níveis acima do máximo são limitados e ids desconhecidos são ignorados.
- **Recuperação de conta:** a chave entra automaticamente no código de recuperação, como todas as chaves `wowgames.*`.

## Integração

- **XP:**
  - primeiro toque: 10;
  - cada etapa nova: 30;
  - final: 200.
- **Conquistas:** cada uma é desbloqueada uma única vez pelo sistema existente.
  - 🌬️ Primeiro Respiro
  - 🍵 Chá Quentinho
  - 🌧️ Chuva na Janela
  - 🎧 Sons de Conforto
  - 🌿 Cantinho Verde
  - 🍜 Hora do Lámen
  - 🏡 Refúgio em Construção
  - 🏮 Refúgio Completo
  - 🎨 Pequenos Detalhes
  - 📖 Colecionador de Calma
- **Recordes:** etapa alcançada e tempo para completar o refúgio.
- **Pontuação global:** 500 pontos só na conclusão. Cliques e compras não pontuam.
- **Envio único:** cada marco é enviado uma única vez por salvamento (campo `enviados`). Recarregar a página não repete XP nem conquistas.

## Sons

Todos são **sintetizados no navegador**. Não são gravações reais e não imitam gravações de ASMR.

- **Ambiente:** chuva fraca, chuva intensa, ruído de quarto e lenha estalando.
- **Texturas ocasionais:** páginas virando e toques suaves.
- **Efeitos:** toque no núcleo, compra, nova etapa, final, água na xícara, panela e "garfadas".
- **Música:** acordes lentos numa escala pentatônica.

Como o áudio é controlado:

- Nada toca e nenhum contexto de áudio é criado antes de um clique do jogador.
- Há um botão geral de som e volumes separados para ambiente, efeitos e música.
- Cada som liberado pode ser ligado ou desligado.
- O áudio pausa com a aba escondida e fecha ao sair do jogo.

## Animações

- **Quarto:** feito em CSS, com itens que aparecem conforme são comprados, luz que esquenta a cada etapa, chuva na janela, chamas, peixes, vapor, livro virando páginas, luzinhas piscando e céu estrelado.
- **Cantinho de culinária:** uma cena original em CSS. Uma personagem simples prepara uma tigela de lámen, serve e come.
- **Movimento reduzido:** com `prefers-reduced-motion`, as animações contínuas param.
