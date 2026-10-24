/* wow.world — ÁREAS COM PERSONAGEM (Praça dos Portais e Floresta dos Sussurros).
   Canvas 2D, mapa em grade, movimento por tempo decorrido (independe da taxa de quadros), colisão simples com quadrados sólidos.
   Teclado: setas ou WASD para andar, E para interagir. Os botões na tela fazem o mesmo (celular/tablet).
   O teclado só é capturado enquanto a área está aberta e o foco não está num campo de texto; nada é gravado a cada quadro. */
(function () {
  const MD = WowGames.MundoDados, E = WowGames.MundoEstado;
  const SOLIDOS = '#T~';
  const VEL = 3.6, RAIO = .3, ALCANCE = 1.35;

  function criar(cfg) {
    const AID = cfg.area, area = MD.AREAS[cfg.area], mapa = area.mapa.map(l => l.split('')), H = mapa.length, W = mapa[0].length;
    const canvas = cfg.canvas, ctx = canvas.getContext('2d');
    const objetos = [], deco = [];
    let ini = { x: 1.5, y: 1.5 };
    mapa.forEach((linha, y) => linha.forEach((c, x) => {
      if (c === 'S') { ini = { x: x + .5, y: y + .5 }; mapa[y][x] = AID === 'floresta' ? ',' : '.'; }
      const o = area.objetos[c];
      if (o) {
        const ja = objetos.find(k => k.id === o.id);                   // objetos de vários quadrados (torre, portão, cogumelos)
        if (ja) ja.quadros.push({ x, y }); else objetos.push(Object.assign({ quadros: [{ x, y }] }, o, { letra: c }));
      }
      if (area.decoracoes[c]) deco.push({ x, y, tipo: area.decoracoes[c] });
    }));
    objetos.forEach(o => { o.cx = o.quadros.reduce((s, q) => s + q.x, 0) / o.quadros.length + .5; o.cy = o.quadros.reduce((s, q) => s + q.y, 0) / o.quadros.length + .5; });
    const P = { x: ini.x, y: ini.y, dx: 0, dy: 1, andando: 0 };
    const tecla = { cima: false, baixo: false, esq: false, dir: false };
    let raf = 0, ult = 0, morto = false, perto = null, t = 0, ts = 32, fundo = null;

    const solido = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return true;
      const c = mapa[y][x];
      if (c === 'G') return !E.dados().marcos.portaoFloresta;           // o portão de raízes deixa passar depois de aberto
      return SOLIDOS.includes(c) || !!area.objetos[c];
    };
    function colide(px, py) {
      for (let y = Math.floor(py - RAIO); y <= Math.floor(py + RAIO); y++) for (let x = Math.floor(px - RAIO); x <= Math.floor(px + RAIO); x++) {
        if (!solido(x, y)) continue;
        const nx = Math.max(x, Math.min(px, x + 1)), ny = Math.max(y, Math.min(py, y + 1));
        if ((px - nx) ** 2 + (py - ny) ** 2 < RAIO * RAIO) return true;
      }
      return false;
    }

    /* ---------- Desenho ---------- */
    function medir() {
      const cssW = canvas.clientWidth || 640, dpr = Math.min(2, window.devicePixelRatio || 1);
      ts = cssW / W; canvas.style.height = Math.round(ts * H) + 'px';
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(ts * H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fundo = null;
    }
    function desenharFundo() {
      fundo = document.createElement('canvas'); fundo.width = canvas.width; fundo.height = canvas.height;
      const g = fundo.getContext('2d'), dpr = canvas.width / (ts * W); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = E.dados();
      mapa.forEach((l, y) => l.forEach((c, x) => {
        const X = x * ts, Y = y * ts;
        g.fillStyle = area.chao; g.fillRect(X, Y, ts + .5, ts + .5);
        if (AID === 'praca' && (x + y) % 2) { g.fillStyle = 'rgba(0,0,0,.035)'; g.fillRect(X, Y, ts, ts); }
        if (c === ',') { g.fillStyle = '#c9a86b'; g.beginPath(); g.roundRect ? g.roundRect(X + 1, Y + 1, ts - 2, ts - 2, ts * .35) : g.rect(X, Y, ts, ts); g.fill(); }
        if (c === '#') { g.fillStyle = '#3c8d52'; g.fillRect(X, Y, ts + .5, ts + .5); g.fillStyle = '#2f7343'; g.fillRect(X, Y + ts * .7, ts + .5, ts * .3); }
        if (c === '~') { g.fillStyle = AID === 'praca' ? '#7fd1ff' : '#4da3ff'; g.fillRect(X, Y, ts + .5, ts + .5); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X + ts * .2, Y + ts * .5); g.quadraticCurveTo(X + ts * .5, Y + ts * .3, X + ts * .8, Y + ts * .5); g.stroke(); }
        if (c === '=') { g.fillStyle = '#4da3ff'; g.fillRect(X, Y, ts, ts); g.fillStyle = '#a0703c'; g.fillRect(X, Y + ts * .15, ts, ts * .7); g.strokeStyle = '#6b4520'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(X + i * ts / 4, Y + ts * .15); g.lineTo(X + i * ts / 4, Y + ts * .85); g.stroke(); } }
        if (c === 'T') { g.fillStyle = '#6b4520'; g.fillRect(X + ts * .42, Y + ts * .55, ts * .16, ts * .4); g.fillStyle = (x * 7 + y * 3) % 3 ? '#2d7a46' : '#24663a'; g.beginPath(); g.arc(X + ts / 2, Y + ts * .42, ts * .46, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(X + ts * .38, Y + ts * .3, ts * .16, 0, 7); g.fill(); }
      }));
      // decorações que surgem com o progresso
      deco.forEach(d => {
        const X = d.x * ts, Y = d.y * ts;
        if (d.tipo === 'lanterna' && s.recompensas.m1) { g.fillStyle = '#5a4630'; g.fillRect(X + ts * .45, Y + ts * .3, ts * .1, ts * .65); g.fillStyle = '#ffd96b'; g.beginPath(); g.arc(X + ts / 2, Y + ts * .3, ts * .17, 0, 7); g.fill(); }
        if (d.tipo === 'flor' && s.segredos.raiz) ['#ff5d73', '#ffc933', '#b9a2ff'].forEach((cor, i) => { g.fillStyle = cor; g.beginPath(); g.arc(X + ts * (.25 + i * .25), Y + ts * (.55 + (i % 2) * .15), ts * .1, 0, 7); g.fill(); });
      });
      if (AID === 'praca' && s.recompensas.m3) {                    // bandeirolas
        g.strokeStyle = '#1c1840'; g.lineWidth = 1; g.beginPath(); g.moveTo(ts * 1, ts * 1.1); g.lineTo(ts * 19, ts * 1.1); g.stroke();
        for (let i = 1; i < 19; i++) { g.fillStyle = ['#ff5d73', '#ffc933', '#3ddc97', '#4da3ff'][i % 4]; g.beginPath(); g.moveTo(i * ts, ts * 1.1); g.lineTo(i * ts + ts * .5, ts * 1.1); g.lineTo(i * ts + ts * .25, ts * 1.5); g.fill(); }
      }
    }
    function desenharObjeto(o, brilho) {
      const s = E.dados(), X = o.cx * ts, Y = o.cy * ts, q = o.quadros;
      const minx = Math.min(...q.map(k => k.x)) * ts, miny = Math.min(...q.map(k => k.y)) * ts, larg = (Math.max(...q.map(k => k.x)) + 1) * ts - minx, alt = (Math.max(...q.map(k => k.y)) + 1) * ts - miny;
      ctx.save();
      if (brilho) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14 + Math.sin(t * 6) * 5; }
      switch (o.id) {
        case 'torre': {
          const nv = E.nivelTorre();
          ctx.fillStyle = '#b8a07a'; ctx.fillRect(minx + ts * .3, miny, larg - ts * .6, alt);
          ctx.fillStyle = '#8c7454'; for (let i = 0; i < 3; i++) ctx.fillRect(minx + ts * (.6 + i * 1.1), miny + ts * .3, ts * .4, ts * .6);
          ctx.fillStyle = '#5b4a8a'; ctx.beginPath(); ctx.moveTo(minx + ts * .1, miny + ts * .1); ctx.lineTo(minx + larg / 2, miny - ts * (1 + nv * .25)); ctx.lineTo(minx + larg - ts * .1, miny + ts * .1); ctx.fill();
          if (nv >= 5) { ctx.fillStyle = '#ffe14d'; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(minx + larg / 2, miny - ts * 2.3, ts * .3, 0, 7); ctx.fill(); }
          ctx.fillStyle = '#1c1840'; ctx.font = `900 ${ts * .45}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('Nível ' + nv, minx + larg / 2, miny + alt - ts * .25);
          break;
        }
        case 'sino': { const ouro = s.segredos.sino; ctx.fillStyle = '#6b4520'; ctx.fillRect(X - ts * .45, Y - ts * .5, ts * .9, ts * .12); ctx.fillStyle = ouro ? '#ffc933' : '#9a9aa8'; ctx.beginPath(); ctx.moveTo(X - ts * .3, Y + ts * .3); ctx.quadraticCurveTo(X - ts * .3, Y - ts * .4, X, Y - ts * .4); ctx.quadraticCurveTo(X + ts * .3, Y - ts * .4, X + ts * .3, Y + ts * .3); ctx.fill(); break; }
        case 'lume': case 'coruja': emoji(o.id === 'lume' ? '🧙‍♀️' : '🦉', X, Y, .85); break;
        case 'mural': ctx.fillStyle = '#8c5a2b'; ctx.fillRect(X - ts * .45, Y - ts * .4, ts * .9, ts * .7); ctx.fillStyle = '#fff3c4'; ctx.fillRect(X - ts * .35, Y - ts * .3, ts * .7, ts * .45); ctx.fillStyle = '#1c1840'; ctx.fillRect(X - ts * .25, Y - ts * .2, ts * .5, ts * .05); ctx.fillRect(X - ts * .25, Y - ts * .08, ts * .4, ts * .05); break;
        case 'portal': { ctx.lineWidth = ts * .14; const gr = ctx.createLinearGradient(X - ts / 2, Y, X + ts / 2, Y); gr.addColorStop(0, '#7b3fe4'); gr.addColorStop(1, '#4da3ff'); ctx.strokeStyle = gr; ctx.beginPath(); ctx.arc(X, Y, ts * (.36 + Math.sin(t * 3) * .03), 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(123,63,228,.25)'; ctx.fill(); break; }
        case 'placaPraca': ctx.fillStyle = '#6b4520'; ctx.fillRect(X - ts * .05, Y - ts * .1, ts * .1, ts * .5); ctx.fillStyle = '#c99a5b'; ctx.fillRect(X - ts * .38, Y - ts * .4, ts * .76, ts * .35); break;
        case 'pedra_sol': case 'pedra_lua': case 'pedra_estrela': {
          const ok = s.simbolos[o.simbolo]; ctx.fillStyle = '#8a8f9c'; ctx.beginPath(); ctx.ellipse(X, Y + ts * .05, ts * .4, ts * .36, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#a7acb8'; ctx.beginPath(); ctx.ellipse(X - ts * .08, Y - ts * .06, ts * .22, ts * .16, 0, 0, 7); ctx.fill();
          if (ok) { ctx.shadowColor = '#fff3a0'; ctx.shadowBlur = 12; emoji(MD.SIMBOLOS[o.simbolo].icone, X, Y, .45); } else { ctx.fillStyle = '#5d6270'; ctx.font = `900 ${ts * .35}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', X, Y + ts * .02); }
          break;
        }
        case 'portao': {
          const aberto = s.marcos.portaoFloresta; ctx.strokeStyle = '#6b4520'; ctx.lineWidth = ts * .14;
          if (aberto) { ctx.beginPath(); ctx.arc(X, Y + ts * .2, ts * .5, Math.PI, 0); ctx.stroke(); ctx.fillStyle = 'rgba(61,220,151,.35)'; ctx.fillRect(minx + ts * .1, miny, larg - ts * .2, alt); }
          else { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(X + i * ts * .18, miny); ctx.quadraticCurveTo(X + i * ts * .3, Y, X + i * ts * .18, miny + alt); ctx.stroke(); } ctx.fillStyle = '#ffe14d'; ['☀', '☾', '✦'].forEach((c, i) => { ctx.font = `900 ${ts * .22}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(c, X + (i - 1) * ts * .28, Y - ts * .25); }); }
          break;
        }
        case 'caderno': ctx.fillStyle = '#7a5130'; ctx.beginPath(); ctx.arc(X, Y + ts * .15, ts * .35, 0, 7); ctx.fill(); ctx.fillStyle = s.marcos.clareira ? '#9be15d' : '#3ddc97'; ctx.fillRect(X - ts * .22, Y - ts * .2, ts * .44, ts * .3); break;
        case 'cogumelos': o.quadros.forEach((k, i) => { const cx = (k.x + .5) * ts, cy = (k.y + .55) * ts; ctx.fillStyle = '#fff3e8'; ctx.fillRect(cx - ts * .07, cy, ts * .14, ts * .25); ctx.fillStyle = '#e2453c'; ctx.beginPath(); ctx.arc(cx, cy, ts * (.22 + (i % 2) * .05), Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - ts * .06, cy - ts * .1, ts * .04, 0, 7); ctx.fill(); });
          if (s.segredos.raiz) { ctx.strokeStyle = `rgba(255,225,77,${.6 + Math.sin(t * 4) * .3})`; ctx.lineWidth = ts * .08; ctx.beginPath(); ctx.moveTo(minx, miny + alt * .95); ctx.bezierCurveTo(minx + larg * .3, miny + alt * 1.3, minx + larg * .7, miny + alt * .6, minx + larg, miny + alt * .95); ctx.stroke(); }
          break;
        default: emoji('❔', X, Y, .6);
      }
      ctx.restore();
    }
    function emoji(ch, x, y, k) { ctx.font = `${ts * k}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x, y + ts * .03); }
    function desenhar() {
      if (!ts || Math.abs(canvas.clientWidth - ts * W) > 1) medir();
      if (!fundo) desenharFundo();
      ctx.clearRect(0, 0, ts * W, ts * H); ctx.drawImage(fundo, 0, 0, ts * W, ts * H);
      objetos.forEach(o => desenharObjeto(o, o === perto));
      // personagem
      const X = P.x * ts, Y = P.y * ts, pulo = P.andando ? Math.abs(Math.sin(t * 12)) * ts * .06 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(X, Y + ts * .3, ts * .26, ts * .1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff5d73'; ctx.strokeStyle = '#1c1840'; ctx.lineWidth = Math.max(1.5, ts * .06);
      ctx.beginPath(); ctx.arc(X, Y - pulo, ts * .3, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffc933'; ctx.beginPath(); ctx.moveTo(X - ts * .28, Y - ts * .12 - pulo); ctx.lineTo(X, Y - ts * .62 - pulo); ctx.lineTo(X + ts * .28, Y - ts * .12 - pulo); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1c1840'; [-1, 1].forEach(s => { ctx.beginPath(); ctx.arc(X + P.dx * ts * .1 + s * ts * .09, Y + P.dy * ts * .08 - pulo, ts * .045, 0, 7); ctx.fill(); });
      if (perto) {                                                       // aviso de interação
        const bx = perto.cx * ts, by = Math.min(...perto.quadros.map(k => k.y)) * ts - ts * .25;
        ctx.font = `800 ${Math.max(11, ts * .36)}px system-ui`; const txt = 'E · ' + perto.nome, w = ctx.measureText(txt).width + 12;
        const x0 = Math.max(2, Math.min(ts * W - w - 2, bx - w / 2));
        ctx.fillStyle = 'rgba(28,24,64,.88)'; ctx.fillRect(x0, by - ts * .5, w, ts * .5); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x0 + 6, by - ts * .25);
      }
    }

    /* ---------- Atualização ---------- */
    function passo(dt) {
      let mx = (tecla.dir ? 1 : 0) - (tecla.esq ? 1 : 0), my = (tecla.baixo ? 1 : 0) - (tecla.cima ? 1 : 0);
      const n = Math.hypot(mx, my); P.andando = n > 0;
      if (n) {
        mx /= n; my /= n; P.dx = mx; P.dy = my;
        const nx = P.x + mx * VEL * dt, ny = P.y + my * VEL * dt;
        if (!colide(nx, P.y)) P.x = nx;                                 // eixo por eixo: desliza encostado nas paredes
        if (!colide(P.x, ny)) P.y = ny;
      }
      let melhor = null, md = ALCANCE;
      objetos.forEach(o => { const d = Math.min(...o.quadros.map(q => Math.hypot(q.x + .5 - P.x, q.y + .5 - P.y))); if (d < md) { md = d; melhor = o; } });
      if (melhor !== perto) { perto = melhor; cfg.aoPerto && cfg.aoPerto(perto); }
    }
    function quadro(agora) {
      raf = 0; if (morto) return;
      const dt = ult ? Math.min(.05, (agora - ult) / 1000) : 0; ult = agora; t += dt;
      passo(dt); desenhar();
      raf = requestAnimationFrame(quadro);
    }
    const iniciar = () => { if (!raf && !morto) { ult = 0; raf = requestAnimationFrame(quadro); } };
    const parar = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

    /* ---------- Entrada ---------- */
    const MAPA_TECLAS = { ArrowUp: 'cima', KeyW: 'cima', ArrowDown: 'baixo', KeyS: 'baixo', ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir' };
    const digitando = e => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    function baixo(e) {
      if (morto || digitando(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const d = MAPA_TECLAS[e.code]; if (d) { tecla[d] = true; e.preventDefault(); return; }
      if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); interagir(); }
    }
    function cima(e) { const d = MAPA_TECLAS[e.code]; if (d) tecla[d] = false; }
    const soltarTudo = () => { Object.keys(tecla).forEach(k => { tecla[k] = false; }); };
    const vis = () => { if (document.hidden) { parar(); soltarTudo(); } else iniciar(); };
    const redim = () => { medir(); desenhar(); };
    document.addEventListener('keydown', baixo); document.addEventListener('keyup', cima);
    window.addEventListener('blur', soltarTudo); document.addEventListener('visibilitychange', vis); window.addEventListener('resize', redim);
    function interagir() { if (perto && cfg.aoInteragir) cfg.aoInteragir(perto); }

    medir(); iniciar();
    const api = {
      interagir, direcao(d, on) { if (d in tecla) tecla[d] = !!on; }, soltarTudo,
      atualizarFundo() { fundo = null; },
      posicao: () => ({ x: P.x, y: P.y }), perto: () => perto && perto.id, objetos: () => objetos.map(o => ({ id: o.id, x: o.cx, y: o.cy })),
      teleportar(x, y) { if (!colide(x, y)) { P.x = x; P.y = y; } },                // usado só pelos testes automáticos
      destruir() {
        morto = true; parar(); soltarTudo();
        document.removeEventListener('keydown', baixo); document.removeEventListener('keyup', cima);
        window.removeEventListener('blur', soltarTudo); document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', redim);
        if (WowGames.MundoAreas.atual === api) WowGames.MundoAreas.atual = null;
      }
    };
    WowGames.MundoAreas.atual = api;                                   // só para diagnóstico/testes no console
    return api;
  }
  WowGames.MundoAreas = { criar };
})();
