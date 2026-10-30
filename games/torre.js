/* Jogo: Torre Instável (id 'torre') — solte o bloco na hora certa para empilhar a torre mais alta.
   A parte que sobra para fora da base é cortada e cai; o próximo bloco fica com a largura que sobrou.
   Contas em pixels lógicos arredondados a 0,01 (sem erro de arredondamento acumulado) e tolerância para "perfeito".
   A lógica fica em WowGames.TorreLogica (pura, sem DOM) para poder ser testada. */
(function () {
  const W = 400, H = 600, BH = 26, LARG0 = 230, MIN = 8, TOL = 3.5, BASE_Y = H - 70;
  const r2 = v => Math.round(v * 100) / 100;
  const L = {
    W, H, BH, LARG0, MIN, TOL, BASE_Y,
    velocidade: (k, varia = 0) => Math.min(440, 165 + 8.5 * k) * (1 + varia),   // px/s do k-ésimo bloco
    novo(semente = 1) {
      const s = { blocos: [{ x: r2((W - LARG0) / 2), w: LARG0 }], atual: null, n: 0, perfeitos: 0, seguidos: 0, fim: false, ultimaPrecisao: null, semente: semente >>> 0 || 1 };
      L.proximo(s); return s;
    },
    rnd(s) { s.semente = (s.semente * 1664525 + 1013904223) >>> 0; return s.semente / 4294967296; },
    topo: s => s.blocos[s.blocos.length - 1],
    proximo(s) {                                                         // novo bloco entra por um dos lados, com a largura do topo
      const t = L.topo(s), esquerda = s.n % 2 === 0;
      s.atual = { x: esquerda ? 0 : r2(W - t.w), w: t.w, dir: esquerda ? 1 : -1, v: L.velocidade(s.n, (L.rnd(s) * 2 - 1) * .06) };
    },
    passo(s, dt) {
      const a = s.atual; if (!a || s.fim) return;
      a.x += a.dir * a.v * dt;
      if (a.x <= 0) { a.x = -a.x; a.dir = 1; }
      if (a.x >= W - a.w) { a.x = 2 * (W - a.w) - a.x; a.dir = -1; }
      a.x = Math.max(0, Math.min(W - a.w, a.x));                         // nunca sai da área
    },
    // solta o bloco: devolve { ok, perfeito, precisao, corte: {x,w}|null }
    soltar(s) {
      const a = s.atual, t = L.topo(s); if (!a || s.fim) return null;
      const dx = r2(a.x - t.x), adx = Math.abs(dx);
      if (adx <= TOL) {                                                   // perfeito: encaixa exatamente sobre a base
        s.blocos.push({ x: t.x, w: t.w }); s.n++; s.perfeitos++; s.seguidos++; s.ultimaPrecisao = 1; s.atual = null;
        return { ok: true, perfeito: true, precisao: 1, corte: null, bloco: L.topo(s) };
      }
      const sobra = r2(t.w - adx);
      if (sobra < MIN) { s.fim = true; s.ultimaPrecisao = Math.max(0, sobra / t.w); const caiu = { x: a.x, w: a.w }; s.atual = null; return { ok: false, precisao: s.ultimaPrecisao, caiu }; }
      const x = r2(Math.max(a.x, t.x));
      const corte = dx > 0 ? { x: r2(t.x + t.w), w: r2(adx) } : { x: r2(a.x), w: r2(adx) };
      s.blocos.push({ x, w: sobra }); s.n++; s.seguidos = 0; s.ultimaPrecisao = sobra / t.w; s.atual = null;
      return { ok: true, perfeito: false, precisao: s.ultimaPrecisao, corte, bloco: L.topo(s) };
    },
    pontos: s => s.n * 10 + s.perfeitos * 5
  };
  WowGames.TorreLogica = L;
  if (typeof module !== 'undefined') module.exports = L;
  if (!WowGames.register || !WowGames.Arcade) return;

  const A = WowGames.Arcade, ID = 'torre';
  const Perfil = WowGames.Perfil;
  if (Perfil) {
    Perfil.registrarJogo({ id: ID, nome: 'Torre Instável', icone: '🧱', xp: ev => ev.tipo === 'fim' ? Math.min(40, 8 + ev.altura) : 0,
      recordes: [{ id: 'pontos', rotulo: 'Torre Instável: maior pontuação', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.pontos : null, fmt: A.num },
                 { id: 'altura', rotulo: 'Torre Instável: torre mais alta', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.altura : null, fmt: v => v + ' andares' }] });
    Perfil.registrarConquista({ id: 'torreengenheiro', icone: '👷', nome: 'Engenheiro', desc: 'Empilhe 15 blocos numa partida da Torre Instável.', xp: 60,
      ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.altura >= 15 });
    Perfil.registrarConquista({ id: 'torremestre', icone: '🏗️', nome: 'Mestre da Torre', desc: 'Empilhe 30 blocos numa partida da Torre Instável.', xp: 150,
      ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.altura >= 30 });
  }
  if (WowGames.Pontos) WowGames.Pontos.registrar(ID, { limite: 5, mostrarZero: ev => ev.tipo === 'fim', calcula: ev => ev.tipo === 'fim' ? Math.max(0, Math.round(ev.pontos * 2)) : 0 });

  WowGames.TorreJogo = { atual: null };
  const cor = i => `hsl(${(205 + i * 11) % 360} 70% 62%)`;

  WowGames.register({
    id: ID, nome: 'Torre Instável', icone: '🧱', cor: '#ffd36b',
    desc: 'Solte cada bloco na hora certa. O que sobrar para fora é cortado. Até onde sua torre vai?',

    mount(el) {
      const Q = A.quadro(el, { id: ID, nome: 'Torre Instável', icone: '🧱', cor: '#ffd36b',
        stats: [{ id: 'altura', rotulo: 'Altura' }, { id: 'precisao', rotulo: 'Precisão', inicial: '—' }, { id: 'pontos', rotulo: 'Pontos' }, { id: 'rec', rotulo: 'Recorde', inicial: '—' }],
        rodape: 'Clique ou toque na tela para soltar. No teclado: Espaço, Enter ou ↓. P pausa.' });
      const C = A.canvas(Q.palco, W, H), ctx = C.ctx;
      let S = L.novo(1), estado = 'inicio', cam = 0, pedacos = [], textos = [], queda = 0, espera = 0, fimT = 0, ultimoSoltar = 0;
      const reduzido = A.movimentoReduzido();
      const loop = A.laco(dt => {
        if (estado === 'jogando') atualizar(dt);
        else if (estado === 'caindo') { fimT += dt; animar(dt); if (fimT > 1) mostrarResultado(); }
        desenhar();
      });
      const recTxt = () => { const r = A.recorde(ID, 'altura'); return r === null ? null : r + ' andares'; };
      const atualizarRec = () => Q.stat('rec', A.recorde(ID, 'altura') === null ? '—' : String(A.recorde(ID, 'altura')));
      const yNivel = i => BASE_Y - i * BH;                                 // topo do bloco do nível i (0 = base)

      function telaInicio() {
        estado = 'inicio'; S = L.novo(1); cam = 0; pedacos = []; textos = []; desenhar(); atualizarRec();
        Q.inicio({ regras: ['O bloco vai e volta sobre a torre. <b>Toque para soltar</b>.', 'O que ficar para fora da base é <b>cortado</b>.', 'Encaixe perfeito vale bônus. Errou feio, a torre acaba.'], recordeTxt: recTxt(), aoJogar: comecar });
      }
      function comecar() {
        S = L.novo((Date.now() ^ (Math.random() * 1e9)) >>> 0); cam = 0; pedacos = []; textos = []; queda = 0; espera = 0; fimT = 0;
        estado = 'jogando'; Q.esconder(); loop.iniciar();
        Q.stat('altura', '0'); Q.stat('precisao', '—'); Q.stat('pontos', '0');
      }
      function animar(dt) {
        queda = Math.max(0, queda - dt);
        pedacos = pedacos.filter(p => { p.vy += 1600 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.rot += p.vr * dt; return p.y < H + 200 - cam; });
        textos = textos.filter(t => (t.t += dt) < t.dur);
        const alvo = Math.max(0, (S.n + 1) * BH - (BASE_Y - 210));         // câmera sobe junto com a torre
        cam += (alvo - cam) * Math.min(1, dt * 6);
      }
      function atualizar(dt) {
        animar(dt);
        if (espera > 0) { espera -= dt; if (espera <= 0) L.proximo(S); return; }
        L.passo(S, dt);
      }
      function soltar() {
        if (estado !== 'jogando' || !S.atual || espera > 0) return;
        const agora = performance.now(); if (agora - ultimoSoltar < 120) return; ultimoSoltar = agora;
        const nivel = S.n + 1, r = L.soltar(S);
        if (!r) return;
        if (r.ok) {
          queda = reduzido ? 0 : .1;
          if (r.corte) pedacos.push({ x: r.corte.x, y: yNivel(nivel), w: r.corte.w, vy: 0, vx: (r.corte.x > r.bloco.x ? 1 : -1) * 40, rot: 0, vr: (r.corte.x > r.bloco.x ? 1 : -1) * 2.5, cor: cor(nivel) });
          if (r.perfeito) textos.push({ txt: S.seguidos >= 3 ? `Perfeito ×${S.seguidos}! +5` : 'Perfeito! +5', y: yNivel(nivel) - 14, t: 0, dur: .9, ouro: true });
          else if (r.precisao >= .9) textos.push({ txt: 'Quase!', y: yNivel(nivel) - 14, t: 0, dur: .7 });
          Q.stat('altura', String(S.n)); Q.stat('precisao', Math.round(r.precisao * 100) + '%'); Q.stat('pontos', A.num(L.pontos(S)));
          espera = .16;                                                    // um instante antes do próximo bloco (evita soltar dois com um toque)
        } else {
          pedacos.push({ x: r.caiu.x, y: yNivel(nivel), w: r.caiu.w, vy: 0, vx: 0, rot: 0, vr: (r.caiu.x > L.topo(S).x ? 1.6 : -1.6), cor: cor(nivel) });
          Q.stat('precisao', Math.round(r.precisao * 100) + '%');
          estado = 'caindo'; fimT = 0;
        }
      }
      function mostrarResultado() {
        estado = 'fim'; loop.parar(); desenhar();
        const pontos = L.pontos(S);
        const r = A.terminar(ID, { pontos, altura: S.n, perfeitos: S.perfeitos });
        atualizarRec();
        Q.resultado({ titulo: S.n >= 30 ? 'Arranha-céu!' : S.n >= 15 ? 'Belíssima torre!' : 'A torre caiu!', emoji: '🧱', novoRecorde: r.novoRecorde, rp: r.rp, aoJogar: comecar,
          linhas: [['Altura', S.n + (S.n === 1 ? ' andar' : ' andares')], ['Perfeitos', String(S.perfeitos)], ['Pontos', A.num(pontos)], ['Recorde', (A.recorde(ID, 'altura') ?? 0) + ' andares']] });
      }
      function pausar() {
        if (estado !== 'jogando') return;
        estado = 'pausa'; loop.parar(); desenhar();
        Q.mostrar('<div class="arc-card"><h3>⏸ Pausado</h3><button class="btn big" data-arc="continuar">Continuar</button></div>', 'arc-pausa');
        const b = Q.camada.querySelector('[data-arc="continuar"]'); b.onclick = continuar; b.focus({ preventScroll: true });
      }
      function continuar() { if (estado !== 'pausa') return; Q.esconder(); estado = 'jogando'; ultimoSoltar = performance.now(); loop.iniciar(); }

      /* ---------- Desenho ---------- */
      function bloco(x, y, w, c, alfa = 1) {
        ctx.globalAlpha = alfa; ctx.fillStyle = c; ctx.fillRect(x, y, w, BH);
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, w, 5);
        ctx.strokeStyle = '#1c1840'; ctx.lineWidth = 2.5; ctx.strokeRect(x + 1.25, y + 1.25, Math.max(0, w - 2.5), BH - 2.5); ctx.globalAlpha = 1;
      }
      function desenhar() {
        const g = ctx.createLinearGradient(0, 0, 0, H); const alto = Math.min(1, S.n / 40);
        g.addColorStop(0, `hsl(${215 - alto * 40} 60% ${90 - alto * 30}%)`); g.addColorStop(1, '#fff6e0');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(0, cam);
        ctx.fillStyle = '#8b6b4e'; ctx.fillRect(0, BASE_Y + BH, W, 400);                   // chão
        ctx.fillStyle = '#6f5440'; ctx.fillRect(0, BASE_Y + BH, W, 6);
        const ini = Math.max(0, Math.floor((cam - 80) / BH));
        S.blocos.forEach((b, i) => { if (i < ini - 2) return; const y = yNivel(i) - (i === S.blocos.length - 1 && queda > 0 ? queda / .1 * BH * .6 : 0); bloco(b.x, y, b.w, i === 0 ? '#9aa3c7' : cor(i)); });
        if (S.atual && estado === 'jogando') {
          const t = L.topo(S), y = yNivel(S.n + 1);
          ctx.strokeStyle = 'rgba(28,24,64,.25)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(t.x, y); ctx.lineTo(t.x, y + BH); ctx.moveTo(t.x + t.w, y); ctx.lineTo(t.x + t.w, y + BH); ctx.stroke(); ctx.setLineDash([]);
          if (espera <= 0) bloco(S.atual.x, y, S.atual.w, cor(S.n + 1));
        }
        for (const p of pedacos) { ctx.save(); ctx.translate(p.x + p.w / 2, p.y + BH / 2); ctx.rotate(p.rot); bloco(-p.w / 2, -BH / 2, p.w, p.cor, .9); ctx.restore(); }
        for (const t of textos) { const k = t.t / t.dur; ctx.globalAlpha = 1 - k; ctx.fillStyle = t.ouro ? '#b7791f' : '#1c1840'; ctx.font = '900 18px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t.txt, W / 2, t.y - k * 22); ctx.globalAlpha = 1; }
        ctx.restore();
      }
      C.aoAjustar = () => { if (!loop.ativo) desenhar(); };

      /* ---------- Entradas ---------- */
      const aoApontar = e => { if (estado !== 'jogando') return; e.preventDefault(); soltar(); };
      C.cv.addEventListener('pointerdown', aoApontar);
      const tecla = e => {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (estado === 'jogando' && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown')) { e.preventDefault(); if (!e.repeat) soltar(); }
        else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && estado === 'jogando') pausar();
        else if ((e.key === 'p' || e.key === 'P') && estado === 'pausa') continuar();
      };
      document.addEventListener('keydown', tecla);
      const vis = () => { if (document.hidden) pausar(); };
      document.addEventListener('visibilitychange', vis);

      telaInicio();
      WowGames.TorreJogo.atual = { estado: () => estado, sim: () => S, soltar, pausar, continuar, loopAtivo: () => loop.ativo, pronto: () => estado === 'jogando' && !!S.atual && espera <= 0 };
      return () => { loop.parar(); C.destruir(); C.cv.removeEventListener('pointerdown', aoApontar); document.removeEventListener('keydown', tecla); document.removeEventListener('visibilitychange', vis); WowGames.TorreJogo.atual = null; };
    }
  });
})();
