/* Jogo 10: Super Jogo da Velha (9 tabuleiros de jogo da velha dentro de um tabuleiro 3x3).
   Regras:
   - A casa (0 a 8) onde você joga dentro de um tabuleiro menor decide em qual tabuleiro menor o adversário joga em seguida.
   - Tabuleiro menor conquistado ou empatado não aceita mais jogadas. Se o destino estiver fechado, o adversário joga em qualquer tabuleiro aberto.
   - Vence quem conquistar 3 tabuleiros menores em linha. Se acabarem as jogadas sem linha, empate.
   O arquivo tem 3 partes: MOTOR (regras, sem tela), MÁQUINA (3 dificuldades) e INTERFACE.
   O motor fica em WowGames.SuperVelha para poder ser testado sem a tela. */
(function () {
  /* ===================== MOTOR ===================== */
  // Estado: c[b*9+k] = casa k do tabuleiro menor b (0 vazia, 1 = X, 2 = O).  t[b] = estado do tabuleiro menor (0 aberto, 1/2 = conquistado por X/O, 3 = empatado).
  // vez = quem joga (1 ou 2).  alvo = tabuleiro obrigatório (0 a 8) ou -1 para "qualquer tabuleiro aberto".  fim = null, 1, 2 (vencedor) ou 3 (empate).
  const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const novo = () => ({ c: new Array(81).fill(0), t: new Array(9).fill(0), vez: 1, alvo: -1, fim: null, n: 0 });

  function venceu(c, b, p) {
    const o = b * 9;
    for (const l of LINHAS) if (c[o + l[0]] === p && c[o + l[1]] === p && c[o + l[2]] === p) return true;
    return false;
  }
  const cheio = (c, b) => { const o = b * 9; for (let k = 0; k < 9; k++) if (!c[o + k]) return false; return true; };
  function venceuPrincipal(t, p) {
    for (const l of LINHAS) if (t[l[0]] === p && t[l[1]] === p && t[l[2]] === p) return true;
    return false;
  }

  // Todas as jogadas permitidas agora (índices 0 a 80). Nunca inclui casa ocupada, tabuleiro fechado ou tabuleiro diferente do obrigatório.
  function legais(s) {
    const r = [];
    if (s.fim) return r;
    for (let b = 0; b < 9; b++) {
      if (s.t[b] !== 0) continue;
      if (s.alvo >= 0 && b !== s.alvo) continue;
      for (let k = 0; k < 9; k++) if (!s.c[b * 9 + k]) r.push(b * 9 + k);
    }
    return r;
  }
  const ehLegal = (s, m) => Number.isInteger(m) && m >= 0 && m < 81 && legais(s).includes(m);

  // Aplica a jogada m (sem checar; use ehLegal antes) e devolve o que é preciso para desfazer.
  function aplicar(s, m) {
    const b = (m / 9) | 0, k = m % 9, p = s.vez;
    const u = { p, alvo: s.alvo, tb: s.t[b], fim: s.fim };
    s.c[m] = p;
    if (venceu(s.c, b, p)) s.t[b] = p; else if (cheio(s.c, b)) s.t[b] = 3;
    if (s.t[b] === p && venceuPrincipal(s.t, p)) s.fim = p;                    // a vitória vale pelo tabuleiro PRINCIPAL
    else if (s.t.every(x => x !== 0)) s.fim = 3;                              // nenhum tabuleiro aberto e ninguém alinhou: empate
    s.alvo = s.t[k] === 0 ? k : -1;                                            // a casa escolhida (k) manda o adversário para o tabuleiro k; fechado = livre
    s.vez = 3 - p; s.n++;
    return u;
  }
  function desfazer(s, m, u) {
    const b = (m / 9) | 0;
    s.c[m] = 0; s.t[b] = u.tb; s.alvo = u.alvo; s.fim = u.fim; s.vez = u.p; s.n--;
  }

  /* ===================== MÁQUINA ===================== */
  const IMP = [3, 2, 3, 2, 4, 2, 3, 2, 3];                                    // importância da posição (cantos 3, bordas 2, centro 4)

  // Avaliação estática do ponto de vista do jogador "eu": tabuleiro principal (conquistas e linhas) + situação dentro dos tabuleiros abertos.
  function avaliar(s, eu) {
    const op = 3 - eu; let v = 0;
    for (const l of LINHAS) {                                                  // linhas do tabuleiro principal
      let a = 0, b = 0, d = 0;
      for (const i of l) { const x = s.t[i]; if (x === eu) a++; else if (x === op) b++; else if (x === 3) d++; }
      if (d) continue;
      if (a && !b) v += a === 1 ? 30 : 220; else if (b && !a) v -= b === 1 ? 30 : 220;
    }
    for (let i = 0; i < 9; i++) {
      const x = s.t[i];
      if (x === eu) { v += 70 + 20 * IMP[i]; continue; }
      if (x === op) { v -= 70 + 20 * IMP[i]; continue; }
      if (x === 3) continue;
      const o = i * 9;                                                          // tabuleiro aberto: linhas com chance real
      for (const l of LINHAS) {
        let a = 0, b = 0;
        for (const k of l) { const y = s.c[o + k]; if (y === eu) a++; else if (y === op) b++; }
        if (a && !b) v += (a === 1 ? 1 : 7) * IMP[i]; else if (b && !a) v -= (b === 1 ? 1 : 7) * IMP[i];
      }
    }
    if (s.alvo === -1) v += s.vez === eu ? 10 : -10;                           // escolher o tabuleiro livremente é uma vantagem
    return v;
  }

  // Ordem de busca: jogadas que conquistam tabuleiro primeiro, depois as que bloqueiam, depois as mais centrais. Melhora muito a poda.
  function ordenar(s, ms) {
    const p = s.vez, o = 3 - p, pts = new Map();
    for (const m of ms) {
      const b = (m / 9) | 0, k = m % 9; let q = IMP[k] + Math.random() * 0.5;
      s.c[m] = p; if (venceu(s.c, b, p)) q += 50; s.c[m] = o; if (venceu(s.c, b, o)) q += 25; s.c[m] = 0;
      if (s.t[k] !== 0) q -= 2;                                               // mandar o adversário jogar livre costuma ser ruim
      pts.set(m, q);
    }
    return ms.sort((x, y) => pts.get(y) - pts.get(x));
  }

  function negamax(s, prof, a, b, ctx) {
    if (s.fim) return s.fim === 3 ? 0 : -(1000000 + prof);                     // quem joga agora é o perdedor (o outro acabou de vencer)
    if (prof === 0) return avaliar(s, s.vez);
    if ((++ctx.nos & 1023) === 0 && performance.now() > ctx.limite) ctx.parou = true;
    if (ctx.parou) return 0;
    let melhor = -Infinity;
    for (const m of ordenar(s, legais(s))) {
      const u = aplicar(s, m);
      const v = -negamax(s, prof - 1, -b, -a, ctx);
      desfazer(s, m, u);
      if (ctx.parou) return 0;
      if (v > melhor) melhor = v;
      if (melhor > a) a = melhor;
      if (a >= b) break;
    }
    return melhor;
  }

  // Notas de todas as jogadas legais numa profundidade fixa (usado no Médio).
  function notas(s, prof) {
    return legais(s).map(m => { const u = aplicar(s, m); const v = -negamax(s, prof - 1, -Infinity, Infinity, { nos: 0, limite: Infinity, parou: false }); desfazer(s, m, u); return { m, v }; })
      .sort((x, y) => y.v - x.v);
  }

  const sorteia = v => v[Math.floor(Math.random() * v.length)];
  const ganhaTabuleiro = (s, m, p) => { const b = (m / 9) | 0; s.c[m] = p; const r = venceu(s.c, b, p); s.c[m] = 0; return r; };

  // FÁCIL: joga legal, mas quase sempre ao acaso. Às vezes percebe uma conquista fácil e às vezes um bloqueio, e erra o resto.
  function jogadaFacil(s) {
    const ms = legais(s), p = s.vez;
    if (Math.random() < 0.35) { const g = ms.filter(m => ganhaTabuleiro(s, m, p)); if (g.length) return sorteia(g); }
    if (Math.random() < 0.15) { const g = ms.filter(m => ganhaTabuleiro(s, m, 3 - p)); if (g.length) return sorteia(g); }
    return sorteia(ms);
  }
  // MÉDIO: enxerga 2 jogadas (a sua e a resposta do adversário, incluindo para onde ele será mandado). Erra de vez em quando de propósito.
  function jogadaMedia(s) {
    const n = notas(s, 2);
    if (n.length > 1 && Math.random() < 0.2) return sorteia(n.slice(0, Math.min(3, n.length))).m;
    return n[0].m;
  }
  // DIFÍCIL: busca com poda alfa-beta e aprofundamento iterativo dentro de um limite de tempo (a decisão melhora com a profundidade, não com tempo "parado").
  function jogadaDificil(s, tempoMs, profMax) {
    const ms = legais(s);
    if (ms.length === 1) return ms[0];
    let raiz = ordenar(s, ms.slice()), melhor = raiz[0];
    const limite = performance.now() + tempoMs;
    for (let prof = 1; prof <= profMax; prof++) {
      const ctx = { nos: 0, limite, parou: false };
      let bm = null, bv = -Infinity;
      for (const m of raiz) {
        const u = aplicar(s, m);
        const v = -negamax(s, prof - 1, -Infinity, -Math.max(bv, -Infinity), ctx);
        desfazer(s, m, u);
        if (ctx.parou) break;
        if (v > bv) { bv = v; bm = m; }
      }
      if (ctx.parou || bm === null) break;                                      // a rodada incompleta é descartada: vale a profundidade anterior
      melhor = bm;
      raiz = [bm, ...raiz.filter(x => x !== bm)];
      if (bv > 900000) break;                                                   // vitória forçada encontrada
    }
    return melhor;
  }

  // Escolhe a jogada da máquina. Sempre devolve uma jogada legal (há uma checagem final de segurança).
  function escolher(s, dif, opcoes) {
    const ms = legais(s); if (!ms.length) return -1;
    const o = Object.assign({ tempoMs: 450, profMax: 9 }, opcoes);
    let m;
    try { m = dif === 'facil' ? jogadaFacil(s) : dif === 'medio' ? jogadaMedia(s) : jogadaDificil(s, o.tempoMs, o.profMax); }
    catch (e) { console.error('[wow.games] Erro na IA do Super Jogo da Velha:', e); m = -1; }
    return ms.includes(m) ? m : sorteia(ms);
  }

  WowGames.SuperVelha = { LINHAS, novo, legais, ehLegal, aplicar, desfazer, avaliar, escolher };

  /* ===================== INTERFACE ===================== */
  const NOMES_POS = ['superior esquerdo', 'superior central', 'superior direito', 'central esquerdo', 'central', 'central direito', 'inferior esquerdo', 'inferior central', 'inferior direito'];
  const SIM = { 1: 'X', 2: 'O' };
  const DIFS = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

  WowGames.register({
    id: 'supervelha', nome: 'Super Jogo da Velha', icone: '🔳', cor: 'var(--sky)',
    desc: 'Nove jogos da velha dentro de um só. Onde você joga decide onde o adversário joga. Enfrente a máquina ou um amigo.',

    mount(el) {
      let cfg = { modo: 'maquina', humano: 1, dif: 'medio' };                // humano: 1 = X, 2 = O
      let s = null, ult = -1, aviso = '', pensando = false, resultado = null, timer = 0;

      const posNome = b => NOMES_POS[b];
      const contar = p => s.t.filter(x => x === p).length;
      const maq = () => cfg.modo === 'maquina';
      const ehVezMaquina = () => maq() && !s.fim && s.vez !== cfg.humano;

      function menu() {
        clearTimeout(timer); pensando = false; s = null; resultado = null;
        const b = (a, v, txt, on) => `<button type="button" class="sv-op ${on ? 'on' : ''}" data-a="${a}" data-v="${v}" aria-pressed="${on}">${txt}</button>`;
        el.innerHTML = `
          <div class="big-emoji">🔳</div>
          <h2>Super Jogo da Velha</h2>
          <p>Cada casa grande esconde um jogo da velha. <b>A casa em que você joga manda o adversário para o tabuleiro de mesma posição.</b> Conquiste 3 tabuleiros em linha para vencer.</p>
          <div class="sv-menu">
            <h3>Modo</h3><div class="sv-ops">${b('modo', 'maquina', '🤖 Contra a máquina', cfg.modo === 'maquina')}${b('modo', 'local', '👥 2 jogadores (no mesmo aparelho)', cfg.modo === 'local')}</div>
            ${maq() ? `<h3>Você joga com</h3><div class="sv-ops">${b('lado', 1, '❌ X (começa)', cfg.humano === 1)}${b('lado', 2, '⭕ O (a máquina começa)', cfg.humano === 2)}</div>
            <h3>Dificuldade</h3><div class="sv-ops">${Object.entries(DIFS).map(([k, n]) => b('dif', k, n, cfg.dif === k)).join('')}</div>` : '<p class="sv-nota">No modo de 2 jogadores, X começa e vocês alternam os turnos. Partidas locais não dão pontuação.</p>'}
          </div>
          <button class="btn big" data-a="comecar">Começar</button>
          <details class="sv-regras"><summary>Como jogar</summary>
            <ol><li>Escolha uma casa pequena livre no tabuleiro em que você deve jogar.</li>
            <li>A posição dessa casa (por exemplo, canto superior direito) define o tabuleiro onde o adversário joga (o superior direito).</li>
            <li>Três símbolos seus em linha num tabuleiro menor conquistam esse tabuleiro. Ele fecha e não aceita mais jogadas. Tabuleiro cheio sem vencedor fica empatado.</li>
            <li>Se você for mandado para um tabuleiro já conquistado ou empatado, joga em qualquer tabuleiro aberto.</li>
            <li>Vence quem conquistar 3 tabuleiros em linha no tabuleiro principal.</li></ol></details>`;
      }

      function comecar() {
        clearTimeout(timer); s = novo(); ult = -1; aviso = ''; resultado = null; pensando = false;
        desenhar();
        if (ehVezMaquina()) agendar();
      }

      function textoStatus() {
        if (resultado) return '';
        if (pensando) return '🤖 A máquina está pensando...';
        const quem = maq() ? (s.vez === cfg.humano ? 'Sua vez' : 'Vez da máquina') : `Vez do jogador ${SIM[s.vez]}`;
        const alvo = s.alvo >= 0 ? `Jogue no tabuleiro <b>${posNome(s.alvo)}</b> (destacado).`
          : (s.n === 0 ? 'Primeira jogada: escolha <b>qualquer casa</b> de qualquer tabuleiro.' : 'Você pode jogar em <b>qualquer tabuleiro aberto</b> (destacados em verde).');
        return `<b class="sv-vez s${s.vez}">${SIM[s.vez]}</b> ${quem}. ${alvo}${aviso ? `<span class="sv-aviso">${aviso}</span>` : ''}`;
      }

      function painelFim() {
        const r = resultado;
        return `<div class="sv-fim ${r.classe}" role="status"><h3>${r.titulo}</h3><p>${r.texto}</p>${r.pontos || ''}
          <div class="sv-btns"><button class="btn big" data-a="comecar">Jogar novamente</button><button class="btn" data-a="menu">Mudar modo</button></div></div>`;
      }

      function desenhar() {
        const legaisAgora = new Set(pensando || resultado || ehVezMaquina() ? [] : legais(s));
        const livre = !resultado && s.alvo === -1 && !ehVezMaquina() && !pensando;
        let tab = '';
        for (let b = 0; b < 9; b++) {
          const t = s.t[b], aberto = t === 0 && !s.fim;
          const cls = ['sv-b', t === 1 ? 'x' : t === 2 ? 'o' : t === 3 ? 'e' : '', aberto && s.alvo === b ? 'alvo' : '', aberto && livre ? 'livre' : ''].join(' ');
          let casas = '';
          for (let k = 0; k < 9; k++) {
            const m = b * 9 + k, v = s.c[m], ok = legaisAgora.has(m);
            casas += `<button type="button" class="sv-c ${v ? 'v' + v : ''} ${ok ? 'ok' : ''} ${m === ult ? 'ult' : ''}" data-m="${m}" ${ok ? '' : 'disabled'} aria-label="Tabuleiro ${posNome(b)}, casa ${posNome(k)}: ${v ? SIM[v] : ok ? 'livre, jogue aqui' : 'indisponível'}">${v ? SIM[v] : ''}</button>`;
          }
          tab += `<div class="${cls}" data-b="${b}" role="group" aria-label="Tabuleiro ${posNome(b)}${t === 1 || t === 2 ? ', conquistado por ' + SIM[t] : t === 3 ? ', empatado' : ''}">${casas}${t ? `<span class="sv-big">${t === 3 ? '=' : SIM[t]}</span>` : ''}</div>`;
        }
        const modoTxt = maq() ? `🤖 Máquina (${DIFS[cfg.dif]}) | você: <b>${SIM[cfg.humano]}</b>` : '👥 2 jogadores';
        el.innerHTML = `
          <div class="sv-info"><span>${modoTxt}</span><span class="sv-placar"><b class="s1">X</b> ${contar(1)} tabuleiros | <b class="s2">O</b> ${contar(2)} tabuleiros</span></div>
          ${resultado ? painelFim() : `<p class="sv-status" role="status" aria-live="polite">${textoStatus()}</p>`}
          <div class="sv-tab ${resultado ? 'fim' : ''}">${tab}</div>
          ${resultado ? '' : '<div class="sv-btns"><button class="btn small" data-a="reiniciar">Reiniciar partida</button><button class="btn small" data-a="menu">Mudar modo</button></div>'}`;
      }

      function agendar() {
        pensando = true; desenhar();
        const ritmo = cfg.dif === 'dificil' ? 80 : 350 + Math.random() * 250;
        timer = setTimeout(() => {
          if (!s || s.fim) return;
          const m = escolher(s, cfg.dif);
          pensando = false;
          jogar(m);
        }, ritmo);
      }

      function jogar(m) {
        if (!s || !ehLegal(s, m)) return;                                       // jogada que viola as regras é ignorada
        const antes = s.alvo;
        aplicar(s, m); ult = m;
        const k = m % 9;
        aviso = antes >= 0 && s.alvo === -1 && !s.fim ? `O tabuleiro ${posNome(k)} já está fechado, então o próximo jogador escolhe qualquer tabuleiro aberto.` : '';
        if (s.fim) return terminar();
        desenhar();
        if (ehVezMaquina()) agendar();
      }

      function terminar() {
        const venc = s.fim;
        let res, classe, titulo, texto, pontos = '';
        if (maq()) {
          res = venc === 3 ? 'empate' : venc === cfg.humano ? 'vitoria' : 'derrota';
          titulo = res === 'vitoria' ? '🏆 Você venceu!' : res === 'derrota' ? '🤖 A máquina venceu' : '🤝 Empate';
          texto = res === 'vitoria' ? `Você conquistou o tabuleiro principal contra a máquina no nível ${DIFS[cfg.dif]}.` : res === 'derrota' ? 'Não foi dessa vez. Tente de novo ou mude a dificuldade.' : 'Ninguém alinhou três tabuleiros.';
          classe = res;
        } else {
          res = venc === 3 ? 'empate' : 'local';
          titulo = venc === 3 ? '🤝 Empate' : `🏆 Jogador ${SIM[venc]} venceu!`;
          texto = venc === 3 ? 'Ninguém alinhou três tabuleiros.' : `${SIM[venc]} conquistou três tabuleiros em linha.`;
          classe = venc === 3 ? 'empate' : 'vitoria';
        }
        const meus = maq() ? contar(cfg.humano) : 0;
        const rp = WowGames.evento({ jogo: 'supervelha', tipo: 'fim', partida: true, modo: cfg.modo, dificuldade: maq() ? cfg.dif : null, resultado: res, jogadas: s.n, tabuleiros: meus });
        pontos = maq()
          ? (WowGames.Pontos ? WowGames.Pontos.html(rp) : '')
          : '<p class="sv-nota">🏆 Partidas entre duas pessoas no mesmo aparelho não dão pontuação (para não ser possível repetir sem limite). Jogue contra a máquina para pontuar.</p>';
        resultado = { classe, titulo, texto, pontos };
        desenhar();
        if (res === 'vitoria' || res === 'local') WowGames.confetti(el, ['❌', '⭕', '🏆', '✨']);
      }

      el.onclick = e => {
        const c = e.target.closest('[data-m]');
        if (c) { if (!pensando && s && !ehVezMaquina()) jogar(Number(c.dataset.m)); return; }
        const a = e.target.closest('[data-a]'); if (!a) return;
        const v = a.dataset.v;
        switch (a.dataset.a) {
          case 'modo': cfg.modo = v; return menu();
          case 'lado': cfg.humano = Number(v); return menu();
          case 'dif': cfg.dif = v; return menu();
          case 'comecar': return comecar();
          case 'menu': return menu();
          case 'reiniciar': if (s && s.n > 0 && !s.fim && !confirm('Reiniciar a partida atual?')) return; return comecar();
        }
      };

      menu();
      return () => { clearTimeout(timer); el.onclick = null; };
    }
  });
})();
