/* Jogo: Passe pelo Buraco (id 'buraco') — guie a bolinha pelas aberturas das barreiras.
   Controles: mouse (mover sobre a área), toque/arrastar no celular, ou ↑/↓ e W/S no teclado. P ou Esc pausa.
   A geração garante que toda abertura seja alcançável a partir da anterior, mesmo só com o teclado (a mais lenta das formas
   de controle). A física fica em WowGames.BuracoFisica (pura, sem DOM) para poder ser testada. */
(function () {
  const W = 640, H = 400, R = 13, BX = 130, LARG = 52, MARGEM = 22, VEL_TECLA = 360, VEL_PONTEIRO = 760, PASSO = 1 / 240;
  const F = {
    W, H, R, BX, LARG, VEL_TECLA,
    velocidade: t => t < 55 ? 150 + 4.4 * t : Math.min(500, 392 + 1.5 * (t - 55)),   // px/s: sobe rápido até ~55 s e depois bem devagar
    abertura: n => Math.max(84, 180 - 1.9 * n),                            // altura da abertura da n-ésima barreira
    espaco: n => Math.max(215, 330 - 2.1 * n),                           // distância entre barreiras
    novo(semente = 1) {
      const s = { y: H / 2, alvo: null, dir: 0, t: 0, barreiras: [], n: 0, passagens: 0, centrados: 0, fim: false, semente: semente >>> 0 || 1, ultimoCentro: H / 2 };
      F.criarBarreira(s, W + 40);
      return s;
    },
    rnd(s) { s.semente = (s.semente * 1664525 + 1013904223) >>> 0; return s.semente / 4294967296; },
    // nova barreira numa posição sempre atravessável: o centro muda no máximo o que dá para percorrer com folga
    criarBarreira(s, x) {
      const gap = F.abertura(s.n), v = F.velocidade(s.t), esp = F.espaco(s.n);
      const tempo = esp / Math.max(v, F.velocidade(s.t + esp / v));       // tempo até a próxima chegar (pior caso)
      const maxDelta = Math.min(H * .6, VEL_TECLA * tempo * .7);
      const min = MARGEM + gap / 2, max = H - MARGEM - gap / 2;
      const lo = Math.max(min, s.ultimoCentro - maxDelta), hi = Math.min(max, s.ultimoCentro + maxDelta);
      const centro = s.n === 0 ? H / 2 : lo + F.rnd(s) * (hi - lo);
      s.barreiras.push({ x, centro, gap, passou: false, flash: 0 });
      s.ultimoCentro = centro; s.n++;
    },
    colide(s, b) {                                                       // círculo × dois retângulos (acima e abaixo da abertura)
      const topo = b.centro - b.gap / 2, base = b.centro + b.gap / 2;
      const cx = Math.max(b.x, Math.min(BX, b.x + LARG));
      const retangulo = (y0, y1) => { const cy = Math.max(y0, Math.min(s.y, y1)); const dx = BX - cx, dy = s.y - cy; return dx * dx + dy * dy < R * R; };
      return retangulo(0, topo) || retangulo(base, H);
    },
    passo(s, dt) {
      let resto = dt; const eventos = [];
      while (resto > 1e-9 && !s.fim) {
        const h = Math.min(PASSO, resto); resto -= h; s.t += h;
        if (s.dir) { s.y += s.dir * VEL_TECLA * h; s.alvo = null; }
        else if (s.alvo !== null) { const d = s.alvo - s.y, m = VEL_PONTEIRO * h; s.y += Math.abs(d) <= m ? d : Math.sign(d) * m; }
        s.y = Math.max(R, Math.min(H - R, s.y));
        const v = F.velocidade(s.t);
        for (const b of s.barreiras) {
          b.x -= v * h; b.flash = Math.max(0, b.flash - h);
          if (!b.passou && b.x + LARG < BX - R) {
            b.passou = true; s.passagens++; b.flash = .35;
            const centrado = Math.abs(s.y - b.centro) < b.gap * .16; if (centrado) s.centrados++;
            eventos.push({ tipo: 'passou', centrado, y: s.y });
          }
          if (!b.passou && F.colide(s, b)) { s.fim = true; eventos.push({ tipo: 'bateu' }); break; }
        }
        const ult = s.barreiras[s.barreiras.length - 1];
        const esp = F.espaco(s.n);
        if (ult.x <= W + 40 - esp) F.criarBarreira(s, ult.x + esp);
        if (s.barreiras.length && s.barreiras[0].x + LARG < -10) s.barreiras.shift();
      }
      return eventos;
    },
    pontos: s => s.passagens * 10 + s.centrados * 5
  };
  WowGames.BuracoFisica = F;
  if (typeof module !== 'undefined') module.exports = F;
  if (!WowGames.register || !WowGames.Arcade) return;

  const A = WowGames.Arcade, ID = 'buraco';
  const Perfil = WowGames.Perfil;
  if (Perfil) {
    Perfil.registrarJogo({ id: ID, nome: 'Passe pelo Buraco', icone: '🕳️', xp: ev => ev.tipo === 'fim' ? Math.min(40, 8 + Math.floor(ev.passagens / 2)) : 0,
      recordes: [{ id: 'pontos', rotulo: 'Passe pelo Buraco: maior pontuação', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.pontos : null, fmt: A.num },
                 { id: 'passagens', rotulo: 'Passe pelo Buraco: mais barreiras', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.passagens : null, fmt: v => v + ' barreiras' }] });
    Perfil.registrarConquista({ id: 'buracolivre', icone: '🕳️', nome: 'Passagem Livre', desc: 'Atravesse 25 barreiras numa partida do Passe pelo Buraco.', xp: 60,
      ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.passagens >= 25 });
    Perfil.registrarConquista({ id: 'buracoperfeito', icone: '🎯', nome: 'Desvio Perfeito', desc: 'Faça 700 pontos numa partida do Passe pelo Buraco.', xp: 120,
      ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.pontos >= 700 });
  }
  if (WowGames.Pontos) WowGames.Pontos.registrar(ID, { limite: 5, mostrarZero: ev => ev.tipo === 'fim', calcula: ev => ev.tipo === 'fim' ? Math.max(0, Math.round(ev.pontos * 1.5)) : 0 });

  WowGames.BuracoJogo = { atual: null };

  WowGames.register({
    id: ID, nome: 'Passe pelo Buraco', icone: '🕳️', cor: '#8ecbff',
    desc: 'Guie a bolinha pelas aberturas das barreiras. Elas ficam mais rápidas e mais estreitas.',

    mount(el) {
      const Q = A.quadro(el, { id: ID, nome: 'Passe pelo Buraco', icone: '🕳️', cor: '#8ecbff',
        stats: [{ id: 'passagens', rotulo: 'Barreiras' }, { id: 'pontos', rotulo: 'Pontos' }, { id: 'rec', rotulo: 'Recorde', inicial: '—' }],
        rodape: 'Mouse: mova sobre a área. Celular: toque e arraste. Teclado: ↑ ↓ ou W S. P pausa.' });
      const C = A.canvas(Q.palco, W, H), ctx = C.ctx;
      let S = F.novo(1), estado = 'inicio', efeitos = [], fimT = 0, ultimoAlvo = null;
      const teclas = { cima: false, baixo: false };
      const reduzido = A.movimentoReduzido();
      const loop = A.laco(dt => {
        if (estado === 'jogando') atualizar(dt);
        else if (estado === 'batida') { fimT += dt; efeitos = efeitos.filter(e => (e.t += dt) < e.dur); if (fimT > .6) mostrarResultado(); }
        desenhar();
      });
      const recTxt = () => { const r = A.recorde(ID, 'pontos'); return r === null ? null : A.num(r) + ' pontos'; };
      const atualizarRec = () => Q.stat('rec', A.recorde(ID, 'pontos') === null ? '—' : A.num(A.recorde(ID, 'pontos')));
      const dir = () => (teclas.baixo ? 1 : 0) - (teclas.cima ? 1 : 0);

      function telaInicio() {
        estado = 'inicio'; S = F.novo(1); desenhar(); atualizarRec();
        Q.inicio({ regras: ['Passe a bolinha pelas <b>aberturas</b> das barreiras.', 'Encostou na barreira, acabou.', 'Passar bem no meio da abertura vale pontos extras.'], recordeTxt: recTxt(), aoJogar: comecar });
      }
      function comecar() {
        S = F.novo((Date.now() ^ (Math.random() * 1e9)) >>> 0); S.alvo = ultimoAlvo; efeitos = []; fimT = 0;
        estado = 'jogando'; Q.esconder(); loop.iniciar(); Q.stat('passagens', '0'); Q.stat('pontos', '0');
      }
      function atualizar(dt) {
        S.dir = dir();
        const evs = F.passo(S, dt);
        efeitos = efeitos.filter(e => (e.t += dt) < e.dur);
        for (const e of evs) {
          if (e.tipo === 'passou' && efeitos.length < 6) efeitos.push({ tipo: 'texto', txt: e.centrado ? 'No meio! +15' : '+10', x: F.BX + 24, y: e.y - 18, t: 0, dur: .7, ouro: e.centrado });
          if (e.tipo === 'bateu') { estado = 'batida'; fimT = 0; efeitos.push({ tipo: 'batida', x: F.BX, y: S.y, t: 0, dur: .6 }); }
        }
        Q.stat('passagens', String(S.passagens)); Q.stat('pontos', A.num(F.pontos(S)));
      }
      function mostrarResultado() {
        estado = 'fim'; loop.parar(); desenhar();
        const pontos = F.pontos(S);
        const r = A.terminar(ID, { pontos, passagens: S.passagens, centrados: S.centrados, tempo: Math.round(S.t * 10) / 10 });
        atualizarRec();
        Q.resultado({ titulo: S.passagens >= 25 ? 'Que precisão!' : 'Bateu!', emoji: '🕳️', novoRecorde: r.novoRecorde, rp: r.rp, aoJogar: comecar,
          linhas: [['Barreiras', String(S.passagens)], ['No meio', String(S.centrados)], ['Pontos', A.num(pontos)], ['Recorde', A.recorde(ID, 'pontos') === null ? '—' : A.num(A.recorde(ID, 'pontos'))]] });
      }
      function pausar() {
        if (estado !== 'jogando') return;
        estado = 'pausa'; loop.parar(); teclas.cima = teclas.baixo = false; desenhar();
        Q.mostrar('<div class="arc-card"><h3>⏸ Pausado</h3><p class="arc-rec">A bolinha continua onde estava.</p><button class="btn big" data-arc="continuar">Continuar</button></div>', 'arc-pausa');
        const b = Q.camada.querySelector('[data-arc="continuar"]'); b.onclick = continuar; b.focus({ preventScroll: true });
      }
      function continuar() {
        if (estado !== 'pausa') return;
        S.alvo = null;                                                   // retoma sem "puxar" a bolinha para onde o mouse foi durante a pausa
        Q.esconder(); estado = 'jogando'; loop.iniciar();
      }

      /* ---------- Desenho ---------- */
      function desenhar() {
        ctx.fillStyle = '#14163a'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let x = (-(S.t * 40) % 40 + 40) % 40; x < W; x += 40) ctx.fillRect(x, 0, 1, H);
        for (const b of S.barreiras) {
          const topo = b.centro - b.gap / 2, base = b.centro + b.gap / 2;
          ctx.fillStyle = b.passou ? '#4b5aa8' : '#8ecbff';
          ctx.fillRect(b.x, 0, LARG, topo); ctx.fillRect(b.x, base, LARG, H - base);
          ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .9; ctx.fillRect(b.x - 4, topo - 8, LARG + 8, 8); ctx.fillRect(b.x - 4, base, LARG + 8, 8); ctx.globalAlpha = 1;
          if (b.flash > 0) { ctx.fillStyle = `rgba(126,224,163,${b.flash * 1.6})`; ctx.fillRect(b.x, topo, LARG, b.gap); }
        }
        const batendo = estado === 'batida' || (estado === 'fim' && S.fim);
        ctx.shadowColor = batendo ? '#ff6b6b' : '#ffe38a'; ctx.shadowBlur = reduzido ? 0 : 16;
        ctx.fillStyle = batendo ? '#ff6b6b' : '#ffe38a'; ctx.beginPath(); ctx.arc(F.BX, S.y, R, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        for (const e of efeitos) {
          const k = e.t / e.dur;
          if (e.tipo === 'texto') { ctx.globalAlpha = 1 - k; ctx.fillStyle = e.ouro ? '#ffd54a' : '#7ee0a3'; ctx.font = '900 16px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(e.txt, e.x, e.y - k * 20); ctx.globalAlpha = 1; }
          if (e.tipo === 'batida') { ctx.strokeStyle = `rgba(255,107,107,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, R + k * 40, 0, Math.PI * 2); ctx.stroke(); }
        }
        if (estado === 'jogando' && S.t < 3 && S.passagens === 0) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '800 16px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Mire na abertura →', W / 2, 30); }
      }
      C.aoAjustar = () => { if (!loop.ativo) desenhar(); };

      /* ---------- Entradas ---------- */
      const mirar = e => { const y = C.ponto(e).y; ultimoAlvo = y; if (estado === 'jogando') S.alvo = Math.max(R, Math.min(H - R, y)); };
      const aoBaixar = e => { if (e.pointerType !== 'mouse') e.preventDefault(); mirar(e); if (C.cv.setPointerCapture && e.pointerType !== 'mouse') try { C.cv.setPointerCapture(e.pointerId); } catch (x) {} };
      const aoMover = e => { if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) mirar(e); };
      C.cv.addEventListener('pointerdown', aoBaixar); C.cv.addEventListener('pointermove', aoMover);
      const MAPA = { ArrowUp: 'cima', w: 'cima', W: 'cima', ArrowDown: 'baixo', s: 'baixo', S: 'baixo' };
      const desce = e => {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (MAPA[e.key] && (estado === 'jogando' || estado === 'inicio')) { e.preventDefault(); teclas[MAPA[e.key]] = true; }
        else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && estado === 'jogando') pausar();
        else if ((e.key === 'p' || e.key === 'P') && estado === 'pausa') continuar();
      };
      const sobe = e => { if (MAPA[e.key]) teclas[MAPA[e.key]] = false; };
      const soltar = () => { teclas.cima = teclas.baixo = false; };
      document.addEventListener('keydown', desce); document.addEventListener('keyup', sobe); window.addEventListener('blur', soltar);
      const vis = () => { if (document.hidden) pausar(); };
      document.addEventListener('visibilitychange', vis);

      telaInicio();
      WowGames.BuracoJogo.atual = { estado: () => estado, sim: () => S, pausar, continuar, loopAtivo: () => loop.ativo, teclas };
      return () => {
        loop.parar(); C.destruir();
        C.cv.removeEventListener('pointerdown', aoBaixar); C.cv.removeEventListener('pointermove', aoMover);
        document.removeEventListener('keydown', desce); document.removeEventListener('keyup', sobe); window.removeEventListener('blur', soltar);
        document.removeEventListener('visibilitychange', vis);
        WowGames.BuracoJogo.atual = null;
      };
    }
  });
})();
