[painel-admin.md](https://github.com/user-attachments/files/33848344/painel-admin.md)
# Ferramentas de teste (painel administrativo local)

**Como abrir:**
1. Vá em **Perfil → 🔧 Ferramentas de teste** (ou abra `#/admin`).
2. Digite o código de acesso.

O painel fica liberado enquanto a página estiver aberta. Ao recarregar ou clicar em "Fechar sem aplicar", ele volta a pedir o código.

## O que o painel faz

- **Valores atuais:** mostra XP, nível, moedas, pontuação, conquistas e partidas.
- **Moedas:** altera apenas o campo `moedas` do save da Máquina de Prêmios (`wowgames.premios.v1`), o mesmo saldo usado pela Loja.
- **XP ou nível:** você muda um dos dois. O nível é sempre calculado pelo XP. Ao escolher um nível, o XP vai para o começo dele, pela fórmula 50·n·(n−1).
- **Pontuação total do perfil.**
- **Conquistas:** você pode desbloquear ou bloquear qualquer uma. Desbloquear por aqui não dá XP. Bloquear permite testar o desbloqueio de novo.
- **Recordes:** você pode editar ou apagar os recordes de cada jogo. As partidas por jogo aparecem só para consulta.

**Como uma alteração é aplicada:**
1. **Revisar alterações** mostra a lista "antes → depois".
2. Nada é gravado até você clicar em **Confirmar e aplicar**.
3. A gravação é feita por inteiro ou não é feita: se der qualquer erro, os dados anteriores são restaurados.
4. Enquanto a página estiver aberta, **Desfazer última alteração** volta ao estado anterior.

**Validação:** o painel só aceita números inteiros e não negativos, com limites. Recordes aceitam decimais. Campos vazios ou com letras são recusados, com uma mensagem de erro.

## O que o painel NÃO faz

- **Placar global:** não acessa o placar, nem a chave `wowgames.placar.v1`, nem a rede.
- **Código:** não executa código, não apaga dados em massa e não altera arquivos do site.
- **Outros perfis:** não cria uma cópia do perfil e não afeta outros perfis nem outros navegadores.

## Segurança

O wow.games é um site estático, sem servidor, então este código **não é uma autenticação segura**. O código fica no `admin.js` apenas como um hash simples, para não aparecer escrito, mas qualquer pessoa que estude o JavaScript pode descobri-lo ou contorná-lo. Isso é aceitável aqui porque o painel só altera dados locais, que o próprio jogador já poderia mudar pelo navegador.

**Para trocar o código:**
1. Calcule o FNV-1a de 32 bits do novo texto. No console do site, rode `(s=>{let h=0x811c9dc5;for(const b of new TextEncoder().encode(s)){h^=b;h=Math.imul(h,0x01000193)>>>0}return '0x'+h.toString(16)})('novo-codigo')`.
2. Substitua o valor de `HASH` em `admin.js` pelo resultado.

**Para remover o painel do site:** apague a linha `<script src="admin.js"></script>` do `index.html`.
