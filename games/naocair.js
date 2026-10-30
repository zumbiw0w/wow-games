/* Jogo: Não Deixe Cair (id 'naocair') — toque na hora certa para a bolinha continuar quicando.
   Regras: a bolinha só aceita o toque quando está na faixa de toque, logo acima da zona vermelha. Tocar cedo demais trava
   o toque por um instante (assim não dá para ficar tocando sem parar). A gravidade e o vento aumentam aos poucos.
   A física fica em WowGames.NaoCairFisica (pura, sem DOM) para poder ser testada. */
(function () {
  const W = 400, H = 600, R = 22, CHAO = H - 44, TOPO = 92, PASSO = 1 / 240;
  let G0 = 900, GK = 8, G1 = 1800, Z0 = 260, ZK = 1, Z1 = 150;          // dificuldade (ajustada com simulações)
  const F = {
    W, H, R, CHAO, TOPO,
    _ajustar(o) { ({ G0 = G0, GK = GK, G1 = G1, Z0 = Z0, ZK = ZK, Z1 = Z1 } = o); },
    gravidade: t => Math.min(G1, G0 + GK * t),                          // px/s² — sobe devagar
    zona: t => Math.max(Z1, Z0 - ZK * t),                                // altura da faixa de toque (px) — encolhe devagar
    ventoMax: t => Math.min(170, Math.max(0, (t - 12) * 2.6)),          // vento só começa depois de 12 s
    novo(semente = 1) {
      return { x: W / 2, y: 210, vx: 0, vy: 0, t: 0, vento: 0, proxVento: 9, trava: 0, quiques: 0, perfeitos: 0, fim: false, semente: semente >>> 0 || 1 };
    },
    rnd(s) { s.semente = (s.semente * 1664525 + 1013904223) >>> 0; return s.semente / 4294967296; },
    topoZona(s) { return CHAO - F.zona(s.t); },
    naZona(s) { return s.y >= F.topoZona(s) && s.y + R < CHAO; },
    passo(s, dt) {                                                       // avança a física em passos fixos (resultado igual em qualquer computador)
      let resto = dt;
      while (resto > 1e-9 && !s.fim) {
        const h = Math.min(PASSO, resto); resto -= h;
        s.t += h; s.trava = Math.max(0, s.trava - h);
        if (s.t >= s.proxVento) { const m = F.ventoMax(s.t); s.vento = (F.rnd(s) * 2 - 1) * m; s.proxVento = s.t + 6 + F.rnd(s) * 3; }
        s.vy += F.gravidade(s.t) * h;
        s.vx += s.vento * h; s.vx = Math.max(-260, Math.min(260, s.vx)) * (1 - .15 * h);
        s.x += s.vx * h; s.y += s.vy * h;
        if (s.x < R) { s.x = R; s.vx = Math.abs(s.vx) * .85; }
        if (s.x > W - R) { s.x = W - R; s.vx = -Math.abs(s.vx) * .85; }
        if (s.y < R) { s.y = R; s.vy = Math.abs(s.vy) * .3; }
        if (s.y + R >= CHAO) { s.y = CHAO - R; s.fim = true; }
      }
    },
    // toque: devolve 'quique', 'perfeito', 'cedo' (fora da faixa) ou 'travado'
    tocar(s, empurrao = 0) {
      if (s.fim) return null;
      if (s.trava > 0) return 'travado';
      if (!F.naZona(s)) { s.trava = .28; return 'cedo'; }
      const perfeito = s.y >= CHAO - R - F.zona(s.t) * .32;              // bem perto do chão = quique perfeito
      s.vy = -Math.sqrt(2 * F.gravidade(s.t) * Math.max(60, s.y - TOPO));  // sobe sempre até perto do topo
      s.vx = Math.max(-260, Math.min(260, s.vx * .6 + empurrao));
      s.quiques++; if (perfeito) s.perfeitos++;
      return perfeito ? 'perfeito' : 'quique';
    },
    pontos: s => Math.floor(s.t * 10) + s.quiques * 5 + s.perfeitos * 15
  };
  WowGames.NaoCairFisica = F;
  if (typeof module !== 'undefined') module.exports = F;
  if (!WowGames.register || !WowGames.Arcade) return;

  const A = WowGames.Arcade, ID = 'naocair';
  const seg = v => v.toFixed(1).replace('.', ',') + 's';
  const Perfil = WowGames.Perfil;
  if (Perfil) {
    Perfil.registrarJogo({ id: ID, nome: 'Não Deixe Cair', icone: '🏐', xp: ev => ev.tipo === 'fim' ? Math.min(40, 10 + Math.floor(ev.tempo / 4)) : 0,
      recordes: [{ id: 'pontos', rotulo: 'Não Deixe Cair: maior pontuação', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.pontos : null, fmt: A.num },
                 { id: 'tempo', rotulo: 'Não Deixe Cair: mais tempo no ar', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.tempo : null, fmt: seg }] });
    Perfil.registrarConquista({ id: 'naocairsobrevivente', icone: '🏐', nome: 'Sobrevivente', desc: 'Mantenha a bolinha no ar por 45 segundos no Não Deixe Cair.', xp: 60,
      ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.tempo >= 45 });
    Perfil.registrarConquista({ id: 'naocairreflexos', icone: '⚡', nome: 'Reflexos Rápidos', desc: 'Faça 1.200 pontos numa partida do Não Deixe Cair.', xp: 100,
      ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.pontos >= 1200 });
  }
  if (WowGames.Pontos) WowGames.Pontos.registrar(ID, { limite: 5, mostrarZero: ev => ev.tipo === 'fim', calcula: ev => ev.tipo === 'fim' ? Math.max(0, Math.round(ev.pontos)) : 0 });

  WowGames.NaoCairJogo = { atual: null };

  WowGames.register({
    id: ID, nome: 'Não Deixe Cair', icone: '🏐', cor: '#ffb86b',
    desc: 'Toque na hora certa e mantenha a bolinha quicando o máximo que conseguir.',

    mount(el) {
      const Q = A.quadro(el, { id: ID, nome: 'Não Deixe Cair', icone: '🏐', cor: '#ffb86b',
        stats: [{ id: 'tempo', rotulo: 'Tempo', inicial: '0,0s' }, { id: 'pontos', rotulo: 'Pontos' }, { id: 'rec', rotulo: 'Recorde', inicial: '—' }],
        rodape: 'Clique ou toque na tela. No teclado: Espaço (← e → empurram para os lados). P pausa.' });
      const C = A.canvas(Q.palco, W, H), ctx = C.ctx;
      let S = null, estado = 'inicio', efeitos = [], esmaga = 0, fimT = 0, ultimoToque = -1, dica = '';
      const reduzido = A.movimentoReduzido();
      const loop = A.laco(dt => { if (estado === 'jogando') atualizar(dt); else if (estado === 'caindo') { fimT += dt; if (fimT > .55) mostrarResultado(); } desenhar(dt); });

      const recTxt = () => { const r = A.recorde(ID, 'pontos'); return r === null ? null : A.num(r) + ' pontos'; };
      const atualizarRec = () => Q.stat('rec', A.recorde(ID, 'pontos') === null ? '—' : A.num(A.recorde(ID, 'pontos')));
      function telaInicio() {
        estado = 'inicio'; S = F.novo(Date.now()); desenhar(0); atualizarRec();
        Q.inicio({ regras: ['A bolinha só aceita o toque quando passa pela <b>faixa verde</b>.', 'Se ela encostar na <b>zona vermelha</b>, acabou.', 'Tocar cedo demais trava o toque por um instante. Quanto mais perto do vermelho, mais pontos.'],
          recordeTxt: recTxt(), aoJogar: comecar });
      }
      function comecar() {
        S = F.novo((Date.now() ^ (Math.random() * 1e9)) >>> 0); efeitos = []; esmaga = 0; fimT = 0; dica = 'Toque quando ela passar pela faixa verde';
        estado = 'jogando'; Q.esconder(); loop.iniciar();
        Q.stat('tempo', '0,0s'); Q.stat('pontos', '0');
      }
      function atualizar(dt) {
        F.passo(S, dt);
        esmaga = Math.max(0, esmaga - dt * 6);
        efeitos = efeitos.filter(e => (e.t += dt) < e.dur);
        Q.stat('tempo', seg(S.t)); Q.stat('pontos', A.num(F.pontos(S)));
        if (S.t > 4) dica = '';
        if (S.fim) { estado = 'caindo'; fimT = 0; esmaga = 1; }
      }
      function tocar(empurrao) {
        if (estado !== 'jogando') return;
        const r = F.tocar(S, empurrao);
        if (r === 'quique' || r === 'perfeito') {
          esmaga = 1;
          efeitos.push({ tipo: 'anel', x: S.x, y: S.y, t: 0, dur: reduzido ? .2 : .45, forte: r === 'perfeito' });
          if (r === 'perfeito') efeitos.push({ tipo: 'texto', txt: 'Perfeito! +15', x: S.x, y: S.y - 40, t: 0, dur: .8 });
        } else if (r === 'cedo') efeitos.push({ tipo: 'texto', txt: 'Cedo!', x: S.x, y: S.y - 40, t: 0, dur: .6, cor: '#c0392b' });
      }
      function mostrarResultado() {
        estado = 'fim'; loop.parar(); desenhar(0);
        const pontos = F.pontos(S), tempo = Math.round(S.t * 10) / 10;
        const r = A.terminar(ID, { pontos, tempo, quiques: S.quiques, perfeitos: S.perfeitos });
        atualizarRec();
        Q.resultado({ titulo: tempo >= 45 ? 'Que controle!' : tempo >= 20 ? 'Caiu!' : 'Caiu cedo!', emoji: '🏐', novoRecorde: r.novoRecorde, rp: r.rp, aoJogar: comecar,
          linhas: [['Tempo no ar', seg(tempo)], ['Quiques', String(S.quiques)], ['Perfeitos', String(S.perfeitos)], ['Pontos', A.num(pontos)], ['Recorde', A.recorde(ID, 'pontos') === null ? '—' : A.num(A.recorde(ID, 'pontos'))]] });
      }
      function pausar() {
        if (estado !== 'jogando') return;
        estado = 'pausa'; loop.parar(); desenhar(0);
        Q.mostrar('<div class="arc-card"><h3>⏸ Pausado</h3><button class="btn big" data-arc="continuar">Continuar</button></div>', 'arc-pausa');
        const b = Q.camada.querySelector('[data-arc="continuar"]'); b.onclick = continuar; b.focus({ preventScroll: true });
      }
      function continuar() { if (estado !== 'pausa') return; Q.esconder(); estado = 'jogando'; loop.iniciar(); }

      /* ---------- Desenho ---------- */
      function desenhar() {
        ctx.clearRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff4e2'); g.addColorStop(1, '#ffe1bf');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const zt = F.topoZona(S);
        ctx.fillStyle = 'rgba(46,204,113,.16)'; ctx.fillRect(0, zt, W, CHAO - zt);
        ctx.strokeStyle = 'rgba(39,174,96,.55)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, zt); ctx.lineTo(W, zt); ctx.stroke(); ctx.setLineDash([]);
        // zona vermelha (mais forte quando a bolinha está perto)
        const perto = Math.max(0, Math.min(1, (S.y - zt) / (CHAO - zt)));
        ctx.fillStyle = `rgba(231,76,60,${.55 + .4 * perto})`; ctx.fillRect(0, CHAO, W, H - CHAO);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let x = -40; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 14, CHAO); ctx.lineTo(x + 28, CHAO); ctx.lineTo(x + 14, H); ctx.fill(); }
        if (S.vento && estado === 'jogando') {                            // seta do vento
          const f = S.vento / 170; ctx.fillStyle = 'rgba(28,24,64,.35)'; ctx.font = '700 15px system-ui,sans-serif'; ctx.textAlign = 'center';
          ctx.fillText((f < 0 ? '← ' : '') + 'vento' + (f > 0 ? ' →' : ''), W / 2, 30);
        }
        // sombra
        const sh = 1 - Math.min(1, (CHAO - S.y) / CHAO);
        ctx.fillStyle = `rgba(28,24,64,${.08 + .18 * sh})`; ctx.beginPath(); ctx.ellipse(S.x, CHAO - 4, R * (.6 + .6 * sh), 5, 0, 0, Math.PI * 2); ctx.fill();
        // bolinha (achata um pouco no toque e na queda)
        const sx = 1 + .22 * esmaga, sy = 1 - .22 * esmaga;
        ctx.save(); ctx.translate(S.x, S.y); ctx.scale(sx, sy);
        const bg = ctx.createRadialGradient(-7, -8, 3, 0, 0, R); bg.addColorStop(0, '#fff'); bg.addColorStop(.35, '#ffb86b'); bg.addColorStop(1, '#e8743b');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#1c1840'; ctx.stroke();
        ctx.restore();
        for (const e of efeitos) {
          const k = e.t / e.dur;
          if (e.tipo === 'anel') { ctx.strokeStyle = e.forte ? `rgba(241,196,15,${1 - k})` : `rgba(28,24,64,${.5 * (1 - k)})`; ctx.lineWidth = e.forte ? 4 : 2; ctx.beginPath(); ctx.arc(e.x, e.y, R + k * (e.forte ? 34 : 22), 0, Math.PI * 2); ctx.stroke(); }
          if (e.tipo === 'texto') { ctx.fillStyle = e.cor || '#1c1840'; ctx.globalAlpha = 1 - k; ctx.font = '900 18px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.txt, e.x, e.y - k * 24); ctx.globalAlpha = 1; }
        }
        if (S.trava > 0 && estado === 'jogando') { ctx.fillStyle = 'rgba(192,57,43,.8)'; ctx.font = '800 13px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('aguarde…', S.x, S.y + R + 18); }
        if (dica) { ctx.fillStyle = 'rgba(28,24,64,.7)'; ctx.font = '800 15px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(dica, W / 2, zt - 12); }
      }
      C.aoAjustar = () => { if (!loop.ativo) desenhar(0); };

      /* ---------- Entradas ---------- */
      const aoApontar = e => {
        if (estado !== 'jogando') return;
        e.preventDefault();                                              // um toque = um pointerdown (sem clique duplicado)
        const p = C.ponto(e);
        tocar(Math.max(-170, Math.min(170, (S.x - p.x) * 2.4)));
      };
      C.cv.addEventListener('pointerdown', aoApontar);
      const tecla = e => {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (estado === 'jogando') {
          if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'w' || e.key === 'W') {
            e.preventDefault(); if (e.repeat) return;
            tocar(e.key === 'ArrowLeft' ? -150 : e.key === 'ArrowRight' ? 150 : 0);
          } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') pausar();
        } else if (estado === 'pausa' && (e.key === 'p' || e.key === 'P')) continuar();
      };
      document.addEventListener('keydown', tecla);
      const vis = () => { if (document.hidden) pausar(); };
      document.addEventListener('visibilitychange', vis);

      telaInicio();
      WowGames.NaoCairJogo.atual = { estado: () => estado, sim: () => S, tocar, pausar, continuar, loopAtivo: () => loop.ativo };
      return () => {
        loop.parar(); C.destruir(); C.cv.removeEventListener('pointerdown', aoApontar);
        document.removeEventListener('keydown', tecla); document.removeEventListener('visibilitychange', vis);
        WowGames.NaoCairJogo.atual = null;
      };
    }
  });
})();
