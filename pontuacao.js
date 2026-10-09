/* wow.games: PONTUAÇÃO global (separada do XP e das moedas).
   Cada jogo avisa o que aconteceu com WowGames.evento(...). Aqui ficam as regras que transformam o desempenho em pontos.
   O evento devolve { pontos, reduzido, total }, e o jogo mostra isso com  WowGames.Pontos.html(resultado).

   Para um jogo novo:  WowGames.Pontos.registrar('idDoJogo', { limite: 5, calcula: ev => número });
     calcula(ev): pontos de UMA partida/rodada (0 = não pontua). Use o desempenho (tempo, erros, acertos...), nunca valores que o jogador escolhe.
     limite: quantas pontuações cheias por dia esse jogo dá. Passou disso, o ritmo cai (25% e depois 10%), para ninguém
             ganhar pontos infinitos repetindo o mesmo jogo.
     semLimite(ev): (opcional) eventos únicos e raros que nunca são reduzidos (ex.: vencer o Rumo ao Milhão).
     mostrarZero(ev): (opcional) se a partida terminou mas rendeu 0 pontos, a tela mostra "PONTUAÇÃO: 0" em vez de nada. */
(function () {
  const Perfil = WowGames.Perfil;
  const REGRAS = {};
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);

  /* ---------- Regras de cada jogo ---------- */
  // O Botão: rápido e com poucas tentativas extras vale mais. De 100 a 1.500 por partida.
  REGRAS.botao = { limite: 5, calcula: ev => ev.tipo === 'fim' ? Math.max(100, Math.round(1500 - num(ev.tempo) * 10 - Math.max(0, num(ev.tentativas) - 25) * 5)) : 0 };

  // Pare no Tempo: quanto menor o erro, mais pontos. De 0 a 300 por rodada (erro de 1s ou mais não pontua). Rodadas são rápidas, então o limite diário é maior.
  REGRAS.tempo = { limite: 25, mostrarZero: ev => ev.tipo === 'rodada', calcula: ev => typeof ev.erro === 'number' ? Math.max(0, Math.round(250 * (1 - Math.min(ev.erro, 1)))) + (ev.erro < 0.05 ? 50 : 0) : 0 };

  // Máquina de Prêmios: por giro, pela raridade (mesma escala das moedas de repetido) + bônus por item novo. Evoluir a máquina também vale pontos.
  const POR_RARIDADE = [5, 15, 40, 100, 300, 1000];
  REGRAS.premios = { limite: 100, calcula: ev => ev.tipo === 'evolucao' ? Math.max(0, num(ev.nivel) - 1) * 100 : ev.tipo === 'giro' ? (POR_RARIDADE[ev.raridade] || 0) + (ev.novo ? 25 : 0) : 0,
    semLimite: ev => ev.tipo === 'evolucao' };

  // Jogos que já calculam uma pontuação própria (tempo, erros, acertos): essa pontuação é usada diretamente.
  REGRAS.matematica = { limite: 5, calcula: ev => ev.tipo === 'fim' ? num(ev.pontos) : 0 };
  REGRAS.cor = { limite: 5, calcula: ev => ev.tipo === 'fim' ? num(ev.pontos) : 0 };
  REGRAS.sequencia = { limite: 3, calcula: ev => ev.tipo === 'fim' ? num(ev.pontos) : 0 };      // as sequências são sempre as mesmas, por isso o limite é menor
  REGRAS.caso001 = { limite: 1, calcula: ev => ev.tipo === 'fim' ? num(ev.pontos) : 0 };         // o caso é sempre o mesmo, só a primeira solução do dia vale tudo

  // Rumo ao Milhão: pontua o DESEMPENHO (multiplicador alcançado, níveis da bomba), nunca o valor apostado. A roleta não pontua.
  REGRAS.milhao = { limite: 15, mostrarZero: ev => (ev.tipo === 'foguete' || ev.tipo === 'bomba') && !!ev.perdeu,
    calcula: ev => {
      if (ev.tipo === 'foguete') return ev.perdeu ? 0 : Math.min(600, 20 + Math.round(100 * Math.max(0, num(ev.mult) - 1)));
      if (ev.tipo === 'bomba') return ev.perdeu ? num(ev.niveis) * 10 : num(ev.niveis) * 40 + Math.round(50 * Math.max(0, num(ev.mult) - 1));
      if (ev.tipo === 'banco') return 100;
      if (ev.tipo === 'fim') return 20000;
      return 0;
    },
    semLimite: ev => ev.tipo === 'fim' };

  /* ---------- Aplicação (chamada por perfil.js a cada evento) ---------- */
  Perfil.pontuar = function (ev, P) {
    const r = REGRAS[ev.jogo];
    if (!r) return { pontos: 0 };
    const base = Math.max(0, Math.round(r.calcula(ev) || 0));
    if (!base) return r.mostrarZero && r.mostrarZero(ev) ? { pontos: 0, base: 0, zero: true, total: P.pontuacao || 0 } : { pontos: 0 };
    let fator = 1;
    if (!(r.semLimite && r.semLimite(ev)) && r.limite) {
      const hoje = Perfil.hoje();
      if (P.pontosDia.dia !== hoje) P.pontosDia = { dia: hoje, n: {} };
      const n = P.pontosDia.n[ev.jogo] || 0;                           // pontuações deste jogo hoje, antes desta
      P.pontosDia.n[ev.jogo] = n + 1;
      fator = n < r.limite ? 1 : n < r.limite * 3 ? 0.25 : 0.1;
    }
    const pontos = Math.round(base * fator);
    P.pontuacao = (P.pontuacao || 0) + pontos;
    return { pontos, base, reduzido: fator < 1, total: P.pontuacao };
  };

  /* ---------- Texto padrão "PONTUAÇÃO: XXX" para as telas de resultado ---------- */
  const fmt = n => (n || 0).toLocaleString('pt-BR');
  WowGames.Pontos = {
    registrar: (jogo, regra) => { REGRAS[jogo] = regra; },
    regras: REGRAS,
    fmt,
    html(r) {
      if (!r || typeof r.pontos !== 'number' || !(r.base > 0 || r.zero)) return '';
      return `<div class="pt-score">🏆 PONTUAÇÃO: <b>${fmt(r.pontos)}</b>` +
        `<small>Total no perfil: ${fmt(r.total)} pontos${r.reduzido ? ' | ritmo reduzido: você já jogou bastante isto hoje' : ''}</small></div>`;
    }
  };
})();
