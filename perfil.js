/* wow.games: sistema central do jogador (perfil, XP, níveis, conquistas e desafio do dia).
   Os jogos só precisam avisar o que aconteceu:   WowGames.evento({ jogo:'id', tipo:'fim', partida:true, ... })
   O conteúdo (conquistas, desafios, recordes e XP de cada jogo) é registrado em conquistas.js ou no próprio jogo:
     WowGames.Perfil.registrarJogo({ id, nome, xp: ev => número, recordes: [{ id, rotulo, melhor:'menor'|'maior', valor: ev => número|null, fmt }] })
     WowGames.Perfil.registrarConquista({ id, icone, nome, desc, ok: (ev, P) => bool })           // ou { alvo, prog: P => número } para conquistas com contagem
     WowGames.Perfil.registrarDesafio({ id, jogo, texto, ok: ev => bool })                         // ou { alvo, conta: ev => número }
   Todo o armazenamento passa por "armazem": para ter banco de dados/ranking online, troque só ler() e gravar(). */
(function () {
  const KEY = 'wowgames.perfil.v1';
  const DESAFIO_XP = 100;
  const AVATARES = ['🦊', '🐼', '🐸', '🦄', '🐙', '🦁', '🐯', '🐧', '🦉', '🐲', '🤖', '👾'];

  const armazem = {
    ler() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { console.error('[wow.games] Não foi possível ler o perfil do localStorage:', e); return {}; } },
    gravar(P) { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { console.error('[wow.games] Não foi possível gravar o perfil no localStorage:', e); } }
  };
  const base = () => ({ nome: 'Jogador', avatar: '🦊', xp: 0, partidas: 0, jogos: {}, conquistas: {}, recordes: {}, desafiosConcluidos: 0, recuperacao: null, diario: { dia: '', concluido: false, progresso: 0 } });
  function carregar() {
    const b = base(), s = armazem.ler();
    return Object.assign(b, s, { jogos: s.jogos || {}, conquistas: s.conquistas || {}, recordes: s.recordes || {}, diario: Object.assign(b.diario, s.diario || {}) });
  }

  const JOGOS = [], CONQ = [], DESAFIOS = [];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Níveis: o nível n começa em 50*n*(n-1) XP (100, 300, 600, 1000...) ---------- */
  const xpDoNivel = n => 50 * n * (n - 1);
  const nivelDe = xp => { let n = 1; while (xp >= xpDoNivel(n + 1)) n++; return n; };
  function resumoXP(xp) {
    const n = nivelDe(xp), a = xpDoNivel(n), b = xpDoNivel(n + 1);
    return { nivel: n, atual: xp - a, total: b - a, pct: Math.round((xp - a) / (b - a) * 100) };
  }

  /* ---------- Data e desafio do dia ---------- */
  const Perfil = {};
  Perfil.hoje = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  function desafioDoDia(dia) {
    const [y, m, d] = dia.split('-').map(Number);
    return DESAFIOS[Math.floor(Date.UTC(y, m - 1, d) / 86400000) % DESAFIOS.length];
  }
  function garantirDia(P) {
    const h = Perfil.hoje();
    if (P.diario.dia !== h) { P.diario = { dia: h, concluido: false, progresso: 0 }; return true; }
    return false;
  }

  /* ---------- Avisos na tela ---------- */
  function toast(html, tipo) {
    try {
      let c = document.getElementById('wg-toasts');
      if (!c) { c = document.createElement('div'); c.id = 'wg-toasts'; c.className = 'wg-toasts'; document.body.appendChild(c); }
      const t = document.createElement('div');
      t.className = 'wg-toast ' + (tipo || ''); t.innerHTML = html; c.appendChild(t);
      setTimeout(() => { t.classList.add('sai'); setTimeout(() => t.remove(), 400); }, 4200);
    } catch (e) {}
  }
  function darXP(P, n) {
    if (!n) return;
    const antes = nivelDe(P.xp); P.xp += n;
    const depois = nivelDe(P.xp);
    if (depois > antes) toast(`⬆️ <b>NÍVEL ${depois}!</b><small>Você subiu de nível</small>`, 'nivel');
  }

  /* ---------- Evento: ponto único de entrada dos jogos ---------- */
  function evento(ev) {
    if (!ev || !ev.jogo) return;
    Perfil.eventosRecebidos = (Perfil.eventosRecebidos || 0) + 1; Perfil.ultimoEvento = ev;   // usados só pelo diagnóstico
    if (!JOGOS.length || !CONQ.length) console.warn('[wow.games] Evento recebido, mas há ' + JOGOS.length + ' jogos e ' + CONQ.length + ' conquistas registrados. conquistas.js foi carregado?');
    try {
      const P = carregar();
      garantirDia(P);
      const def = JOGOS.find(j => j.id === ev.jogo);
      let xp = def && def.xp ? (def.xp(ev) || 0) : 0;
      if (ev.partida) { P.partidas++; P.jogos[ev.jogo] = (P.jogos[ev.jogo] || 0) + 1; }

      for (const r of (def && def.recordes) || []) {                      // recordes pessoais
        const v = r.valor(ev);
        if (typeof v !== 'number' || !isFinite(v)) continue;
        const k = def.id + ':' + r.id, atual = P.recordes[k];
        if (!atual || (r.melhor === 'menor' ? v < atual.valor : v > atual.valor)) P.recordes[k] = { valor: v };
      }

      const d = desafioDoDia(P.diario.dia);                                // desafio do dia
      if (d && !P.diario.concluido && d.jogo === ev.jogo) {
        let feito;
        if (d.conta) { P.diario.progresso += d.conta(ev) || 0; feito = P.diario.progresso >= d.alvo; } else feito = !!d.ok(ev);
        if (feito) {
          P.diario.concluido = true; P.desafiosConcluidos++; xp += DESAFIO_XP;
          toast(`🔥 <b>DESAFIO DO DIA CONCLUÍDO!</b><small>“${esc(d.texto)}” +${DESAFIO_XP} XP</small>`, 'dia');
        }
      }

      for (const c of CONQ) {                                              // conquistas
        if (P.conquistas[c.id]) continue;
        let ok = false;
        try { ok = c.alvo ? c.prog(P) >= (typeof c.alvo === 'function' ? c.alvo() : c.alvo) : c.ok(ev, P); }
        catch (e) { console.error('[wow.games] Erro no sistema de perfil/conquistas (conquista "' + c.id + '"):', e); }
        if (ok) {
          P.conquistas[c.id] = new Date().toISOString(); xp += c.xp || 50;
          toast(`🏆 <b>CONQUISTA DESBLOQUEADA!</b><span>“${esc(c.nome)}”</span><small>+${c.xp || 50} XP</small>`, 'conquista');
        }
      }
      darXP(P, xp);
      armazem.gravar(P);
    } catch (e) {
      // O sistema de perfil nunca deve quebrar um jogo, mas o erro precisa aparecer no console para ser corrigido.
      console.error('[wow.games] Erro no sistema de perfil/conquistas:', e);
    }
  }

  Object.assign(Perfil, {
    AVATARES, DESAFIO_XP, jogos: JOGOS, conquistas: CONQ, desafios: DESAFIOS,
    registrarJogo: d => JOGOS.push(d), registrarConquista: d => CONQ.push(d), registrarDesafio: d => DESAFIOS.push(d),
    CHAVE: KEY, atualizar: fn => { const P = carregar(); fn(P); armazem.gravar(P); return P; },
    dados: carregar, evento, desafioDoDia, nivelDe, xpDoNivel, resumoXP, toast
  });

  /* Diagnóstico: no Console do site, jogue uma partida e rode  WowGames.Perfil.diagnostico()  (ou  copy(WowGames.Perfil.diagnostico())) */
  Perfil.diagnostico = function () {
    let storage = 'ok';
    try { localStorage.setItem('wowgames.teste', '1'); if (localStorage.getItem('wowgames.teste') !== '1') storage = 'não leu o que gravou'; localStorage.removeItem('wowgames.teste'); } catch (e) { storage = 'ERRO: ' + e.message; }
    const P = carregar();
    const r = {
      eventosRecebidos: Perfil.eventosRecebidos || 0, ultimoEvento: Perfil.ultimoEvento || null,
      registrados: { jogos: JOGOS.length, conquistas: CONQ.length, desafios: DESAFIOS.length },
      WowGamesEventoEhOReal: WowGames.evento === evento, localStorage: storage,
      perfilSalvo: { xp: P.xp, partidas: P.partidas, conquistas: Object.keys(P.conquistas), jogos: P.jogos },
      scripts: Array.from(document.scripts).map(s => s.getAttribute('src')).filter(Boolean)
    };
    console.log('[wow.games] diagnóstico:', r); return r;
  };

  /* ---------- Interface: faixa da página inicial ---------- */
  const barra = pct => `<div class="pf-barra"><i style="width:${Math.max(pct, 2)}%"></i></div>`;
  function homeExtra() {
    const P = carregar();
    if (garantirDia(P)) armazem.gravar(P);
    const r = resumoXP(P.xp), d = desafioDoDia(P.diario.dia), feito = P.diario.concluido;
    const prog = d.alvo && !feito ? `<p class="pf-prog">Progresso: <b>${Math.min(P.diario.progresso, d.alvo)}/${d.alvo}</b></p>` : '';
    return `
      <section class="pf-faixa">
        <a class="pf-perfil" href="#/perfil"><span class="pf-av">${P.avatar}</span>
          <div class="pf-info"><b>${esc(P.nome)}</b><small>Nível ${r.nivel} | ${P.xp} XP</small>${barra(r.pct)}</div></a>
        <a class="btn" href="#/conquistas">🏆 Conquistas ${Object.keys(P.conquistas).length}/${CONQ.length}</a>
      </section>
      <section class="pf-dia ${feito ? 'feito' : ''}">
        <small>🔥 DESAFIO DO DIA</small>
        <h2>“${d.texto}”</h2>${prog}
        ${feito ? `<p class="pf-ok">✅ Desafio concluído! Você ganhou ${DESAFIO_XP} XP. Volte amanhã para um novo.</p>` : `<a class="btn" href="#/${d.jogo}">JOGAR</a>`}
      </section>`;
  }

  /* ---------- Páginas: Perfil e Conquistas ---------- */
  const fmtData = iso => new Date(iso).toLocaleDateString('pt-BR');
  function paginaPerfil(el) {
    function desenhar() {
      const P = carregar(), r = resumoXP(P.xp);
      const nConq = Object.keys(P.conquistas).length, nJogos = Object.keys(P.jogos).length;
      const geral = Math.round((nConq + nJogos) / ((CONQ.length + JOGOS.length) || 1) * 100);
      const recs = [];
      JOGOS.forEach(j => (j.recordes || []).forEach(rc => { const x = P.recordes[j.id + ':' + rc.id]; if (x) recs.push(`<li><span>${j.icone || ''} ${rc.rotulo}</span><b>${rc.fmt ? rc.fmt(x.valor) : x.valor}</b></li>`); }));
      el.innerHTML = `<div class="pf">
        <div class="pf-topo"><span class="pf-av grande">${P.avatar}</span>
          <div><label for="pf-nome"><b>Seu apelido</b></label><input id="pf-nome" class="jg-in pf-nome" maxlength="16" autocomplete="off"></div></div>
        <h3>Nível ${r.nivel}</h3>${barra(r.pct)}<p class="pf-prog">${r.atual}/${r.total} XP para o nível ${r.nivel + 1}</p>
        <h4>Escolha seu avatar</h4>
        <div class="pf-avs">${AVATARES.map(a => `<button class="pf-avb ${a === P.avatar ? 'sel' : ''}" data-av="${a}" aria-label="Avatar ${a}">${a}</button>`).join('')}</div>
        <div class="pf-stats">
          <div><small>XP acumulado</small><b>${P.xp}</b></div><div><small>Nível atual</small><b>${r.nivel}</b></div>
          <div><small>Partidas jogadas</small><b>${P.partidas}</b></div><div><small>Jogos diferentes</small><b>${nJogos}/${JOGOS.length}</b></div>
          <div><small>Conquistas</small><b>${nConq}/${CONQ.length}</b></div><div><small>Desafios do dia</small><b>${P.desafiosConcluidos}</b></div></div>
        <h4>Progresso geral</h4>${barra(geral)}<p class="pf-prog">${geral}% (conquistas e jogos experimentados)</p>
        <h4>🏅 Recordes pessoais</h4>${recs.length ? `<ul class="pf-recs">${recs.join('')}</ul>` : '<p>Jogue para registrar seus recordes.</p>'}
        <div class="pf-acoes"><a class="btn" href="#/conquistas">🏆 Ver conquistas</a></div>
        <div id="pf-rec"></div>
        <button class="link" data-a="apagar">Apagar dados do perfil</button></div>`;
      el.querySelector('#pf-nome').value = P.nome;
      if (Perfil.montarRecuperacao) Perfil.montarRecuperacao(el.querySelector('#pf-rec'), desenhar);   // seção "Seu perfil" (perfil-recuperacao.js)
    }
    el.oninput = e => { if (e.target.id === 'pf-nome') { const P = carregar(); P.nome = e.target.value.trim().slice(0, 16) || 'Jogador'; armazem.gravar(P); } };
    el.onclick = e => {
      const av = e.target.closest('[data-av]'), ap = e.target.closest('[data-a="apagar"]');
      if (av) { const P = carregar(); P.avatar = av.dataset.av; armazem.gravar(P); desenhar(); }
      if (ap && confirm('Apagar nível, XP, conquistas e recordes deste navegador? Os jogos não são afetados.')) { armazem.gravar(base()); desenhar(); }
    };
    desenhar();
  }
  function paginaConquistas(el) {
    const P = carregar(), n = Object.keys(P.conquistas).length;
    el.innerHTML = `<div class="pf"><h3>🏆 Conquistas</h3><p>Desbloqueadas: <b>${n}/${CONQ.length}</b></p><div class="pf-conqs">${CONQ.map(c => {
      const iso = P.conquistas[c.id], alvo = typeof c.alvo === 'function' ? c.alvo() : c.alvo;
      const v = alvo ? Math.min(c.prog(P), alvo) : 0;
      return `<div class="pf-conq ${iso ? 'ok' : ''}"><span class="pf-ci">${iso ? c.icone : '🔒'}</span><div><b>${c.nome}</b><small>${c.desc}</small>
        ${iso ? `<small class="pf-data">✓ Desbloqueada em ${fmtData(iso)}</small>` : alvo ? `${barra(v / alvo * 100)}<small>${v}/${alvo}</small>` : ''}</div></div>`;
    }).join('')}</div></div>`;
  }

  WowGames.Perfil = Perfil;
  WowGames.evento = evento;
  WowGames.homeExtra = homeExtra;
  WowGames.registerPage({ id: 'perfil', nome: '👤 Perfil do jogador', mount: paginaPerfil });
  WowGames.registerPage({ id: 'conquistas', nome: '🏆 Conquistas', mount: paginaConquistas });
})();
