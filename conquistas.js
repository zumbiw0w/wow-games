/* wow.games: conteúdo dos sistemas globais para os jogos atuais (XP, recordes, conquistas e desafios do dia).
   Para um jogo novo: chame WowGames.Perfil.registrarJogo/Conquista/Desafio aqui ou no próprio arquivo do jogo. */
(function () {
  const P = WowGames.Perfil;
  const seg = v => v.toFixed(2).replace('.', ',') + 's';
  const tempo = v => v >= 60 ? Math.floor(v / 60) + 'min ' + Math.floor(v % 60) + 's' : seg(v);
  const num = v => Math.round(v).toLocaleString('pt-BR');
  const fim = (ev, j) => ev.jogo === j && ev.tipo === 'fim';

  /* ----- XP por jogo e recordes pessoais ----- */
  P.registrarJogo({ id: 'botao', nome: 'O Botão', icone: '🔴', xp: ev => ev.tipo === 'fim' ? 40 + (ev.tempo < 30 ? 20 : 0) : 0,
    recordes: [{ id: 'tempo', rotulo: 'O Botão: menor tempo', melhor: 'menor', valor: ev => ev.tipo === 'fim' ? ev.tempo : null, fmt: tempo }] });
  P.registrarJogo({ id: 'tempo', nome: 'Pare no Tempo', icone: '⏱️', xp: ev => 10 + (ev.erro < 0.1 ? 15 : ev.erro < 0.5 ? 5 : 0),
    recordes: [{ id: 'erro', rotulo: 'Pare no Tempo: menor erro', melhor: 'menor', valor: ev => ev.erro, fmt: seg }] });
  P.registrarJogo({ id: 'premios', nome: 'Máquina de Prêmios', icone: '🎁', xp: ev => 5 + ev.raridade * 5 + (ev.novo ? 10 : 0),
    recordes: [{ id: 'descobertos', rotulo: 'Prêmios descobertos', melhor: 'maior', valor: ev => ev.descobertos, fmt: v => v + '/20' }] });
  P.registrarJogo({ id: 'matematica', nome: 'Matemática Relâmpago', icone: '🧮', xp: ev => 50 + Math.min(50, Math.floor(ev.pontos / 60)),
    recordes: [{ id: 'tempo', rotulo: 'Matemática: menor tempo', melhor: 'menor', valor: ev => ev.tempo, fmt: tempo },
               { id: 'pontos', rotulo: 'Matemática: maior pontuação', melhor: 'maior', valor: ev => ev.pontos, fmt: num }] });
  P.registrarJogo({ id: 'cor', nome: 'Não Toque no Vermelho', icone: '🎨', xp: ev => 40 + Math.floor(ev.pontos / 60),
    recordes: [{ id: 'pontos', rotulo: 'Cores: maior pontuação', melhor: 'maior', valor: ev => ev.pontos, fmt: num }] });
  P.registrarJogo({ id: 'sequencia', nome: 'Complete a Sequência', icone: '🔢', xp: ev => 50 + Math.min(50, Math.floor(ev.pontos / 40)),
    recordes: [{ id: 'tempo', rotulo: 'Sequência: menor tempo', melhor: 'menor', valor: ev => ev.tempo, fmt: tempo }] });
  P.registrarJogo({ id: 'caso001', nome: 'O Caso #001', icone: '🔎', xp: ev => 150 + Math.max(0, 50 - ev.erros * 10),
    recordes: [{ id: 'pontos', rotulo: 'Caso #001: maior pontuação', melhor: 'maior', valor: ev => ev.pontos, fmt: num }] });
  P.registrarJogo({ id: 'milhao', nome: 'Rumo ao Milhão', icone: '💰',
    xp: ev => ev.tipo === 'foguete' ? 8 + (ev.mult >= 2 ? 10 : 0) : ev.tipo === 'bomba' ? 8 + 2 * (ev.niveis || 0) : ev.tipo === 'banco' ? 15 : ev.tipo === 'fim' ? 500 : 0,
    recordes: [{ id: 'patrimonio', rotulo: 'Rumo ao Milhão: maior patrimônio', melhor: 'maior', valor: ev => ev.tipo === 'progresso' ? ev.maxPat : null, fmt: v => 'R$' + num(v) }] });

  /* ----- Conquistas ----- */
  const perfeito = ev => ev.tipo === 'fim' && ev.erros === 0 && ['matematica', 'cor', 'sequencia', 'caso001'].includes(ev.jogo);
  [
    { id: 'relampago', icone: '⚡', nome: 'Relâmpago', desc: 'Termine O Botão em menos de 25s ou o Complete a Sequência em menos de 60s.',
      ok: ev => (fim(ev, 'botao') && ev.tempo < 25) || (fim(ev, 'sequencia') && ev.tempo < 60) },
    { id: 'genio', icone: '🧠', nome: 'Gênio', desc: 'Termine a Matemática Relâmpago com 2.200 pontos ou mais.', ok: ev => fim(ev, 'matematica') && ev.pontos >= 2200 },
    { id: 'relogio', icone: '⏱️', nome: 'Relógio Humano', desc: 'Pare no Tempo com erro de no máximo 0,05s.', ok: ev => ev.jogo === 'tempo' && ev.erro <= 0.05 },
    { id: 'detetive', icone: '🔎', nome: 'Detetive', desc: 'Resolva o Caso #001.', ok: ev => fim(ev, 'caso001') },
    { id: 'milionario', icone: '💰', nome: 'Milionário', desc: 'Alcance R$1.000.000 no Rumo ao Milhão.', ok: ev => fim(ev, 'milhao') },
    { id: 'perfeccionista', icone: '🎯', nome: 'Perfeccionista', desc: 'Complete Matemática, Cores, Sequência ou o Caso sem nenhum erro.', ok: perfeito },
    { id: 'reflexos', icone: '🌈', nome: 'Reflexos de Campeão', desc: 'Faça 1.800 pontos ou mais no Não Toque no Vermelho.', ok: ev => fim(ev, 'cor') && ev.pontos >= 1800 },
    { id: 'sortudo', icone: '🍀', nome: 'Sortudo', desc: 'Tire um prêmio lendário na Máquina de Prêmios.', ok: ev => ev.jogo === 'premios' && ev.raridade === 4 },
    { id: 'paciente', icone: '🏦', nome: 'Paciência Recompensada', desc: 'Resgate um investimento do Banco no Rumo ao Milhão.', ok: ev => ev.jogo === 'milhao' && ev.tipo === 'banco' },
    { id: 'colecionador', icone: '📚', nome: 'Colecionador', desc: 'Descubra 10 prêmios diferentes na Máquina de Prêmios.', alvo: 10, prog: p => (p.recordes['premios:descobertos'] || {}).valor || 0 },
    { id: 'primeiros', icone: '🎲', nome: 'Primeiros Passos', desc: 'Jogue 10 partidas.', alvo: 10, prog: p => p.partidas },
    { id: 'veterano', icone: '🎮', nome: 'Veterano', desc: 'Jogue 50 partidas.', alvo: 50, prog: p => p.partidas },
    { id: 'explorador', icone: '🧭', nome: 'Explorador', desc: 'Experimente todos os jogos do site.', alvo: () => P.jogos.length, prog: p => Object.keys(p.jogos).length },
    { id: 'dedicado', icone: '🔥', nome: 'Dedicado', desc: 'Conclua 3 desafios do dia.', alvo: 3, prog: p => p.desafiosConcluidos }
  ].forEach(c => P.registrarConquista(c));

  /* ----- Desafios do dia (um por dia, em rotação) ----- */
  [
    { id: 'd-tempo', jogo: 'tempo', texto: 'Consiga menos de 0,20s de erro no Pare no Tempo.', ok: ev => ev.erro < 0.20 },
    { id: 'd-botao', jogo: 'botao', texto: 'Complete O Botão em menos de 45 segundos.', ok: ev => ev.tipo === 'fim' && ev.tempo < 45 },
    { id: 'd-matematica', jogo: 'matematica', texto: 'Termine a Matemática Relâmpago com no máximo 3 erros.', ok: ev => ev.tipo === 'fim' && ev.erros <= 3 },
    { id: 'd-cor', jogo: 'cor', texto: 'Faça 1.200 pontos ou mais no Não Toque no Vermelho.', ok: ev => ev.tipo === 'fim' && ev.pontos >= 1200 },
    { id: 'd-sequencia', jogo: 'sequencia', texto: 'Complete as 10 sequências em menos de 2 minutos.', ok: ev => ev.tipo === 'fim' && ev.tempo < 120 },
    { id: 'd-premios', jogo: 'premios', texto: 'Gire a Máquina de Prêmios 10 vezes.', alvo: 10, conta: ev => ev.tipo === 'giro' ? 1 : 0 },
    { id: 'd-caso', jogo: 'caso001', texto: 'Resolva o Caso #001.', ok: ev => ev.tipo === 'fim' },
    { id: 'd-milhao', jogo: 'milhao', texto: 'Colete o Foguete em 2,00x ou mais no Rumo ao Milhão.', ok: ev => ev.tipo === 'foguete' && ev.mult >= 2 }
  ].forEach(d => P.registrarDesafio(d));
})();
