# Placar global do wow.games (Supabase)

O placar global precisa de um banco de dados compartilhado. O site fica no GitHub Pages, que só hospeda arquivos estáticos, então os dados ficam num projeto gratuito do **Supabase**.

Enquanto `placar-config.js` estiver vazio, a página **🌍 Placar global** mostra "não configurado" e nada é enviado pela rede.

## Por que Supabase

- Funciona com HTML, CSS e JavaScript puros, por chamadas `fetch` à API REST. Não precisa de biblioteca nem de build.
- O banco é PostgreSQL, com regras de acesso (RLS) e funções no servidor. É nas funções que os envios são validados.
- A chave pública ("anon" ou "publishable") foi feita para ficar no navegador. A segurança está nas regras do banco, não em esconder a chave.
- O plano gratuito é suficiente para este site: 500 MB de banco e uso de API muito acima do que um placar de minijogos gasta. Projetos gratuitos que ficam uma semana sem acesso são pausados e podem ser reativados no painel. Confira os limites atuais em supabase.com/pricing.

O Firebase também serviria. Nele, porém, validar faixas de pontuação e limitar a frequência de envios exige Cloud Functions, que dependem do plano pago, ou regras bem mais complexas.

## O que você precisa fazer (cerca de 10 minutos)

1. Crie uma conta em https://supabase.com e um projeto novo. O nome é livre. Escolha a região **South America (São Paulo)** e guarde a senha do banco.
2. No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/placar.sql` e clique em **Run**. O script pode ser executado de novo sem apagar dados.
3. Abra **Project Settings → API** (ou **API Keys**) e copie dois itens:
   - **Project URL**, por exemplo `https://abcdefghijklmnop.supabase.co`;
   - a chave **anon public** (ou **publishable**, que começa com `sb_publishable_`).
4. Cole os dois em `placar-config.js`:
   ```js
   WowGames.PlacarConfig = {
     url: 'https://abcdefghijklmnop.supabase.co',
     chaveAnon: 'cole-aqui-a-chave-anon'
   };
   ```
5. Envie `placar-config.js` para o GitHub e abra o site. Em **🌍 Placar global**, marque "Participar", jogue uma partida de um jogo do placar e confira o resultado na aba dele.

**Nunca** use a chave `service_role` (ou `sb_secret_...`). Ela ignora todas as regras de segurança. Se ela for colada por engano, o site se recusa a usá-la e mostra um aviso no console. Nesse caso, gere uma chave nova no Supabase.

## O que foi criado no banco

- **`placar_jogos`:** guarda as regras de cada jogo, como o que é melhor (menor ou maior), os limites, as casas decimais e, no Show de Perguntas, a lista dos valores da escada.
- **`placar_resultados`:** guarda os envios (jogo, hash do aparelho, nome público, valor e data). Os visitantes não leem nem escrevem nesta tabela diretamente.
- **`placar_enviar(jogo, valor, nome, jogador)`:** é a única forma de enviar. Ela valida o jogo, o formato, os limites, os valores aceitos e o nome. Também limita os envios a 1 a cada 5 segundos e 300 por dia por aparelho.
- **`placar_ranking(jogo, limite)`:** mostra o melhor resultado de cada jogador, com no máximo 100 linhas. Empates ficam na mesma posição, e quem fez o resultado primeiro aparece antes.

## Jogos no placar

| Jogo | Critério | Limites aceitos |
|---|---|---|
| O Botão | menor tempo | 4 s a 3.600 s |
| Pare no Tempo | menor erro (uma rodada) | 0 a 30 s |
| Matemática Relâmpago | maior pontuação | 1 a 3.000 |
| Complete a Sequência | maior pontuação | 1 a 2.000 |
| Não Toque no Vermelho | maior pontuação | 1 a 2.250 |
| Adivinhe o Peso | maior pontuação | 1 a 1.925 |
| Show de Perguntas | maior prêmio da escada | só os 15 valores da escada |

**Ficaram de fora:**
- **Máquina de Prêmios:** o resultado depende de sorte.
- **Rumo ao Milhão:** é um jogo de economia, com apostas e um save contínuo.
- **Caso #001:** o caso é sempre o mesmo e se resolve uma vez só.
- **Super Jogo da Velha:** a partida é contra a máquina ou contra outra pessoa no mesmo aparelho.
- **Laboratório de Elementos:** é um sandbox, sem pontuação.

## Privacidade

A participação é opcional e começa desligada. O site envia só quatro coisas: o jogo, o resultado, o nome público escolhido pelo jogador (de 2 a 16 caracteres) e um código anônimo gerado no aparelho. O servidor não guarda esse código, só o hash SHA-256 dele.

## Limitações

- **Validação:** os jogos rodam no navegador, então quem souber programar pode enviar um resultado falso que esteja dentro dos limites. O servidor recusa valores impossíveis, formatos inválidos e excesso de envios, mas não consegue provar que a partida aconteceu de verdade. Para remover resultados suspeitos, use **Table Editor → placar_resultados** no Supabase.
- **Painel de testes:** o painel administrativo do site (`admin.js`) não tem nenhum acesso ao placar.
- **Sem conexão:** se a internet cair, o melhor resultado fica guardado no aparelho (`wowgames.placar.v1`) e é reenviado depois. Esse dado local não é um ranking.
