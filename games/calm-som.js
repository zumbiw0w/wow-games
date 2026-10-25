/* wow.calm — SONS SINTETIZADOS (Web Audio). Nada aqui é gravação: chuva, lareira, páginas, toques e música
   são gerados no navegador com ruído filtrado e osciladores. Não imitam nem substituem gravações reais de ASMR.
   - O contexto de áudio só é criado depois de um clique/toque do jogador (iniciar()).
   - Quatro controles: geral (mudo), ambiente, efeitos e música. O jogo funciona igual sem som.
   - pausar() quando a aba fica escondida; parar() ao sair do jogo (fecha o contexto e limpa os timers). */
(function () {
  let ctx = null, bus = null, ruidoBuf = null, marromBuf = null;
  let vol = { mudo: true, ambiente: .6, efeitos: .6, musica: .5 };
  const loops = {};                   // som ambiente contínuo ativo: id → { parar() }
  let desejados = [];                 // ambientes pedidos pelo jogo
  let musicaLigada = false, musicaTimer = 0, texturaTimer = 0, texturas = [];
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function criar() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    const g = n => { const x = ctx.createGain(); x.gain.value = n; return x; };
    bus = { master: g(0), ambiente: g(vol.ambiente), efeitos: g(vol.efeitos), musica: g(vol.musica) };
    bus.master.connect(ctx.destination);
    ['ambiente', 'efeitos', 'musica'].forEach(k => bus[k].connect(bus.master));
    // ruído branco e "marrom" (mais grave) em buffers de 2 s, tocados em loop
    const n = ctx.sampleRate * 2;
    ruidoBuf = ctx.createBuffer(1, n, ctx.sampleRate); marromBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const a = ruidoBuf.getChannelData(0), b = marromBuf.getChannelData(0); let ult = 0;
    for (let i = 0; i < n; i++) { a[i] = Math.random() * 2 - 1; ult = (ult + .02 * (Math.random() * 2 - 1)) / 1.02; b[i] = ult * 3.5; }
    aplicarVolumes();
    return true;
  }
  function aplicarVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    bus.master.gain.setTargetAtTime(vol.mudo ? 0 : .9, t, .08);
    ['ambiente', 'efeitos', 'musica'].forEach(k => bus[k].gain.setTargetAtTime(vol[k], t, .08));
  }
  const ativo = () => ctx && !vol.mudo && ctx.state === 'running';

  /* ---------- Fontes básicas ---------- */
  function fonteRuido(buf, destino, filtros, ganho) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const g = ctx.createGain(); g.gain.value = 0;
    let no = s; filtros.forEach(f => { const bq = ctx.createBiquadFilter(); bq.type = f[0]; bq.frequency.value = f[1]; if (f[2]) bq.Q.value = f[2]; no.connect(bq); no = bq; });
    no.connect(g); g.connect(destino); s.start(0, Math.random() * 1.9);
    g.gain.setTargetAtTime(ganho, ctx.currentTime, .8);           // entra devagar
    return { g, parar() { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, .4); try { s.stop(t + 2); } catch (e) {} } };
  }
  function tom(freq, dur, { tipo = 'sine', ganho = .15, destino = bus.efeitos, ataque = .005, quando = 0, glide = 0 } = {}) {
    const t = ctx.currentTime + quando, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(freq, t); if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(ganho, t + ataque); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(destino); o.start(t); o.stop(t + dur + .05);
  }
  function rajada(dur, { freq = 2000, q = 1, tipo = 'bandpass', ganho = .2, destino = bus.efeitos, quando = 0, ate = 0, buf = ruidoBuf } = {}) {
    const t = ctx.currentTime + quando, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = tipo; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (ate) f.frequency.exponentialRampToValueAtTime(ate, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(ganho, t + Math.min(.03, dur / 4)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(destino); s.start(t, Math.random()); s.stop(t + dur + .05);
  }

  /* ---------- Ambientes contínuos ---------- */
  const AMBIENTES = {
    chuva: () => gotejar(fonteRuido(ruidoBuf, bus.ambiente, [['lowpass', 1400], ['highpass', 300]], .11), 420, .02),
    chuvaforte: () => gotejar(fonteRuido(ruidoBuf, bus.ambiente, [['lowpass', 2600], ['highpass', 180]], .2), 160, .03),
    ruido: () => fonteRuido(marromBuf, bus.ambiente, [['lowpass', 380]], .07),
    lareira: () => {
      const base = fonteRuido(marromBuf, bus.ambiente, [['lowpass', 520]], .1);
      let vivo = true;
      const estalo = () => { if (!vivo) return; if (ativo()) { const n = Math.random() < .3 ? 3 : 1; for (let i = 0; i < n; i++) rajada(rnd(.015, .05), { freq: rnd(1500, 4500), q: 3, tipo: 'highpass', ganho: rnd(.05, .18), destino: bus.ambiente, quando: i * rnd(.02, .07) }); }
        later(estalo, rnd(120, 900)); };
      estalo();
      return { parar() { vivo = false; base.parar(); } };
    }
  };
  function gotejar(base, intervalo, ganho) {             // gotas leves por cima do ruído da chuva
    let vivo = true;
    const gota = () => { if (!vivo) return; if (ativo()) tom(rnd(1600, 3400), rnd(.04, .09), { ganho: rnd(ganho * .4, ganho), destino: bus.ambiente, glide: .6 }); later(gota, rnd(intervalo * .3, intervalo * 1.6)); };
    gota();
    return { parar() { vivo = false; base.parar(); } };
  }
  function sincronizarAmbientes() {
    if (!ctx) return;
    const querer = vol.mudo || ctx.state !== 'running' ? [] : desejados;
    Object.keys(loops).forEach(id => { if (!querer.includes(id)) { loops[id].parar(); delete loops[id]; } });
    querer.forEach(id => { if (!loops[id] && AMBIENTES[id]) loops[id] = AMBIENTES[id](); });
  }

  /* ---------- Texturas ocasionais (páginas, toques suaves) ---------- */
  function agendarTexturas() {
    clearTimeout(texturaTimer); timers.delete(texturaTimer);
    if (!texturas.length) return;
    texturaTimer = later(() => { if (ativo()) efeito(texturas[Math.floor(Math.random() * texturas.length)], true); agendarTexturas(); }, rnd(7000, 15000));
  }

  /* ---------- Música generativa (pentatônica, bem lenta) ---------- */
  const ESCALA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
  const ACORDES = [[0, 2, 4], [1, 3, 5], [2, 4, 6], [0, 3, 5], [1, 4, 7]];
  let passo = 0;
  function tocarMusica() {
    clearTimeout(musicaTimer); timers.delete(musicaTimer);
    if (!musicaLigada) return;
    if (ativo()) {
      const ac = ACORDES[(passo++ * 3 + Math.floor(Math.random() * 2)) % ACORDES.length];
      ac.forEach((i, k) => tom(ESCALA[i] / 2, 5.5, { tipo: 'triangle', ganho: .045, destino: bus.musica, ataque: 1.6, quando: k * .05 }));
      for (let k = 0; k < 3; k++) if (Math.random() < .7) tom(ESCALA[ac[Math.floor(Math.random() * 3)]] * (Math.random() < .5 ? 1 : 2), 1.8, { ganho: .035, destino: bus.musica, ataque: .02, quando: 1 + k * rnd(.9, 1.4) });
    }
    musicaTimer = later(tocarMusica, 4800);
  }

  /* ---------- Efeitos ---------- */
  const PLIM = [523.25, 587.33, 659.25, 783.99, 880];
  function efeito(nome, textura) {
    if (!ativo()) return;
    const destino = textura ? bus.ambiente : bus.efeitos;
    switch (nome) {
      case 'clique': tom(PLIM[Math.floor(Math.random() * PLIM.length)], .35, { ganho: .07, destino }); break;
      case 'compra': tom(659.25, .5, { ganho: .08 }); tom(987.77, .7, { ganho: .06, quando: .09 }); break;
      case 'etapa': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tom(f, 1.2, { ganho: .07, quando: i * .14, tipo: 'triangle' })); break;
      case 'final': [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tom(f, 2.2, { ganho: .07, quando: i * .22, tipo: 'triangle', ataque: .05 })); break;
      case 'despejar': rajada(1.3, { freq: 500, ate: 1800, q: 4, ganho: .12, destino }); rajada(1.1, { freq: 900, ate: 2600, q: 8, ganho: .05, destino, quando: .15 }); break;
      case 'paginas': rajada(.22, { freq: 2600, ate: 4200, q: .8, ganho: .09, destino }); rajada(.18, { freq: 3000, q: .8, ganho: .06, destino, quando: .32 }); break;
      case 'asmr': for (let i = 0; i < 3; i++) { const q = i * rnd(.16, .3); tom(rnd(380, 760), .09, { tipo: 'triangle', ganho: .06, destino, quando: q }); rajada(.03, { freq: 3800, q: 2, ganho: .04, destino, quando: q }); } break;
      case 'cozinhar': rajada(1.6, { freq: 3200, q: .6, tipo: 'highpass', ganho: .045, destino }); for (let i = 0; i < 4; i++) tom(rnd(140, 220), .12, { ganho: .05, destino, quando: .2 + i * .3 }); break;
      case 'comer': for (let i = 0; i < 2; i++) rajada(.12, { freq: 900, q: 1.5, ganho: .05, destino, quando: i * .18 }); break;
    }
  }

  WowGames.CalmSom = {
    sintetizado: true,
    disponivel: () => !!(window.AudioContext || window.webkitAudioContext),
    iniciar() {                                   // chamar SOMENTE dentro de um clique/toque
      if (!criar()) return false;
      if (ctx.state === 'suspended') ctx.resume().then(() => { sincronizarAmbientes(); }).catch(() => {});
      aplicarVolumes(); sincronizarAmbientes(); return true;
    },
    iniciado: () => !!ctx,
    volumes(v) { vol = Object.assign({}, vol, v); aplicarVolumes(); sincronizarAmbientes(); },
    ambientes(lista) { desejados = (lista || []).filter(id => AMBIENTES[id]); sincronizarAmbientes(); },
    texturas(lista) { const nova = (lista || []).join(); if (nova !== texturas.join()) { texturas = lista || []; agendarTexturas(); } },
    musica(on) { on = !!on; if (on === musicaLigada) return; musicaLigada = on; tocarMusica(); },
    efeito,
    ativos: () => Object.keys(loops),
    estado: () => ctx ? ctx.state : 'sem-contexto',
    pausar() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    retomar() { if (ctx && ctx.state === 'suspended') ctx.resume().then(sincronizarAmbientes).catch(() => {}); },
    parar() {
      timers.forEach(clearTimeout); timers.clear();
      Object.keys(loops).forEach(id => { try { loops[id].parar(); } catch (e) {} delete loops[id]; });
      musicaLigada = false; texturas = []; desejados = [];
      if (ctx) { try { ctx.close(); } catch (e) {} }
      ctx = null; bus = null;
    }
  };
})();
