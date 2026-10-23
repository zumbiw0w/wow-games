/* wow.games: PARTIDA do Leilão dos Craques — motor de simulação e desenho do campo 2D (Canvas).
   O motor é determinístico: com a mesma semente e os mesmos times, a partida é sempre igual. Ele avança em passos fixos
   de 1/30 s de "tempo de jogo", sem depender da taxa de quadros. Assistir em 1x, acelerar ou pular a partida usam
   exatamente o mesmo passo(), então o resultado de "pular" é o mesmo que sairia assistindo.
   Duração: 120 s de tempo de simulação = 90 minutos no relógio (2 minutos reais em velocidade 1x).
   Prorrogação: mais 30 s (minutos 90 a 120). Depois, se precisar, disputa de pênaltis. */
(function () {
  const R = WowGames.CraquesRegras;
  const L = 105, W = 68, DT = 1 / 30, CY = W / 2, TRAVE = 3.66;
  const T_JOGO = 120, T_PRORRO = 30, T_INTERVALO = 60;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function distSeg(p, a, b) {                                         // distância de um ponto a um segmento
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  /* ---------- Montagem dos times ---------- */
  function montarTime(def, lado) {
    const slots = R.FORMACOES[def.formacao], est = R.ESTILOS[def.estilo] || R.ESTILOS.equilibrado;
    const jogs = slots.map((s, i) => {
      const a = R.atleta(def.titulares[i]);
      const f = R.compat(a, s[0]), k = .55 + .45 * f;                 // fora de posição: atributos caem de forma moderada
      const atr = {};
      ['vel', 'pas', 'chu', 'def', 'con'].forEach(c => { atr[c] = a.atr[c] * k; });
      atr.gol = s[0] === 'GOL' ? (a.pos === 'GOL' ? a.atr.gol : a.atr.gol * .6 + 10) : a.atr.gol;
      return { i, lado, id: a.id, nome: a.nome, curto: curto(a.nome), num: numero(s[0], i), papel: s[0], setor: R.SETOR[s[0]], fx: s[1], fy: s[2],
        atr, fator: f, nota: a.nota, x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, sta: 100, cool: .5, tcool: 0, trava: 0, alvo: null, drib: null };
    });
    return { lado, nome: def.nome, cor: def.cor, cor2: def.cor2, est, estilo: def.estilo, jogs, gk: jogs[0],
      st: { gols: 0, chutes: 0, noAlvo: 0, defesas: 0, passes: 0, passesCertos: 0, desarmes: 0, intercept: 0, posse: 0 } };
  }
  const NUMEROS = { GOL: [1], LAT: [2, 6], ZAG: [3, 4, 5], VOL: [5, 8], MEI: [8, 10, 7], PON: [7, 11], ATA: [9, 10, 11] };
  function numero(p, i) { return [1, 2, 3, 4, 6, 5, 8, 10, 7, 9, 11][i] || (NUMEROS[p] || [i + 1])[0]; }
  function curto(n) { const p = n.split(' '); return p.length > 1 && p[p.length - 1].length > 2 ? p[p.length - 1] : n; }

  function criar(cfg) {
    const S = {
      seed: cfg.seed >>> 0, r: R.rng(cfg.seed >>> 0), desempate: cfg.desempate || 'nenhum',
      t: 0, periodo: 'normal', fase: 'reinicio', timer: 1.2, saida: 0, terminado: false,
      times: [montarTime(cfg.a, 0), montarTime(cfg.b, 1)],
      bola: { x: L / 2, y: CY, vx: 0, vy: 0, px: L / 2, py: CY, dono: null, voo: null, reservado: null, ultimo: null, ultimoTime: 0 },
      eventos: [], novos: [], penaltis: null, segundoTempo: false, ultIntercept: -9, ultDesarme: -9
    };
    S.times.forEach(T => T.jogs.forEach(j => { const p = posInicial(S, T, j, T.lado === S.saida); j.x = j.px = p.x; j.y = j.py = p.y; }));
    return S;
  }

  /* ---------- Coordenadas: o time 0 ataca para a direita (x = L), o time 1 para a esquerda (x = 0) ---------- */
  const mundo = (lado, fx, fy) => lado === 0 ? { x: fx * L, y: fy * W } : { x: (1 - fx) * L, y: (1 - fy) * W };
  const fxDe = (lado, x) => lado === 0 ? x / L : 1 - x / L;
  const fyDe = (lado, y) => lado === 0 ? y / W : 1 - y / W;
  const golAlvo = lado => ({ x: lado === 0 ? L : 0, y: CY });
  const frente = lado => lado === 0 ? 1 : -1;

  function posInicial(S, T, j, comBola) {
    let fx = Math.min(j.fx, .46) * .95 + .02, fy = j.fy;
    if (j.papel === 'GOL') fx = .02;
    return mundo(T.lado, fx, fy);
  }
  function quemSai(T) {                                                // quem dá a saída: o atacante mais central
    return T.jogs.filter(j => j.papel !== 'GOL').sort((a, b) => (b.fx - Math.abs(b.fy - .5)) - (a.fx - Math.abs(a.fy - .5)))[0];
  }

  /* ---------- Narração ---------- */
  function minuto(S) { return S.periodo === 'prorrogacao' ? Math.min(120, 90 + Math.floor((S.t - T_JOGO) / T_PRORRO * 30)) : Math.min(90, Math.floor(S.t / T_JOGO * 90)); }
  function narrar(S, tipo, lado, txt, extra) {
    const e = Object.assign({ min: minuto(S), t: S.t, tipo, lado, txt }, extra || {});
    S.eventos.push(e); S.novos.push(e); return e;
  }
  const pick = (S, arr) => arr[Math.floor(S.r() * arr.length)];

  /* ---------- Um passo da simulação ---------- */
  function passo(S) {
    if (S.terminado) return;
    S.times.forEach(T => T.jogs.forEach(j => { j.px = j.x; j.py = j.y; }));
    S.bola.px = S.bola.x; S.bola.py = S.bola.y;
    if (S.fase === 'penaltis') return;
    if (S.fase === 'gol') {                                             // comemoração curta (o relógio continua)
      S.timer -= DT; comemorar(S);
      if (S.timer <= 0) { S.fase = 'reinicio'; S.timer = 1.3; }
    } else if (S.fase === 'reinicio') {                                // todos voltam às posições de saída
      S.timer -= DT; reposicionar(S);
      if (S.timer <= 0) darSaida(S);
    } else jogar(S);
    S.t += DT;
    controlarTempo(S);
  }

  function controlarTempo(S) {
    if (S.periodo === 'normal' && !S.segundoTempo && S.t >= T_INTERVALO) {
      S.segundoTempo = true; narrar(S, 'apito', null, '⏱️ Fim do primeiro tempo. Começa o segundo tempo!');
      S.saida = 1; S.fase = 'reinicio'; S.timer = 1.3; S.bola.dono = null; S.bola.voo = null;
    }
    const [a, b] = [S.times[0].st.gols, S.times[1].st.gols];
    if (S.periodo === 'normal' && S.t >= T_JOGO) {
      if (a === b && S.desempate === 'prorrogacao') {
        S.periodo = 'prorrogacao'; S.teveProrro = true; narrar(S, 'apito', null, '⏱️ Empate no tempo normal! Vamos para a PRORROGAÇÃO (minutos 90 a 120).');
        S.saida = S.r() < .5 ? 0 : 1; S.fase = 'reinicio'; S.timer = 1.3; S.bola.dono = null; S.bola.voo = null;
      } else if (a === b && S.desempate === 'penaltis') iniciarPenaltis(S);
      else encerrar(S);
    } else if (S.periodo === 'prorrogacao' && S.t >= T_JOGO + T_PRORRO) {
      if (a === b) iniciarPenaltis(S); else encerrar(S);
    }
  }
  function encerrar(S) {
    S.fase = 'fim'; S.terminado = true; S.periodo = S.penaltis ? 'penaltis' : S.periodo;
    const [a, b] = S.times;
    narrar(S, 'fim', null, `🏁 Fim de jogo: ${a.nome} ${a.st.gols} × ${b.st.gols} ${b.nome}${S.penaltis ? ` (pênaltis ${S.penaltis.placar[0]} × ${S.penaltis.placar[1]})` : ''}.`);
  }

  function darSaida(S) {
    const T = S.times[S.saida], O = S.times[1 - S.saida];
    [T, O].forEach(X => X.jogs.forEach(j => { const p = posInicial(S, X, j); j.x = p.x; j.y = p.y; j.vx = j.vy = 0; j.alvo = null; j.drib = null; }));
    const k = quemSai(T); k.x = L / 2 - frente(T.lado) * .8; k.y = CY;
    Object.assign(S.bola, { x: L / 2, y: CY, vx: 0, vy: 0, dono: k, voo: null, reservado: null, ultimo: k, ultimoTime: T.lado });
    k.cool = .5; k.pegou = S.t; S.fase = 'jogo';
  }
  function reposicionar(S) {
    S.times.forEach(T => T.jogs.forEach(j => { const p = posInicial(S, T, j); mover(j, p, 9); }));
  }
  function comemorar(S) {
    const T = S.times[S.ultimoGolLado], autor = S.ultimoAutor;
    T.jogs.forEach(j => { if (autor && j !== autor) mover(j, { x: autor.x + (j.i % 3 - 1) * 1.5, y: autor.y + ((j.i >> 1) % 3 - 1) * 1.5 }, 6); });
    S.times[1 - S.ultimoGolLado].jogs.forEach(j => mover(j, { x: j.x, y: j.y }, 1));
    if (autor) mover(autor, { x: clamp(autor.x + frente(T.lado) * -2, 4, L - 4), y: clamp(autor.y + 3, 3, W - 3) }, 4);
  }

  /* ---------- Movimento ---------- */
  function velMax(j) { return (4.6 + j.atr.vel / 100 * 3.6) * (.72 + .28 * j.sta / 100); }
  function mover(j, alvo, vmax) {
    const dx = alvo.x - j.x, dy = alvo.y - j.y, d = Math.hypot(dx, dy);
    const v = Math.min(vmax, d * 2.2), ux = d > .01 ? dx / d : 0, uy = d > .01 ? dy / d : 0;
    j.vx += (ux * v - j.vx) * Math.min(1, DT * 7); j.vy += (uy * v - j.vy) * Math.min(1, DT * 7);
    j.x = clamp(j.x + j.vx * DT, -1, L + 1); j.y = clamp(j.y + j.vy * DT, -1, W + 1);
  }

  /* ---------- Posicionamento tático (âncoras) ---------- */
  function ancoras(S, T, ataque) {
    const b = S.bola, O = S.times[1 - T.lado], bfx = fxDe(T.lado, b.x), byn = fyDe(T.lado, b.y), est = T.est;
    const linhaAdv = Math.max(...O.jogs.filter(j => j.papel !== 'GOL').map(j => fxDe(T.lado, j.x)));   // última linha adversária (impedimento)
    const desloc = (bfx - .45) * .55 + est.linha + (ataque ? .07 : -.04);
    return T.jogs.map(j => {
      if (j.papel === 'GOL') {
        const fx = .015 + (bfx < .3 ? (.3 - bfx) / .3 * .035 : 0);
        return mundo(T.lado, fx, .5 + (byn - .5) * .14);
      }
      let fx = j.fx + desloc * (j.setor === 'def' ? .85 : 1) + (ataque && j.setor === 'ata' ? est.avanco * .12 : 0);
      let fy = ataque ? .5 + (j.fy - .5) * 1.12 : .5 + (j.fy - .5) * .8 + (byn - .5) * .22;
      if (j.setor === 'mei') fy += (byn - fy) * .12;
      const lim = j.setor === 'def' ? [.07, ataque ? .62 : .5] : j.setor === 'mei' ? [.12, .8] : [.2, .93];
      fx = clamp(fx, lim[0], lim[1]);
      if (ataque) fx = Math.min(fx, Math.max(linhaAdv, bfx) + .01);   // não fica impedido esperando a bola
      return mundo(T.lado, fx, clamp(fy, .04, .96));
    });
  }

  /* ---------- Jogo em andamento ---------- */
  function jogar(S) {
    const b = S.bola, [A, B] = S.times;
    const posse = b.dono ? b.dono.lado : b.voo && b.voo.tipo === 'passe' ? b.voo.lado : null;
    if (posse !== null) S.times[posse].st.posse += DT;
    const anc = [ancoras(S, A, posse === 0), ancoras(S, B, posse === 1)];

    // papéis especiais: quem pressiona, quem busca a bola solta, quem corta a linha de passe
    const papeis = new Map();
    const alvoBola = b.dono ? b.dono : { x: b.x + b.vx * .35, y: b.y + b.vy * .35 };
    S.times.forEach(T => {
      if (b.reservado) return;
      const linha = T.jogs.filter(j => j.papel !== 'GOL' && j.trava <= 0);
      const ord = linha.slice().sort((p, q) => dist(p, alvoBola) - dist(q, alvoBola));
      if (b.dono && b.dono.lado !== T.lado) {
        const meuGol = golAlvo(1 - T.lado), c = b.dono, u = Math.hypot(meuGol.x - c.x, meuGol.y - c.y) || 1;
        papeis.set(ord[0], { x: c.x + (meuGol.x - c.x) / u * .9, y: c.y + (meuGol.y - c.y) / u * .9 });
        const pressionaDois = T.est.pressao > 1 || fxDe(T.lado, c.x) < .38;
        if (pressionaDois && ord[1]) papeis.set(ord[1], { x: c.x + (meuGol.x - c.x) / u * 5, y: c.y + (meuGol.y - c.y) / u * 5 });
      } else if (!b.dono) {
        if (b.voo && b.voo.tipo === 'passe' && b.voo.lado === T.lado && b.voo.alvo) {
          const tChegada = clamp(dist(b, b.voo.alvo) / Math.max(4, Math.hypot(b.vx, b.vy)), 0, 1.5);
          papeis.set(b.voo.alvo, { x: b.x + b.vx * tChegada * .8, y: b.y + b.vy * tChegada * .8 });
        } else if (!(b.voo && b.voo.tipo === 'chute')) papeis.set(ord[0], alvoBola);
        if (b.voo && b.voo.tipo === 'passe' && b.voo.lado !== T.lado) {   // defensor mais próximo tenta cortar o passe
          const fut = { x: b.x + b.vx * .45, y: b.y + b.vy * .45 };
          const c = linha.slice().sort((p, q) => dist(p, fut) - dist(q, fut))[0];
          if (c && dist(c, fut) < 9) papeis.set(c, fut);
        }
      }
    });
    if (b.reservado) papeis.set(b.reservado, { x: b.x, y: b.y });

    // movimento de todos
    S.times.forEach(T => T.jogs.forEach(j => {
      j.trava = Math.max(0, j.trava - DT); j.tcool = Math.max(0, j.tcool - DT);
      let alvo, vm = velMax(j);
      if (b.dono === j) { conduzir(S, j); return; }
      if (j.papel === 'GOL' && b.voo && b.voo.tipo === 'chute' && b.voo.lado !== T.lado) {      // goleiro reage à finalização
        const gx = golAlvo(b.voo.lado).x, tt = Math.abs((gx - b.x) / (b.vx || 1e-6));
        alvo = { x: gx - frente(b.voo.lado) * 1, y: clamp(b.y + b.vy * tt, CY - TRAVE - 1, CY + TRAVE + 1) }; vm *= 1.6;
      } else if (papeis.has(j)) { alvo = papeis.get(j); vm *= 1.02; }
      else {
        alvo = anc[T.lado][j.i];
        if (posse === T.lado && b.dono && j.setor !== 'def' && dist(alvo, b.dono) < 6) {      // abre espaço para receber
          const u = dist(alvo, b.dono) || 1; alvo = { x: alvo.x + (alvo.x - b.dono.x) / u * 3, y: alvo.y + (alvo.y - b.dono.y) / u * 3 };
        }
        vm *= dist(j, alvo) > 6 ? .9 : .55;
      }
      mover(j, alvo, vm);
      cansar(S, j, T);
    }));
    separar(S);
    atualizarBola(S);
    desarmes(S);
  }
  function cansar(S, j, T) {
    const v = Math.hypot(j.vx, j.vy), vm = 4.6 + j.atr.vel / 100 * 3.6;
    j.sta = clamp(j.sta - (v / vm) ** 2 * DT * .32 * (T.est.pressao > 1 ? 1.25 : 1) + DT * .04, 35, 100);
  }
  function separar(S) {
    S.times.forEach(T => {
      for (let i = 0; i < T.jogs.length; i++) for (let k = i + 1; k < T.jogs.length; k++) {
        const p = T.jogs[i], q = T.jogs[k], d = dist(p, q);
        if (d < 1.8 && d > .001) { const f = (1.8 - d) * .5 * DT * 6; p.x -= (q.x - p.x) / d * f; p.y -= (q.y - p.y) / d * f; q.x += (q.x - p.x) / d * f; q.y += (q.y - p.y) / d * f; }
      }
    });
  }

  /* ---------- Quem está com a bola: conduzir, passar ou chutar ---------- */
  function conduzir(S, c) {
    const T = S.times[c.lado], O = S.times[1 - c.lado], b = S.bola;
    c.cool -= DT;
    const marc = Math.min(...O.jogs.map(o => dist(o, c)));
    if (c.cool <= 0 || (marc < 1.9 && c.cool > .25 && c.papel !== 'GOL' && S.r() < .08)) decidir(S, c, T, O, marc);
    if (b.dono !== c) return;
    let alvo;
    if (c.papel === 'GOL') alvo = { x: c.x, y: c.y };
    else {
      if (!c.drib || c.drib.ate < S.t) {
        const g = golAlvo(c.lado), f = frente(c.lado), u = dist(c, g) || 1;
        let vx = (g.x - c.x) / u * .65 + f * .35, vy = (g.y - c.y) / u * .65;   // rumo ao gol, puxando para a frente
        const perto = O.jogs.filter(o => (o.x - c.x) * f > -1 && dist(o, c) < 6).sort((p, q) => dist(p, c) - dist(q, c))[0];
        if (perto) vy += (perto.y > c.y ? -1 : 1) * .55;                  // desvia do marcador
        if (c.y < 5) vy += .6; if (c.y > W - 5) vy -= .6;                  // não se prende à lateral
        if (fxDe(c.lado, c.x) > .9) { vx *= .3; vy += (CY - c.y) / 20; }   // perto da linha de fundo: corta para dentro
        c.drib = { ang: Math.atan2(vy, vx), ate: S.t + .4 + S.r() * .3 };
      }
      alvo = { x: clamp(c.x + Math.cos(c.drib.ang) * 6, 1.5, L - 1.5), y: clamp(c.y + Math.sin(c.drib.ang) * 6, 1.5, W - 1.5) };
    }
    mover(c, alvo, velMax(c) * .86);
    cansar(S, c, T);
    const u = Math.hypot(c.vx, c.vy) || 1;
    b.x = c.x + (u > .3 ? c.vx / u : frente(c.lado)) * .75; b.y = c.y + (u > .3 ? c.vy / u : 0) * .75; b.vx = c.vx; b.vy = c.vy;
  }

  function decidir(S, c, T, O, marc) {
    const g = golAlvo(c.lado), f = frente(c.lado), d = dist(c, g), est = T.est;
    c.cool = .35 + S.r() * .45;
    const fxc = fxDe(c.lado, c.x), segurando = S.t - (c.pegou || S.t);   // há quanto tempo está com a bola
    const fundo = fxc > .84 && Math.abs(c.y - CY) > 11;                  // ponta perto da linha de fundo: hora de cruzar
    // 1) chute
    let sChute = -9;
    if (d < 32 && c.papel !== 'GOL') {
      const ang = Math.abs(c.y - CY);
      const q = c.atr.chu / 100 * clamp(1 - (d - 7) / 26, 0, 1) * (1 - Math.min(ang / 34, .65));
      sChute = q * 1.5 + est.chute - (marc < 1.4 ? .1 : 0) + (d < 14 ? .32 : 0) - .02 + (segurando > 3 ? .15 : 0);
    }
    // 2) passe: avalia todos os companheiros
    let melhor = null, sPasse = -9;
    T.jogs.forEach(m => {
      if (m === c || (m.papel === 'GOL' && !(c.setor === 'def' && marc < 2.5))) return;
      const len = dist(c, m); if (len < 4 || len > 42) return;
      const ganho = (m.x - c.x) * f;
      const lane = Math.min(...O.jogs.map(o => distSeg(o, c, m))), marca = Math.min(...O.jogs.map(o => dist(o, m)));
      const risco = lane < 1.2 ? .65 : lane < 2.6 ? .22 : 0;
      const perigo = dist(m, g) < 24 ? (fundo ? .55 : .22) : 0;
      const s = .34 + ganho / 40 * (.9 + est.avanco) + Math.min(marca, 8) / 8 * .35 + perigo - risco - len / 85 + est.passe + (c.papel === 'GOL' ? .3 : 0);
      if (s > sPasse) { sPasse = s; melhor = m; }
    });
    // 3) conduzir
    const frenteLivre = Math.min(...O.jogs.map(o => dist(o, { x: c.x + f * 6, y: c.y })));
    let sDrib = c.papel === 'GOL' ? -9 : .1 + (c.atr.con + c.atr.vel) / 200 * .35 + Math.min(frenteLivre, 8) / 8 * .3 - (marc < 2 ? .3 : 0) - est.passe * .5
      - (fundo ? .4 : 0) - (segurando > 2.5 ? .45 : 0) - (c.y < 3 || c.y > W - 3 ? .2 : 0);
    sChute += S.r() * .2; sPasse += S.r() * .2; sDrib += S.r() * .2;
    if (sChute >= sPasse && sChute >= sDrib) chutar(S, c, T, O, d, marc);
    else if (melhor && sPasse >= sDrib) passar(S, c, melhor, T, marc);
    else if (melhor && (sDrib < -.3 || segurando > 5)) passar(S, c, melhor, T, marc);     // nunca fica parado com a bola
    else { c.drib = null; c.cool = .3 + S.r() * .4; }
  }

  function gauss(S) { return (S.r() + S.r() + S.r() - 1.5) / .5; }
  function passar(S, c, m, T, marc) {
    const b = S.bola, len = dist(c, m), vel = clamp(10 + len * .55, 11, 24);
    const lead = len / vel * .8, alvo = { x: m.x + m.vx * lead, y: m.y + m.vy * lead };
    const sd = (1 - c.atr.pas / 100) * .32 + (marc < 1.5 ? .07 : 0) + len / 260;
    const ang = Math.atan2(alvo.y - c.y, alvo.x - c.x) + gauss(S) * sd * .5;
    const v = vel * (1 + gauss(S) * sd * .25);
    Object.assign(b, { dono: null, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, ultimo: c, ultimoTime: c.lado,
      voo: { tipo: 'passe', lado: c.lado, alvo: m, de: c, testados: new Set([c]) } });
    c.trava = .3; T.st.passes++;
  }
  function chutar(S, c, T, O, d, marc) {
    const b = S.bola;
    const pAlvo = clamp(.2 + (c.atr.chu - 50) / 100 * 1.0 - d / 75 + .12 - (marc < 1.5 ? .1 : 0), .1, .88);
    const noAlvo = S.r() < pAlvo, lado = S.r() < .5 ? -1 : 1;
    const yAlvo = noAlvo ? CY + lado * (.6 + S.r() * 2.9) : CY + lado * (4 + S.r() * 5);
    const g = golAlvo(c.lado), vel = 19 + c.atr.chu / 100 * 10, u = Math.hypot(g.x - c.x, yAlvo - c.y) || 1;
    const q = clamp(c.atr.chu / 100 * (1 - d / 40) + (Math.abs(yAlvo - CY) > 2.5 ? .12 : 0), .05, 1);
    Object.assign(b, { dono: null, vx: (g.x - c.x) / u * vel, vy: (yAlvo - c.y) / u * vel, ultimo: c, ultimoTime: c.lado,
      voo: { tipo: 'chute', lado: c.lado, de: c, noAlvo, q, testados: new Set([c]), resolvido: false } });
    c.trava = .4; T.st.chutes++; if (noAlvo) T.st.noAlvo++;
    narrar(S, 'chute', c.lado, pick(S, d > 22 ? [`${c.curto} arrisca de longe!`, `Bomba de ${c.curto} de fora da área!`] : [`${c.curto} finaliza!`, `${c.curto} bate para o gol!`, `Chute de ${c.curto}!`]), { quem: c.nome });
  }

  /* ---------- Bola ---------- */
  function atualizarBola(S) {
    const b = S.bola;
    if (b.dono) { verificarLimites(S); return; }
    const sp = Math.hypot(b.vx, b.vy);
    const desac = b.voo && b.voo.tipo === 'chute' ? 1.5 : 5.2;
    if (sp > 0) { const nv = Math.max(0, sp - desac * DT); b.vx *= nv / sp; b.vy *= nv / sp; }
    b.x += b.vx * DT; b.y += b.vy * DT;
    if (b.voo && b.voo.tipo === 'chute') resolverChute(S);
    if (S.fase !== 'jogo') return;
    if (verificarLimites(S)) return;
    if (b.reservado) {
      if (dist(b.reservado, b) < 1.2) { b.dono = b.reservado; b.reservado = null; b.voo = null; b.dono.cool = .45; b.dono.pegou = S.t; b.ultimo = b.dono; b.ultimoTime = b.dono.lado; }
      return;
    }
    if (b.voo && b.voo.tipo === 'chute') return;
    const spd = Math.hypot(b.vx, b.vy), raio = spd > 9 ? 1.15 : 1.5;
    const cands = [];
    S.times.forEach(T => T.jogs.forEach(j => { if (j.trava <= 0 && dist(j, b) < raio) cands.push(j); }));
    cands.sort((p, q) => dist(p, b) - dist(q, b));
    for (const j of cands) {
      const v = b.voo;
      if (v && v.testados.has(j)) continue;
      if (v) v.testados.add(j);
      if (v && v.tipo === 'passe' && v.lado === j.lado) {
        const pOk = clamp(.72 + (j.atr.con - 50) / 100 * .5 - (spd > 18 ? .08 : 0), .5, .97);
        if (S.r() < pOk) { dominar(S, j); S.times[j.lado].st.passesCertos++; return; }
        b.vx *= .45; b.vy *= .45; b.vx += (S.r() - .5) * 4; b.vy += (S.r() - .5) * 4; b.voo = { tipo: 'solta', testados: new Set([j]) }; b.ultimo = j; b.ultimoTime = j.lado;
        return;
      }
      if (v && v.tipo === 'passe') {                                   // adversário no caminho do passe
        const p = clamp(.12 + (j.atr.def - 50) / 100 * .8 - spd / 55, .05, .6);
        if (S.r() < p) {
          dominar(S, j); S.times[j.lado].st.intercept++;
          if (S.t - S.ultIntercept > 6) { S.ultIntercept = S.t; narrar(S, 'corte', j.lado, pick(S, [`${j.curto} intercepta o passe.`, `Passe errado! ${j.curto} rouba a bola.`, `${j.curto} lê a jogada e corta.`])); }
          return;
        }
        continue;
      }
      dominar(S, j); return;                                            // bola solta: o mais próximo domina
    }
    if (spd < .4 && b.voo) b.voo = { tipo: 'solta', testados: new Set() };
  }
  function dominar(S, j) { const b = S.bola; b.dono = j; j.pegou = S.t; b.voo = null; b.vx = b.vy = 0; b.ultimo = j; b.ultimoTime = j.lado; j.cool = .25 + S.r() * .35; j.drib = null; }

  function resolverChute(S) {
    const b = S.bola, v = b.voo, atacante = S.times[v.lado], D = S.times[1 - v.lado], gk = D.gk, gx = golAlvo(v.lado).x;
    // bloqueio por defensores no caminho
    D.jogs.forEach(o => {
      if (o === gk || v.testados.has(o) || dist(o, b) > 1.1) return;
      v.testados.add(o);
      if (S.r() < .1 + o.atr.def / 100 * .22) {
        b.vx = -b.vx * .3 + (S.r() - .5) * 6; b.vy = b.vy * .3 + (S.r() - .5) * 8; b.voo = { tipo: 'solta', testados: new Set([o]) }; b.ultimo = o; b.ultimoTime = o.lado;
        narrar(S, 'bloqueio', o.lado, pick(S, [`${o.curto} se joga na frente e bloqueia!`, `Travada de ${o.curto}!`]));
      }
    });
    if (b.voo !== v) return;
    if (!v.resolvido && Math.abs(gx - b.x) < 2.6) {                    // chegou ao goleiro
      v.resolvido = true;
      const tt = Math.abs((gx - b.x) / (b.vx || 1e-6)), yLinha = b.y + b.vy * tt;
      if (!v.noAlvo || Math.abs(yLinha - CY) > TRAVE) { v.fora = true; return; }
      const alcance = 1.5 + gk.atr.gol / 100 * 1.7, dy = Math.abs(gk.y - yLinha);
      const pDef = dy > alcance + .6 ? 0 : clamp(.12 + (gk.atr.gol - 50) / 100 * 1.4 - v.q * .45 + (alcance - dy) / alcance * .12, .06, .9);
      if (S.r() < pDef) {
        D.st.defesas++;
        if (S.r() < .55) { dominar(S, gk); gk.cool = .8; narrar(S, 'defesa', D.lado, pick(S, [`Defesaça de ${gk.curto}! Segura firme.`, `${gk.curto} encaixa a bola.`])); }
        else {
          b.vx = -frente(v.lado) * (6 + S.r() * 5); b.vy = (S.r() - .5) * 14; b.voo = { tipo: 'solta', testados: new Set([gk]) }; b.ultimo = gk; b.ultimoTime = gk.lado;
          gk.trava = .5;
          narrar(S, 'defesa', D.lado, pick(S, [`${gk.curto} espalma! Rebote na área!`, `Que defesa de ${gk.curto}! Ele manda para longe.`]));
        }
      } else v.gol = true;
    }
  }

  function verificarLimites(S) {
    const b = S.bola;
    const dentro = b.y > CY - TRAVE && b.y < CY + TRAVE;
    if ((b.x <= 0 || b.x >= L) && dentro) { gol(S, b.x >= L ? 0 : 1); return true; }
    if (b.x < 0 || b.x > L) {                                           // linha de fundo
      const ladoGol = b.x > L ? 1 : 0;                                  // time que defende este gol
      if (b.voo && b.voo.tipo === 'chute' && b.voo.de) narrar(S, 'fora', b.voo.lado, pick(S, [`Para fora! ${b.voo.de.curto} errou o alvo.`, `A bola passa raspando a trave!`, `${b.voo.de.curto} manda por cima.`]));
      if (b.ultimoTime === ladoGol) {                                   // escanteio
        const T = S.times[1 - ladoGol], cy = b.y < CY ? .6 : W - .6, cx = b.x > L ? L - .6 : .6;
        const k = T.jogs.filter(j => j.papel !== 'GOL').sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy))[0];
        repor(S, cx, cy, k); narrar(S, 'escanteio', T.lado, `Escanteio para ${T.nome}.`);
      } else { const gk = S.times[ladoGol].gk; repor(S, ladoGol === 1 ? L - 5.5 : 5.5, CY, gk); }
      return true;
    }
    if (b.y < 0 || b.y > W) {                                           // lateral
      const T = S.times[1 - b.ultimoTime], cy = b.y < 0 ? .4 : W - .4, cx = clamp(b.x, 1, L - 1);
      const k = T.jogs.filter(j => j.papel !== 'GOL').sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy))[0];
      repor(S, cx, cy, k);
      return true;
    }
    return false;
  }
  function repor(S, x, y, quem) { Object.assign(S.bola, { x, y, vx: 0, vy: 0, dono: null, voo: null, reservado: quem }); quem.drib = null; }

  function gol(S, lado) {
    const T = S.times[lado], b = S.bola, autor = b.ultimo && b.ultimo.lado === lado ? b.ultimo : null;
    T.st.gols++; S.ultimoGolLado = lado; S.ultimoAutor = autor || T.jogs[9];
    const txt = autor ? pick(S, [`⚽ GOOOL! ${autor.nome} marca para ${T.nome}!`, `⚽ GOL de ${autor.nome}! Que finalização!`, `⚽ É GOL! ${autor.curto} balança a rede!`]) : `⚽ GOL CONTRA! A bola sobra e entra: ponto para ${T.nome}.`;
    narrar(S, 'gol', lado, txt, { quem: autor ? autor.nome : 'contra', placar: [S.times[0].st.gols, S.times[1].st.gols] });
    b.dono = null; b.voo = null; b.vx *= .15; b.vy *= .15; b.reservado = null;
    b.x = clamp(b.x, -1.5, L + 1.5);
    S.fase = 'gol'; S.timer = 2; S.saida = 1 - lado;
  }

  function desarmes(S) {
    const b = S.bola, c = b.dono; if (!c || c.papel === 'GOL') return;
    const O = S.times[1 - c.lado];
    for (const o of O.jogs) {
      if (o.papel === 'GOL' || o.tcool > 0 || dist(o, c) > 1.35) continue;
      o.tcool = .7;
      const p = clamp(.17 + (o.atr.def - c.atr.con) / 140 + (O.est.pressao > 1 ? .03 : 0), .05, .5);
      if (S.r() < p) {
        O.st.desarmes++; c.trava = .5;
        if (S.r() < .65) dominar(S, o);
        else { b.dono = null; b.vx = (S.r() - .5) * 8; b.vy = (S.r() - .5) * 8; b.voo = { tipo: 'solta', testados: new Set([c]) }; b.ultimo = o; b.ultimoTime = o.lado; }
        if (S.t - S.ultDesarme > 7) { S.ultDesarme = S.t; narrar(S, 'desarme', o.lado, pick(S, [`${o.curto} dá o bote e desarma ${c.curto}.`, `Belo desarme de ${o.curto}!`, `${o.curto} toma a bola de ${c.curto}.`])); }
        return;
      }
      o.trava = .35;
    }
  }

  /* ---------- Pênaltis ---------- */
  function iniciarPenaltis(S) {
    S.fase = 'penaltis'; S.periodo = 'penaltis';
    narrar(S, 'apito', null, '🥅 Empate! A decisão vai para os PÊNALTIS.');
    const bat = S.times.map(T => T.jogs.filter(j => j.papel !== 'GOL').sort((a, b) => b.atr.chu - a.atr.chu));
    const seq = [], placar = [0, 0];
    for (let n = 0; n < 60; n++) {
      const k = n % 2, rod = Math.floor(n / 2), bt = bat[k][rod % bat[k].length], gk = S.times[1 - k].gk;
      const p = clamp(.74 + (bt.atr.chu - gk.atr.gol) / 250 + (bt.sta - 70) / 600, .55, .9);
      const gol = S.r() < p; if (gol) placar[k]++;
      seq.push({ lado: k, quem: bt.nome, gol, placar: placar.slice() });
      const ka = Math.ceil((n + 1) / 2), kb = Math.floor((n + 1) / 2);   // cobranças já feitas por cada time
      if (ka <= 5 && kb <= 5) {
        if (placar[0] + (5 - ka) < placar[1] || placar[1] + (5 - kb) < placar[0]) break;   // ninguém alcança mais
      } else if (ka === kb && placar[0] !== placar[1]) break;          // alternadas: decide a cada par
    }
    if (placar[0] === placar[1]) { const k = S.r() < .5 ? 0 : 1; placar[k]++; seq.push({ lado: k, quem: S.times[k].jogs[9].nome, gol: true, placar: placar.slice() }); }
    S.penaltis = { seq, placar };
    seq.forEach(x => narrar(S, x.gol ? 'penalti-gol' : 'penalti-erro', x.lado, `${x.gol ? '✅' : '❌'} ${x.quem} ${x.gol ? 'converte' : 'perde'} o pênalti (${x.placar[0]} × ${x.placar[1]}).`, { penalti: true }));
    encerrar(S);
  }

  /* ---------- Resultado ---------- */
  function resultado(S) {
    const [A, B] = S.times, tot = (A.st.posse + B.st.posse) || 1;
    let venc = A.st.gols > B.st.gols ? 0 : B.st.gols > A.st.gols ? 1 : null;
    if (venc === null && S.penaltis) venc = S.penaltis.placar[0] > S.penaltis.placar[1] ? 0 : 1;
    return { placar: [A.st.gols, B.st.gols], penaltis: S.penaltis ? S.penaltis.placar : null, prorrogacao: !!S.teveProrro,
      vencedor: venc, posse: [Math.round(A.st.posse / tot * 100), 100 - Math.round(A.st.posse / tot * 100)],
      stats: [A.st, B.st].map(s => ({ chutes: s.chutes, noAlvo: s.noAlvo, defesas: s.defesas, passes: s.passes, passesCertos: s.passesCertos, desarmes: s.desarmes, intercept: s.intercept })),
      gols: S.eventos.filter(e => e.tipo === 'gol').map(e => ({ min: e.min, lado: e.lado, quem: e.quem })),
      destaques: S.eventos.filter(e => ['gol', 'defesa', 'apito', 'fim'].includes(e.tipo) || e.penalti).map(e => ({ min: e.min, tipo: e.tipo, lado: e.lado, txt: e.txt })) };
  }
  function simularTudo(S, limite) {                                   // usado pelo "pular": mesma lógica, sem desenhar
    let n = 0; const max = limite || 30 * (T_JOGO + T_PRORRO + 20);
    while (!S.terminado && n++ < max) passo(S);
    if (!S.terminado) encerrar(S);
    return resultado(S);
  }

  /* ---------- Desenho do campo (Canvas 2D) ---------- */
  function Campo(canvas) {
    const ctx = canvas.getContext('2d'), M = 3;
    let esc = 1, fundo = null, w = 0, h = 0;
    function medir() {
      const cssW = canvas.clientWidth || 600, dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cssW; h = Math.round(cssW * (W + 2 * M) / (L + 2 * M));
      canvas.style.height = h + 'px'; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); esc = w / (L + 2 * M); fundo = null;
    }
    const X = x => (x + M) * esc, Y = y => (y + M) * esc;
    function desenharFundo() {
      fundo = document.createElement('canvas'); fundo.width = canvas.width; fundo.height = canvas.height;
      const g = fundo.getContext('2d'), dpr = canvas.width / w; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#2f8f46'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) { if (i % 2) { g.fillStyle = '#34994c'; g.fillRect(X(i * L / 12), Y(0), L / 12 * esc, W * esc); } }
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1.5, esc * .22);
      g.strokeRect(X(0), Y(0), L * esc, W * esc);
      g.beginPath(); g.moveTo(X(L / 2), Y(0)); g.lineTo(X(L / 2), Y(W)); g.stroke();
      g.beginPath(); g.arc(X(L / 2), Y(CY), 9.15 * esc, 0, Math.PI * 2); g.stroke();
      [0, L].forEach(x0 => {
        const s = x0 === 0 ? 1 : -1;
        g.strokeRect(X(x0 === 0 ? 0 : L - 16.5), Y(CY - 20.16), 16.5 * esc, 40.32 * esc);
        g.strokeRect(X(x0 === 0 ? 0 : L - 5.5), Y(CY - 9.16), 5.5 * esc, 18.32 * esc);
        g.beginPath(); g.arc(X(x0 + s * 11), Y(CY), 9.15 * esc, s > 0 ? -.93 : Math.PI - .93, s > 0 ? .93 : Math.PI + .93); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(X(x0 + s * 11), Y(CY), Math.max(1.5, esc * .3), 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(X(x0 === 0 ? -2 : L), Y(CY - TRAVE), 2 * esc, 2 * TRAVE * esc);
        g.strokeRect(X(x0 === 0 ? -2 : L), Y(CY - TRAVE), 2 * esc, 2 * TRAVE * esc);
      });
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(L / 2), Y(CY), Math.max(1.5, esc * .3), 0, 7); g.fill();
    }
    function desenhar(S, alfa) {
      if (!w || canvas.clientWidth !== w) medir();
      if (!fundo) desenharFundo();
      ctx.clearRect(0, 0, w, h); ctx.drawImage(fundo, 0, 0, w, h);
      const ip = (o, k) => o['p' + k] + (o[k] - o['p' + k]) * alfa;
      const r = Math.max(5, 1.35 * esc), b = S.bola;
      S.times.forEach(T => T.jogs.forEach(j => {
        const x = X(ip(j, 'x')), y = Y(ip(j, 'y'));
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x + r * .25, y + r * .35, r, r * .7, 0, 0, 7); ctx.fill();
        if (b.dono === j) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = Math.max(2, r * .35); ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, 7); ctx.stroke(); }
        ctx.fillStyle = j.papel === 'GOL' ? (T.lado === 0 ? '#1c1840' : '#7a1fa2') : T.cor;
        ctx.strokeStyle = T.cor2; ctx.lineWidth = Math.max(1.5, r * .28);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = j.papel === 'GOL' ? '#fff' : contraste(T.cor); ctx.font = `900 ${Math.round(r * 1.05)}px system-ui,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(j.num, x, y + r * .05);
      }));
      const bx = X(ip(b, 'x')), by = Y(ip(b, 'y')), br = Math.max(3, .62 * esc);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(bx + br * .4, by + br * .6, br, br * .7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1, br * .3);
      ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill(); ctx.stroke();
      if (b.dono) {                                                       // nome de quem está com a bola
        const nx = X(ip(b.dono, 'x')), ny = Y(ip(b.dono, 'y')) - r * 2.1;
        ctx.font = `800 ${Math.max(10, Math.round(r * .95))}px system-ui,sans-serif`;
        const t = b.dono.curto, tw = ctx.measureText(t).width + 8;
        ctx.fillStyle = 'rgba(28,24,64,.75)'; ctx.fillRect(nx - tw / 2, ny - r * .65, tw, r * 1.3);
        ctx.fillStyle = '#fff'; ctx.fillText(t, nx, ny);
      }
    }
    function contraste(hex) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1c1840' : '#fff'; }
    return { desenhar, medir };
  }

  WowGames.CraquesPartida = { L, W, DT, T_JOGO, T_PRORRO, criar, passo, resultado, simularTudo, minuto, Campo };
})();
