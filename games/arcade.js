/* wow.games: BASE dos minijogos arcade (Não Deixe Cair, Repita a Sequência, Passe pelo Buraco e Torre Instável).
   Só ajuda a montar a tela e reaproveita os sistemas que já existem:
     - recordes pessoais: os do perfil (WowGames.Perfil.dados().recordes), atualizados pelo próprio WowGames.evento;
     - XP, conquistas e pontuação: WowGames.evento, uma vez por partida terminada (recarregar a página não reenvia nada).
   Não guarda moedas, não cria economia nova e não entra no placar global. Prefixo de CSS: .arc- */
(function () {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => Math.round(v).toLocaleString('pt-BR');

  // Recorde pessoal salvo no perfil (chave "idDoJogo:idDoRecorde"), ou null.
  function recorde(jogo, id) {
    try { const r = WowGames.Perfil && WowGames.Perfil.dados().recordes[jogo + ':' + id]; return r && typeof r.valor === 'number' ? r.valor : null; } catch (e) { return null; }
  }

  // Ciclo de animação único: no máximo um requestAnimationFrame ativo, passo de tempo limitado e pausa com a aba escondida.
  function laco(passo, { maxDt = 1 / 30 } = {}) {
    let raf = 0, ult = 0, ligado = false;
    const quadro = t => {
      raf = 0; if (!ligado) return;
      const dt = ult ? Math.min(maxDt, Math.max(0, (t - ult) / 1000)) : 0; ult = t;
      passo(dt);
      if (ligado) raf = requestAnimationFrame(quadro);
    };
    return {
      iniciar() { if (ligado) return; ligado = true; ult = 0; raf = requestAnimationFrame(quadro); },
      parar() { ligado = false; if (raf) cancelAnimationFrame(raf); raf = 0; ult = 0; },
      get ativo() { return ligado; }
    };
  }

  // Canvas com tamanho lógico fixo (w × h) que se ajusta à largura disponível e à densidade da tela.
  function canvas(box, w, h) {
    const cv = document.createElement('canvas');
    cv.className = 'arc-canvas'; cv.width = w; cv.height = h; cv.style.aspectRatio = w + ' / ' + h;
    box.prepend(cv);
    const ctx = cv.getContext('2d');
    let escala = 1;
    function ajustar() {
      const larg = cv.clientWidth || w, dpr = Math.min(2, window.devicePixelRatio || 1);
      escala = larg / w;
      const pw = Math.round(w * escala * dpr), ph = Math.round(h * escala * dpr);
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      ctx.setTransform(escala * dpr, 0, 0, escala * dpr, 0, 0);
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { ajustar(); if (api.aoAjustar) api.aoAjustar(); }) : null;
    if (ro) ro.observe(cv);
    // converte coordenadas da tela para as coordenadas lógicas do jogo
    const ponto = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * w, y: (e.clientY - r.top) / r.height * h }; };
    const api = { cv, ctx, w, h, ajustar, ponto, aoAjustar: null, destruir() { if (ro) ro.disconnect(); } };
    ajustar();
    return api;
  }

  // Estrutura comum: cabeçalho com placar ao vivo, palco e camada de telas (início, pausa e resultado).
  function quadro(el, cfg) {
    el.innerHTML = `
      <div class="arc arc-${cfg.id}" style="--arc-cor:${cfg.cor}">
        <div class="arc-topo">${cfg.stats.map(s => `<div class="arc-stat"><small>${esc(s.rotulo)}</small><b data-stat="${s.id}">${esc(s.inicial ?? '0')}</b></div>`).join('')}
          ${cfg.extraTopo || ''}</div>
        <div class="arc-palco" data-palco>${cfg.palco || ''}<div class="arc-camada" data-camada hidden></div></div>
        ${cfg.rodape ? `<p class="arc-rodape">${cfg.rodape}</p>` : ''}
      </div>`;
    const raiz = el.querySelector('.arc'), palco = el.querySelector('[data-palco]'), camada = el.querySelector('[data-camada]');
    const stat = (id, v) => { const n = el.querySelector(`[data-stat="${id}"]`); if (n && n.textContent !== String(v)) n.textContent = v; };
    function mostrar(html, classe) { camada.className = 'arc-camada' + (classe ? ' ' + classe : ''); camada.innerHTML = html; camada.hidden = false; }
    function esconder() { camada.hidden = true; camada.innerHTML = ''; }
    function inicio({ regras, recordeTxt, botao = 'Jogar', aoJogar }) {
      mostrar(`<div class="arc-card">
          <div class="arc-ico">${cfg.icone}</div><h3>${esc(cfg.nome)}</h3>
          <ul class="arc-regras">${regras.map(r => `<li>${r}</li>`).join('')}</ul>
          <p class="arc-rec">${recordeTxt ? '🏅 Seu recorde: <b>' + esc(recordeTxt) + '</b>' : 'Primeira vez? Boa sorte!'}</p>
          <button class="btn big" data-arc="jogar">${esc(botao)}</button>
        </div>`, 'arc-inicio');
      const b = camada.querySelector('[data-arc="jogar"]'); b.onclick = aoJogar; b.focus({ preventScroll: true });
    }
    function resultado({ titulo, emoji, linhas, novoRecorde, rp, aoJogar }) {
      mostrar(`<div class="arc-card arc-fim">
          <div class="arc-ico">${emoji || cfg.icone}</div><h3>${esc(titulo)}</h3>
          ${novoRecorde ? '<p class="arc-novo">🏅 Novo recorde!</p>' : ''}
          <div class="arc-linhas">${linhas.map(([r, v]) => `<div><small>${esc(r)}</small><b>${esc(v)}</b></div>`).join('')}</div>
          ${rp && WowGames.Pontos ? WowGames.Pontos.html(rp) : ''}
          <div class="arc-bts"><button class="btn big" data-arc="denovo">Jogar novamente</button><a class="btn arc-sec" href="#/">Voltar ao início</a></div>
          <p class="arc-dica">Dica: Enter ou Espaço também começa de novo.</p>
        </div>`, 'arc-resultado');
      const b = camada.querySelector('[data-arc="denovo"]'); b.onclick = aoJogar;
      // espera um instante para o mesmo toque/tecla que encerrou a partida não reiniciar sem querer
      b.disabled = true; setTimeout(() => { if (b.isConnected) { b.disabled = false; b.focus({ preventScroll: true }); } }, 450);
    }
    return { raiz, palco, camada, stat, mostrar, esconder, inicio, resultado, visivel: () => !camada.hidden };
  }

  // Envia o fim da partida pelo sistema global e diz se o recorde de "pontos" foi superado.
  function terminar(jogo, dados) {
    const antes = recorde(jogo, 'pontos');
    let rp = null;
    try { rp = WowGames.evento(Object.assign({ jogo, tipo: 'fim', partida: true }, dados)); } catch (e) { console.error('[wow.games] Erro ao registrar a partida de ' + jogo + ':', e); }
    return { rp, novoRecorde: dados.pontos > 0 && (antes === null || dados.pontos > antes), recordeAntes: antes };
  }

  // Sons curtos opcionais (Web Audio), criados só depois de uma interação.
  function sons() {
    let ctx = null;
    return {
      tocar(freq, dur = .18, { tipo = 'sine', ganho = .12, quando = 0 } = {}) {
        try {
          ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
          if (ctx.state === 'suspended') ctx.resume();
          const t = ctx.currentTime + quando, o = ctx.createOscillator(), g = ctx.createGain();
          o.type = tipo; o.frequency.value = freq;
          g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(ganho, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
          o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + .05);
        } catch (e) {}
      },
      fechar() { if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; } },
      criado: () => !!ctx
    };
  }

  const movimentoReduzido = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  WowGames.Arcade = { recorde, laco, canvas, quadro, terminar, sons, num, esc, movimentoReduzido };
})();
