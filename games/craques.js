/* Jogo 13: Leilão dos Craques — interface e integração com o wow.games.
   Dados: games/craques-dados.js | Regras: games/craques-regras.js | Partida e campo: games/craques-partida.js
   - Salvamento próprio e versionado: wowgames.craques.v1 = { v: 1, som, campanha, amigos } (entra sozinho no código de recuperação).
   - A "verba" do jogo (110) existe só dentro do jogo. Ela NÃO é a moeda 🪙 da Loja e não mexe na carteira do site.
   - XP, recordes, conquistas e pontuação: pelos sistemas existentes (WowGames.Perfil / WowGames.Pontos), um evento por partida/campanha.
   - Não entra no placar global: o resultado depende do elenco montado e não é comparável entre jogadores. */
(function () {
  const R = WowGames.CraquesRegras, M = WowGames.CraquesPartida, D = WowGames.CraquesDados;
  if (!R || !M || !D) { console.error('[wow.games] Leilão dos Craques: arquivos de dados/regras/partida não carregados.'); return; }
  const ID = 'craques', CHAVE = 'wowgames.craques.v1';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VERBA = v => `<span class="lc-verba" title="Verba do jogo (não são as moedas da Loja)">💰 ${v}</span>`;
  const CORES = [
    { id: 'azul', nome: 'Azul', cor: '#2d6cdf', cor2: '#ffffff' }, { id: 'verde', nome: 'Verde', cor: '#1f9d55', cor2: '#ffffff' },
    { id: 'roxo', nome: 'Roxo', cor: '#7b3fe4', cor2: '#ffd400' }, { id: 'laranja', nome: 'Laranja', cor: '#f07a1a', cor2: '#1c1840' },
    { id: 'preto', nome: 'Preto', cor: '#222233', cor2: '#3ddc97' }, { id: 'vermelho', nome: 'Vermelho', cor: '#e2453c', cor2: '#ffffff' }
  ];
  const JOG_COR = [{ cor: '#2d6cdf', cor2: '#ffffff', ico: '🔵' }, { cor: '#e2453c', cor2: '#ffffff', ico: '🔴' }];
  const FASE_TXT = ['', 'Quartas de final', 'Semifinal', 'Vice-campeão', 'Campeão'];
  const NA_FASE = ['nas quartas de final', 'na semifinal', 'na final'];

  /* ---------- Salvamento ---------- */
  function ler() {
    try { const s = JSON.parse(localStorage.getItem(CHAVE)); if (s && s.v === 1) return { v: 1, som: !!s.som, titulos: s.titulos | 0, campanha: s.campanha || null, amigos: s.amigos || null }; } catch (e) {}
    return { v: 1, som: false, titulos: 0, campanha: null, amigos: null };
  }
  function gravar(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); return true; } catch (e) { console.error('[wow.games] Leilão dos Craques: não foi possível salvar.', e); return false; } }

  /* ---------- Integração: XP, recordes, conquistas e pontuação ---------- */
  const Perfil = WowGames.Perfil;
  if (Perfil) {
    Perfil.registrarJogo({ id: ID, nome: 'Leilão dos Craques', icone: '⚽',
      xp: ev => ev.tipo === 'partida' ? (ev.modo === 'copa' ? (ev.resultado === 'vitoria' ? 40 : 15) : 20) : ev.tipo === 'copa' ? (ev.faseNum === 4 ? 200 : 0) : 0,
      recordes: [{ id: 'fase', rotulo: 'Leilão dos Craques: melhor campanha', melhor: 'maior', valor: ev => ev.tipo === 'copa' ? ev.faseNum : null, fmt: v => FASE_TXT[v] || v },
                 { id: 'titulos', rotulo: 'Leilão dos Craques: títulos', melhor: 'maior', valor: ev => ev.tipo === 'copa' ? ev.titulos : null, fmt: v => v + ' 🏆' }] });
    [
      { id: 'craquesestreia', icone: '⚽', nome: 'Primeiro Apito', desc: 'Vença uma partida da Copa das Lendas no Leilão dos Craques.', xp: 50,
        ok: ev => ev.jogo === ID && ev.tipo === 'partida' && ev.modo === 'copa' && ev.resultado === 'vitoria' },
      { id: 'craquesgoleada', icone: '🔥', nome: 'Show de Bola', desc: 'Vença uma partida do Leilão dos Craques por 3 gols de diferença ou mais.', xp: 100,
        ok: ev => ev.jogo === ID && ev.tipo === 'partida' && ev.saldo >= 3 },
      { id: 'craquespenaltis', icone: '🧤', nome: 'Nervos de Aço', desc: 'Vença uma disputa de pênaltis na Copa das Lendas.', xp: 100,
        ok: ev => ev.jogo === ID && ev.tipo === 'partida' && ev.modo === 'copa' && ev.penaltis && ev.resultado === 'vitoria' },
      { id: 'craquescampeao', icone: '🏆', nome: 'Lenda das Lendas', desc: 'Seja campeão da Copa das Lendas no Leilão dos Craques.', xp: 300,
        ok: ev => ev.jogo === ID && ev.tipo === 'copa' && ev.faseNum === 4 },
      { id: 'craquesleiloeiro', icone: '🔨', nome: 'Martelo Batido', desc: 'Complete um Leilão entre Amigos e jogue a partida até o fim.', xp: 80,
        ok: ev => ev.jogo === ID && ev.tipo === 'partida' && ev.modo === 'amigos' }
    ].forEach(c => Perfil.registrarConquista(c));
  }
  if (WowGames.Pontos) WowGames.Pontos.registrar(ID, { limite: 3, mostrarZero: ev => ev.tipo === 'copa', calcula: ev => ev.tipo === 'copa' ? ([0, 60, 150, 300, 800][ev.faseNum] || 0) : 0 });

  /* ---------- Sons (opcionais, gerados no navegador) ---------- */
  let audio = null;
  function som(tipo, ligado) {
    if (!ligado) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime, tons = { apito: [[1900, .12], [1900, .25]], chute: [[180, .06]], gol: [[523, .15], [659, .15], [784, .3]], defesa: [[330, .1]], lance: [[880, .07]] }[tipo] || [];
      let d = 0;
      tons.forEach(([f, dur]) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = tipo === 'apito' ? 'square' : 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.12, t + d + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d + dur);
        o.connect(g); g.connect(audio.destination); o.start(t + d); o.stop(t + d + dur + .02); d += dur * .9; });
    } catch (e) {}
  }

  /* ---------- Componentes visuais ---------- */
  const iniciais = n => n.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const COR_POS = { GOL: '#ffc933', ZAG: '#4da3ff', LAT: '#7fd1ff', VOL: '#3ddc97', MEI: '#9be15d', PON: '#ff9f43', ATA: '#ff5d73' };
  const barra = (rot, v) => `<span class="lc-at"><i>${rot}</i><b style="--v:${v}%"></b><em>${v}</em></span>`;
  function cartao(a, extra) {
    const at = a.atr, gk = a.pos === 'GOL';
    return `<article class="lc-card ${a.epoca === 'historico' ? 'hist' : 'atual'} ${extra && extra.cls || ''}" data-atleta="${esc(a.id)}">
      <header><span class="lc-av" style="--c:${COR_POS[a.pos]}">${esc(iniciais(a.nome))}</span>
        <div class="lc-ci"><b class="lc-nome">${esc(a.nome)}</b><small>${R.POS_NOME[a.pos]}${a.sec && a.sec.length ? ' · ' + a.sec.join('/') : ''}${a.pais ? ' · ' + esc(a.pais) : ''}</small>
          <small class="lc-ep">${a.epoca === 'historico' ? '⭐ Lenda' : '🟢 Atual'}</small></div>
        <span class="lc-nota" title="Nota do jogo (fictícia)">${a.nota}</span></header>
      <div class="lc-ats">${gk ? barra('GOL', at.gol) + barra('PAS', at.pas) + barra('VEL', at.vel) : barra('VEL', at.vel) + barra('PAS', at.pas) + barra('CHU', at.chu) + barra('DEF', at.def) + barra('CON', at.con)}</div>
      ${extra && extra.rodape || ''}</article>`;
  }

  WowGames.register({
    id: ID, nome: 'Leilão dos Craques', icone: '⚽', cor: 'var(--mint)',
    desc: 'Monte um time com lendas e craques atuais: dispute a Copa das Lendas ou faça um leilão com um amigo e assista ao jogo em campo 2D.',

    mount(el) {
      let S = ler();
      R.restaurarExtras(S.campanha && S.campanha.copa); R.restaurarJuvenis(S.amigos);
      let tela = 'menu', aba = 'mercado', slotSel = null, msg = null, ctl = null, vivo = true, ocupado = false, anim = null;
      const filtro = { pos: 'todos', epoca: 'todas', busca: '', ordem: 'nota', limite: 24 };
      const salvar = () => gravar(S);
      const aviso = () => msg ? `<p class="lc-msg ${msg.ok ? 'ok' : 'erro'}" role="${msg.ok ? 'status' : 'alert'}">${esc(msg.txt)}</p>` : '';
      const evento = (chave, ev, dono) => {                              // um único envio por partida/campanha
        if (dono.enviados[chave]) return null;
        dono.enviados[chave] = true; salvar();
        return WowGames.evento(Object.assign({ jogo: ID }, ev));
      };

      /* ======================= MENU ======================= */
      function telaMenu() {
        tela = 'menu'; pararPartida();
        const c = S.campanha, a = S.amigos;
        el.innerHTML = `<div class="lc lc-menu">
          <header class="lc-cab"><span class="lc-logo" aria-hidden="true">⚽</span><div><h2>Leilão dos Craques</h2>
            <p>Compre lendas e craques atuais, escale seu time e assista às partidas num campo 2D.</p></div></header>
          ${aviso()}
          <div class="lc-modos">
            <section class="lc-modo"><h3>🏆 Copa das Lendas</h3>
              <p>Você tem ${VERBA(R.ORCAMENTO)} de verba para contratar atletas com preço fixo. Depois enfrenta equipes históricas sorteadas: quartas, semifinal e final. Perdeu, está fora.</p>
              ${c ? `<p class="lc-estado">Campanha salva: <b>${c.etapa === 'mercado' ? 'montando o elenco' : c.copa && c.copa.campeao ? 'campeão! 🏆' : c.copa && c.copa.eliminado ? 'eliminado' : R.FASES[c.copa ? c.copa.fase : 0]}</b></p>
                <button class="btn" data-a="copa-continuar">Continuar campanha</button> <button class="btn small lc-sec" data-a="copa-nova">Nova campanha</button>`
                : `<button class="btn" data-a="copa-nova">Começar campanha</button>`}
            </section>
            <section class="lc-modo"><h3>🔨 Leilão entre Amigos</h3>
              <p>Duas pessoas no mesmo aparelho, cada uma com ${VERBA(R.ORCAMENTO)}. Os atletas vão a leilão um por um, com lances alternados. No fim, os dois times se enfrentam.</p>
              ${a ? `<p class="lc-estado">Leilão salvo: <b>${a.etapa === 'leilao' ? 'em andamento' : a.etapa === 'fim' ? 'partida encerrada' : 'escalando os times'}</b></p>
                <button class="btn" data-a="amigos-continuar">Continuar</button> <button class="btn small lc-sec" data-a="amigos-novo">Novo leilão</button>`
                : `<button class="btn" data-a="amigos-novo">Começar leilão</button>`}
            </section>
          </div>
          <details class="lc-regras"><summary>Como funciona a partida</summary><ul>
            <li>Cada partida dura <b>2 minutos reais</b> em velocidade 1x (o relógio mostra 0 a 90 minutos). Dá para acelerar (2x, 4x), pausar ou pular.</li>
            <li>Notas, posições, formação e estilo influenciam cada jogada: passes, dribles, desarmes, chutes e defesas. A sorte também conta.</li>
            <li>Atleta fora da posição rende menos. Goleiro improvisado rende muito menos.</li>
            <li>Nas eliminatórias, empate vai para a prorrogação (minutos 90 a 120) e depois para os pênaltis.</li>
            <li>As notas e atributos são avaliações fictícias do jogo, inspiradas na carreira de cada atleta. A verba 💰 não tem relação com as moedas 🪙 da Loja.</li>
          </ul></details>
          <label class="lc-som"><input type="checkbox" data-a="som" ${S.som ? 'checked' : ''}> 🔊 Efeitos sonoros</label>
        </div>`;
      }

      /* ======================= COPA: mercado, escalação, chave ======================= */
      function telaCopa() {
        tela = 'copa'; pararPartida();
        const c = S.campanha; if (!c) return telaMenu();
        if (c.etapa !== 'mercado' && aba === 'mercado') aba = 'chave';
        const titular = new Set(c.titulares.filter(Boolean)), an = R.analisar(c.titulares, c.formacao);
        el.innerHTML = `<div class="lc lc-copa">
          <div class="lc-topo">
            <button class="btn small lc-sec" data-a="menu">← Menu do jogo</button>
            <label class="lc-nometime">Time: <input class="jg-in" data-campo="nomeTime" maxlength="20" value="${esc(c.nomeTime || 'Meu Time')}"></label>
            <div class="lc-orc"><small>Verba</small>${VERBA(c.orcamento)}</div>
            <div class="lc-orc"><small>Elenco</small><b>${c.elenco.length}/${R.MAX_ELENCO}</b></div>
            <div class="lc-orc"><small>Nota do time</small><b>${an.nota || '—'}</b></div>
          </div>
          <nav class="lc-abas" role="tablist">
            ${c.etapa === 'mercado' ? `<button role="tab" class="lc-aba ${aba === 'mercado' ? 'on' : ''}" data-aba="mercado">🛒 Mercado</button>` : ''}
            <button role="tab" class="lc-aba ${aba === 'escalacao' ? 'on' : ''}" data-aba="escalacao">📋 Escalação</button>
            <button role="tab" class="lc-aba ${aba === 'chave' ? 'on' : ''}" data-aba="chave">🏆 Copa</button>
          </nav>
          ${aviso()}
          <div class="lc-conteudo">${aba === 'mercado' ? mercadoHtml(c, titular) : aba === 'escalacao' ? escalacaoHtml(c, !c.partida, 'copa') : chaveHtml(c)}</div>
        </div>`;
        if (anim) { const x = el.querySelector(`[data-atleta="${anim}"]`); if (x) x.classList.add('lc-comprou'); anim = null; }
      }
      function mercadoHtml(c) {
        let lista = D.ATLETAS.filter(a => (filtro.pos === 'todos' || a.pos === filtro.pos) && (filtro.epoca === 'todas' || a.epoca === filtro.epoca));
        const q = filtro.busca.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (q) lista = lista.filter(a => a.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q));
        lista.sort(filtro.ordem === 'barato' ? (a, b) => a.preco - b.preco || b.nota - a.nota : filtro.ordem === 'caro' ? (a, b) => b.preco - a.preco : (a, b) => b.nota - a.nota || a.preco - b.preco);
        const mostra = lista.slice(0, filtro.limite);
        const seu = c.elenco.map(R.atleta);
        return `<div class="lc-mercado">
          <aside class="lc-elenco"><h3>Seu elenco <small>${c.elenco.length}/${R.MAX_ELENCO} · mínimo ${R.MIN_ELENCO}</small></h3>
            ${seu.length ? `<ul>${seu.map(a => `<li><span class="lc-pos" style="--c:${COR_POS[a.pos]}">${a.pos}</span><span>${esc(a.nome)}</span><b>${a.nota}</b>
              <button class="link lc-disp" data-a="dispensar" data-id="${a.id}" aria-label="Dispensar ${esc(a.nome)} (devolve ${a.preco})">devolver ${a.preco}</button></li>`).join('')}</ul>` : '<p class="lc-dica">Contrate pelo menos 11 atletas, incluindo um goleiro. Dica: misture estrelas caras com opções econômicas.</p>'}
            ${c.elenco.length >= R.MIN_ELENCO ? `<button class="btn" data-aba="escalacao">Ir para a escalação →</button>` : ''}
          </aside>
          <section class="lc-loja">
            <div class="lc-filtros">
              <input class="jg-in lc-busca" type="search" placeholder="Buscar atleta" value="${esc(filtro.busca)}" data-campo="busca" aria-label="Buscar atleta">
              <select data-campo="pos" aria-label="Posição">${['todos', 'GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'PON', 'ATA'].map(p => `<option value="${p}" ${filtro.pos === p ? 'selected' : ''}>${p === 'todos' ? 'Todas as posições' : R.POS_NOME[p]}</option>`).join('')}</select>
              <select data-campo="epoca" aria-label="Época"><option value="todas">Todas as épocas</option><option value="atual" ${filtro.epoca === 'atual' ? 'selected' : ''}>Atuais</option><option value="historico" ${filtro.epoca === 'historico' ? 'selected' : ''}>Lendas</option></select>
              <select data-campo="ordem" aria-label="Ordenar"><option value="nota">Maior nota</option><option value="barato" ${filtro.ordem === 'barato' ? 'selected' : ''}>Mais baratos</option><option value="caro" ${filtro.ordem === 'caro' ? 'selected' : ''}>Mais caros</option></select>
            </div>
            <p class="lc-cont">${lista.length} ${lista.length === 1 ? 'atleta' : 'atletas'}</p>
            <div class="lc-grade">${mostra.map(a => {
              const tem = c.elenco.includes(a.id), v = R.podeComprar(c, a.id);
              return cartao(a, { cls: tem ? 'tem' : '', rodape: `<footer><span class="lc-preco">${VERBA(a.preco)}</span>${tem ? `<button class="btn small lc-sec" data-a="dispensar" data-id="${a.id}">Devolver</button>`
                : `<button class="btn small" data-a="comprar" data-id="${a.id}" ${v.ok ? '' : `disabled title="${esc(v.motivo)}"`}>Contratar</button>`}</footer>` });
            }).join('')}</div>
            ${lista.length > mostra.length ? `<button class="btn lc-mais" data-a="mais">Mostrar mais (${lista.length - mostra.length})</button>` : ''}
          </section></div>`;
      }

      /* ---------- Escalação (Copa e Amigos) ---------- */
      function escalacaoHtml(t, editavel, ctxEsc) {
        const slots = R.FORMACOES[t.formacao], an = R.analisar(t.titulares, t.formacao);
        const tit = new Set(t.titulares.filter(Boolean)), reservas = t.elenco.filter(id => !tit.has(id));
        const linha = (id, i) => {
          const a = R.atleta(id), p = slots[i][0], f = a ? R.compat(a, p) : 0, nv = R.nivelCompat(f);
          return `<button class="lc-slot ${a ? nv : 'vazio'} ${slotSel === i ? 'sel' : ''}" data-a="slot" data-i="${i}" style="left:${slots[i][2] * 100}%;top:${(1 - slots[i][1]) * 100}%" ${editavel ? '' : 'disabled'}
            aria-label="${R.POS_NOME[p]}: ${a ? esc(a.nome) : 'vazio'}${a && f < 1 ? ', ' + Math.round(f * 100) + '%' : ''}">
            <span class="lc-sp">${p}</span><b>${a ? esc(a.nome.split(' ').slice(-1)[0]) : '+'}</b>${a ? `<small>${a.nota}${f < 1 ? ' · ' + Math.round(f * 100) + '%' : ''}</small>` : ''}</button>`;
        };
        return `<div class="lc-esc">
          <div class="lc-esc-campo-box">
            <div class="lc-esc-ctrl">
              <label>Formação <select data-campo="formacao" ${editavel ? '' : 'disabled'}>${Object.keys(R.FORMACOES).map(f => `<option ${f === t.formacao ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
              <label>Estilo <select data-campo="estilo" ${editavel ? '' : 'disabled'}>${Object.entries(R.ESTILOS).map(([k, v]) => `<option value="${k}" ${k === t.estilo ? 'selected' : ''}>${v.nome}</option>`).join('')}</select></label>
              ${ctxEsc === 'copa' ? `<label>Uniforme <select data-campo="uniforme" ${editavel ? '' : 'disabled'}>${CORES.map(x => `<option value="${x.id}" ${x.id === (t.uniforme || 'azul') ? 'selected' : ''}>${x.nome}</option>`).join('')}</select></label>` : ''}
              <button class="btn small" data-a="auto" ${editavel ? '' : 'disabled'}>⚡ Escalar automaticamente</button>
            </div>
            <p class="lc-dica">${R.ESTILOS[t.estilo].desc} ${editavel ? 'Toque numa posição e depois num atleta da lista para escalar ou trocar.' : '🔒 Escalação travada: há uma partida em andamento.'}</p>
            <div class="lc-esc-campo" style="--c:${(CORES.find(x => x.id === t.uniforme) || {}).cor || '#2d6cdf'}">${t.titulares.map(linha).join('')}</div>
            <p class="lc-nota-time">Nota do time: <b>${an.nota || '—'}</b> ${an.completa ? '✅ Escalação completa' : '⚠️ Escalação incompleta'}</p>
            ${an.avisos.length ? `<ul class="lc-avisos">${an.avisos.map(x => `<li>⚠️ ${esc(x.txt)}</li>`).join('')}</ul>` : ''}
          </div>
          <div class="lc-esc-lista">
            <h3>${slotSel !== null && editavel ? `Escolha para: ${R.POS_NOME[slots[slotSel][0]]}` : 'Elenco'}</h3>
            <ul>${t.elenco.map(id => {
              const a = R.atleta(id), ti = t.titulares.indexOf(id), f = slotSel !== null ? R.compat(a, slots[slotSel][0]) : null;
              return `<li><button class="lc-jog ${ti >= 0 ? 'titular' : 'reserva'}" data-a="por" data-id="${id}" ${editavel && slotSel !== null ? '' : 'disabled'}>
                <span class="lc-pos" style="--c:${COR_POS[a.pos]}">${a.pos}</span><span class="lc-jn">${esc(a.nome)}</span><b>${a.nota}</b>
                <small>${ti >= 0 ? 'titular' : 'reserva'}${f !== null ? ' · ' + Math.round(f * 100) + '%' : ''}</small></button></li>`;
            }).join('')}</ul>
            ${slotSel !== null && editavel && t.titulares[slotSel] ? `<button class="btn small lc-sec" data-a="tirar">Tirar da posição</button>` : ''}
            <p class="lc-dica">Reservas: ${reservas.length ? reservas.map(id => esc(R.atleta(id).nome)).join(', ') : 'nenhum'}.</p>
          </div></div>`;
      }

      /* ---------- Chave da copa ---------- */
      const nomeNaCopa = (c, id) => id === 'voce' ? (c.nomeTime || 'Meu Time') : (c.copa.times.find(t => t.id === id) || {}).nome || '?';
      function chaveHtml(c) {
        const an = R.analisar(c.titulares, c.formacao);
        if (!c.copa) {
          return `<div class="lc-pre"><h3>🏆 Copa das Lendas</h3>
            <p>Quando a copa começa, o mercado fecha: você não poderá mais contratar nem devolver atletas (a escalação pode mudar entre as partidas).</p>
            <p>7 equipes históricas serão sorteadas entre ${D.TIMES.length} possíveis, com desafios acessíveis, médios e difíceis. A chave é sorteada e não muda depois.</p>
            ${an.completa ? `<button class="btn big" data-a="sortear">🎲 Sortear adversários e começar</button>` : `<p class="lc-msg erro">Complete os 11 titulares na escalação antes de começar.</p><button class="btn" data-aba="${c.elenco.length >= 11 ? 'escalacao' : 'mercado'}">${c.elenco.length >= 11 ? 'Ir para a escalação' : 'Voltar ao mercado'}</button>`}
          </div>`;
        }
        const cp = c.copa, colunas = [0, 1, 2].map(f => {
          const res = cp.rodadas[f] || [];
          const prontos = f === 0 || (cp.rodadas[f - 1] && cp.rodadas[f - 1].length && cp.rodadas[f - 1].every(Boolean));
          return `<div class="lc-col"><h4>${R.FASES[f]}</h4>${prontos ? R.confrontos(cp, f).map((par, k) => {
            const r = res[k];
            return `<div class="lc-jogo ${par.includes('voce') ? 'voce' : ''}">${par.map((id, s) => `<div class="lc-eq ${r && r.vencedor === id ? 'venceu' : r ? 'perdeu' : ''}">
              <span>${id === 'voce' ? '⭐ ' : ''}${esc(nomeNaCopa(c, id))}</span><b>${r ? r.placar[s] + (r.pen ? ` <small>(${r.pen[s]})</small>` : '') : ''}</b></div>`).join('')}</div>`;
          }).join('') : '<p class="lc-dica">A definir</p>'}</div>`;
        }).join('');
        const vivo = !cp.eliminado && !cp.campeao, par = vivo ? R.confrontos(cp, cp.fase).find(p => p.includes('voce')) : null;
        const advId = par ? par.find(x => x !== 'voce') : null, adv = advId && cp.times.find(t => t.id === advId);
        const pendente = (cp.rodadas[cp.fase] || []).length && !(cp.rodadas[cp.fase] || []).every(Boolean);
        let painel = '';
        if (cp.campeao) painel = `<div class="lc-campeao"><div class="big-emoji">🏆</div><h3>CAMPEÃO DA COPA DAS LENDAS!</h3><p>${esc(c.nomeTime || 'Meu Time')} venceu as três fases. Que time!</p><button class="btn" data-a="copa-nova">Nova campanha</button></div>`;
        else if (cp.eliminado) painel = `<div class="lc-elim"><h3>Fim da linha</h3><p>${esc(c.nomeTime || 'Meu Time')} foi eliminado ${NA_FASE[cp.faseElim]}.${cp.campeaoId ? ` Campeão: <b>${esc(nomeNaCopa(c, cp.campeaoId))}</b>.` : ''}</p><button class="btn" data-a="copa-nova">Nova campanha</button></div>`;
        else if (pendente || ocupado) painel = `<p class="lc-dica">⏳ Calculando os outros jogos da fase…</p>`;
        else if (adv) painel = `<div class="lc-prox"><h3>${R.FASES[cp.fase]}: ${esc(c.nomeTime || 'Meu Time')} × ${esc(adv.nome)}</h3>
          <p>Adversário: nota ${R.analisar(adv.titulares, adv.formacao).nota}, ${adv.formacao}, estilo ${R.ESTILOS[adv.estilo].nome.toLowerCase()}. Seu time: nota ${an.nota}.</p>
          ${adv.subs.length ? `<p class="lc-dica">Como ${adv.subs.map(s => esc(s.sai)).join(', ')} está no seu elenco, ${adv.subs.length > 1 ? 'entram' : 'entra'} ${adv.subs.map(s => esc(s.entra)).join(', ')}.</p>` : ''}
          <ul class="lc-adv">${adv.titulares.map(id => { const a = R.atleta(id); return `<li><span class="lc-pos" style="--c:${COR_POS[a.pos]}">${a.pos}</span>${esc(a.nome)} <b>${a.nota}</b></li>`; }).join('')}</ul>
          ${c.partida ? `<p class="lc-msg erro">A partida foi interrompida. Ela recomeça do início com o mesmo sorteio e as mesmas escalações.</p>` : ''}
          ${an.completa ? `<button class="btn big" data-a="jogar">${c.partida ? '▶ Retomar partida' : '▶ Jogar partida'}</button>` : '<p class="lc-msg erro">Complete a escalação para jogar.</p>'}</div>`;
        return `<div class="lc-chave">${colunas}</div>${painel}`;
      }

      /* ======================= PARTIDA (Copa e Amigos) ======================= */
      function defTime(t, nome, uni) { return { nome, cor: uni.cor, cor2: uni.cor2, formacao: t.formacao, estilo: t.estilo, titulares: t.titulares.slice() }; }
      function corDistante(a, b) { const h = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)); const [p, q] = [h(a), h(b)]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 120; }
      function cfgCopa(c) {
        const cp = c.copa, par = R.confrontos(cp, cp.fase).find(p => p.includes('voce')), adv = cp.times.find(t => t.id === par.find(x => x !== 'voce'));
        const uni = CORES.find(x => x.id === (c.uniforme || 'azul')) || CORES[0];
        let cor = adv.cor, cor2 = adv.cor2;
        if (!corDistante(uni.cor, cor)) [cor, cor2] = [cor2, cor];
        if (!corDistante(uni.cor, cor)) { cor = '#f2f2f2'; cor2 = '#1c1840'; }
        if (!c.partida) { c.partida = { fase: cp.fase, seed: (cp.semente + 7919 * (cp.fase + 1)) >>> 0, a: defTime(c, c.nomeTime || 'Meu Time', uni) }; salvar(); }
        return { a: c.partida.a, b: { nome: adv.nome, cor, cor2, formacao: adv.formacao, estilo: adv.estilo, titulares: adv.titulares }, seed: c.partida.seed, desempate: 'prorrogacao' };
      }
      function pararPartida() { if (ctl) { ctl.destruir(); ctl = null; } }

      function telaPartida(cfg, titulo, aoFim) {
        tela = 'partida'; pararPartida();
        el.innerHTML = `<div class="lc lc-partida">
          <div class="lc-placar" aria-live="polite">
            <div class="lc-pt a" style="--c:${cfg.a.cor}"><span>${esc(cfg.a.nome)}</span><b id="lc-ga">0</b></div>
            <div class="lc-relogio"><small id="lc-fase">${esc(titulo)}</small><b id="lc-min">0'</b><small id="lc-per">1º tempo</small></div>
            <div class="lc-pt b" style="--c:${cfg.b.cor}"><b id="lc-gb">0</b><span>${esc(cfg.b.nome)}</span></div>
          </div>
          <div class="lc-posse"><i id="lc-posse" style="width:50%"></i></div>
          <div class="lc-campo-box"><canvas id="lc-canvas" aria-label="Campo de futebol com a partida em andamento"></canvas><div class="lc-golfx" id="lc-golfx" hidden>GOOOL!</div></div>
          <div class="lc-ctrl">
            <button class="btn small" data-p="pausa" id="lc-pausa">⏸ Pausar</button>
            <span class="lc-vels" role="group" aria-label="Velocidade">${[1, 2, 4].map(v => `<button class="btn small lc-vel ${v === 1 ? 'on' : ''}" data-p="vel" data-v="${v}">${v}x</button>`).join('')}</span>
            <button class="btn small" data-p="pular">⏭ Pular para o resultado</button>
            <label class="lc-som"><input type="checkbox" data-p="som" ${S.som ? 'checked' : ''}> 🔊</label>
          </div>
          <ol class="lc-narra" id="lc-narra" aria-live="polite"></ol>
        </div>`;
        ctl = controlador(cfg, aoFim);
      }

      function controlador(cfg, aoFim) {
        const sim = M.criar(cfg), canvas = el.querySelector('#lc-canvas'), campo = M.Campo(canvas);
        let raf = 0, ult = 0, acc = 0, vel = 1, pausado = false, morto = false, pulando = false, golTo = 0;
        const $ = id => el.querySelector('#' + id);
        let hud = {};
        function atualizarHud() {
          const [A, B] = sim.times, min = M.minuto(sim) + "'";
          const per = sim.periodo === 'prorrogacao' ? '⚡ Prorrogação' : sim.periodo === 'penaltis' ? '🥅 Pênaltis' : sim.segundoTempo ? '2º tempo' : '1º tempo';
          const tot = (A.st.posse + B.st.posse) || 1, posse = Math.round(A.st.posse / tot * 100);
          const novo = { ga: A.st.gols, gb: B.st.gols, min, per, posse };
          if (novo.ga !== hud.ga) $('lc-ga').textContent = novo.ga;
          if (novo.gb !== hud.gb) $('lc-gb').textContent = novo.gb;
          if (novo.min !== hud.min) $('lc-min').textContent = novo.min;
          if (novo.per !== hud.per) { $('lc-per').textContent = per; $('lc-per').classList.toggle('alerta', sim.periodo !== 'normal'); }
          if (novo.posse !== hud.posse) $('lc-posse').style.width = posse + '%';
          hud = novo;
          if (sim.novos.length) {
            const lista = $('lc-narra');
            sim.novos.forEach(e => {
              if (e.penalti) return;
              const li = document.createElement('li'); li.className = 'ev-' + e.tipo + (e.lado === 1 ? ' b' : e.lado === 0 ? ' a' : '');
              li.innerHTML = `<b>${e.min}'</b> ${esc(e.txt)}`; lista.prepend(li);
              while (lista.children.length > 7) lista.lastChild.remove();
              if (e.tipo === 'gol') { mostrarGol(); som('gol', S.som); } else if (e.tipo === 'chute') som('chute', S.som); else if (e.tipo === 'defesa') som('defesa', S.som); else if (e.tipo === 'apito' || e.tipo === 'fim') som('apito', S.som);
            });
            sim.novos.length = 0;
          }
        }
        function mostrarGol() { const g = $('lc-golfx'); if (!g) return; g.hidden = false; g.classList.remove('on'); void g.offsetWidth; g.classList.add('on'); clearTimeout(golTo); golTo = setTimeout(() => { if ($('lc-golfx')) $('lc-golfx').hidden = true; }, 1600); }
        function quadro(ts) {
          raf = 0; if (morto) return;
          if (!ult) ult = ts;
          const dt = Math.min(.25, (ts - ult) / 1000); ult = ts;
          if (!pausado) {
            acc += dt * vel; let n = 0; const max = Math.ceil(vel * 6) + 4;   // nunca acelera sozinho: no máximo alguns passos por quadro
            while (acc >= M.DT && n < max && !sim.terminado) { M.passo(sim); acc -= M.DT; n++; }
            if (n >= max) acc = 0;
          }
          campo.desenhar(sim, pausado ? 1 : Math.min(1, acc / M.DT));
          atualizarHud();
          if (sim.terminado) return fim();
          raf = requestAnimationFrame(quadro);
        }
        function iniciar() { if (raf || morto || sim.terminado) return; ult = 0; raf = requestAnimationFrame(quadro); }
        function parar() { if (raf) cancelAnimationFrame(raf); raf = 0; }
        const vis = () => { if (document.hidden) parar(); else if (!pausado) iniciar(); };
        const redim = () => { campo.medir(); if (pausado || !raf) campo.desenhar(sim, 1); };
        document.addEventListener('visibilitychange', vis); window.addEventListener('resize', redim);
        el.onclick = e => {
          const b = e.target.closest('[data-p]'); if (!b || morto) return;
          const p = b.dataset.p;
          if (p === 'pausa') { pausado = !pausado; b.textContent = pausado ? '▶ Continuar' : '⏸ Pausar'; if (!pausado) iniciar(); }
          if (p === 'vel') { vel = +b.dataset.v; el.querySelectorAll('.lc-vel').forEach(x => x.classList.toggle('on', x === b)); }
          if (p === 'pular' && !pulando) pular();
        };
        el.onchange = e => { if (e.target.dataset.p === 'som') { S.som = e.target.checked; salvar(); } };
        function pular() {                                                 // mesma simulação, em blocos para não travar a tela
          pulando = true; parar();
          el.querySelectorAll('[data-p]').forEach(x => { x.disabled = true; });
          const lista = $('lc-narra'); if (lista) lista.insertAdjacentHTML('afterbegin', '<li class="ev-apito">⏩ Simulando o restante da partida…</li>');
          const bloco = () => {
            if (morto) return;
            for (let i = 0; i < 900 && !sim.terminado; i++) M.passo(sim);
            if (sim.terminado) { campo.desenhar(sim, 1); sim.novos = sim.novos.filter(e => e.tipo === 'gol' || e.tipo === 'fim' || e.tipo === 'apito'); atualizarHud(); fim(); }
            else setTimeout(bloco, 0);
          };
          setTimeout(bloco, 0);
        }
        let finalizado = false;
        function fim() {
          if (finalizado) return; finalizado = true; parar();
          const r = M.resultado(sim);
          setTimeout(() => { if (!morto) aoFim(r); }, pulando ? 50 : 900);
        }
        campo.medir(); campo.desenhar(sim, 1); iniciar();
        M.atual = sim;                                                     // só para diagnóstico/testes no console
        return { destruir() { morto = true; parar(); if (M.atual === sim) M.atual = null; clearTimeout(golTo); document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', redim); el.onclick = el.onchange = null; ligarEventos(); } };
      }

      /* ---------- Resultado ---------- */
      function resultadoHtml(r, nomes, extraTopo, botoes) {
        const est = (k, rot) => `<tr><td>${r.stats[0][k]}</td><th>${rot}</th><td>${r.stats[1][k]}</td></tr>`;
        return `<div class="lc lc-res">
          ${extraTopo || ''}
          <div class="lc-placar final"><div class="lc-pt a"><span>${esc(nomes[0])}</span><b>${r.placar[0]}</b></div><div class="lc-relogio"><b>Fim</b>${r.prorrogacao ? '<small>com prorrogação</small>' : ''}</div><div class="lc-pt b"><b>${r.placar[1]}</b><span>${esc(nomes[1])}</span></div></div>
          ${r.penaltis ? `<div class="lc-pen"><h4>Pênaltis: ${r.penaltis[0]} × ${r.penaltis[1]}</h4><ol>${(r.destaques.filter(d => d.tipo.startsWith('penalti'))).map((d, i) => `<li class="${d.tipo === 'penalti-gol' ? 'ok' : 'x'} ${d.lado ? 'b' : 'a'}" style="--i:${i}">${esc(d.txt)}</li>`).join('')}</ol></div>` : ''}
          <div class="lc-res-grid">
            <table class="lc-stats"><thead><tr><th>${esc(nomes[0])}</th><th></th><th>${esc(nomes[1])}</th></tr></thead><tbody>
              <tr><td>${r.posse[0]}%</td><th>Posse de bola</th><td>${r.posse[1]}%</td></tr>
              ${est('chutes', 'Finalizações')}${est('noAlvo', 'No alvo')}${est('defesas', 'Defesas do goleiro')}${est('passesCertos', 'Passes certos')}${est('desarmes', 'Desarmes')}${est('intercept', 'Interceptações')}
            </tbody></table>
            <div><h4>Lances principais</h4><ul class="lc-lances">${r.destaques.filter(d => !d.tipo.startsWith('penalti')).map(d => `<li class="ev-${d.tipo}"><b>${d.min}'</b> ${esc(d.txt)}</li>`).join('') || '<li>Jogo sem grandes lances.</li>'}</ul></div>
          </div>
          <div class="lc-res-btns">${botoes}</div></div>`;
      }

      /* ======================= COPA: fluxo ======================= */
      function jogarCopa() {
        const c = S.campanha, cp = c.copa; if (!cp || cp.eliminado || cp.campeao || ocupado) return;
        if (!R.analisar(c.titulares, c.formacao).completa) { msg = { ok: false, txt: 'Complete a escalação antes de jogar.' }; return telaCopa(); }
        const cfg = cfgCopa(c);
        telaPartida(cfg, R.FASES[cp.fase], r => registrarCopa(r, cfg));
      }
      function registrarCopa(r, cfg) {
        const c = S.campanha, cp = c.copa, f = cp.fase, jogos = R.confrontos(cp, f);
        const ganhou = r.vencedor === 0;
        cp.rodadas[f] = jogos.map(par => par.includes('voce') ? { par, placar: par[0] === 'voce' ? r.placar : r.placar.slice().reverse(),
          pen: r.penaltis ? (par[0] === 'voce' ? r.penaltis : r.penaltis.slice().reverse()) : null, vencedor: ganhou ? 'voce' : par.find(x => x !== 'voce') } : null);
        c.partida = null; c.ultimo = { r, nomes: [cfg.a.nome, cfg.b.nome], fase: f };
        if (!ganhou) { cp.eliminado = true; cp.faseElim = f; }
        salvar();
        const saldo = r.placar[0] - r.placar[1];
        evento(`${c.id}:p${f}`, { tipo: 'partida', partida: true, modo: 'copa', fase: f, resultado: ganhou ? 'vitoria' : 'derrota', saldo, penaltis: !!r.penaltis, gols: r.placar[0], sofridos: r.placar[1] }, c);
        mostrarResultadoCopa();
        completarCopa();
      }
      function mostrarResultadoCopa() {
        tela = 'resultado';
        const c = S.campanha, u = c.ultimo, cp = c.copa, ganhou = u.r.vencedor === 0;
        const topo = `<div class="lc-res-topo ${ganhou ? 'vit' : 'der'}"><div class="big-emoji">${ganhou ? (cp.campeao || u.fase === 2 ? '🏆' : '🎉') : '😞'}</div>
          <h2>${ganhou ? (u.fase === 2 ? 'CAMPEÃO!' : 'Vitória! Classificado para a ' + R.FASES[u.fase + 1].toLowerCase() + '!') : 'Eliminado ' + NA_FASE[u.fase] + '.'}</h2></div>`;
        el.innerHTML = resultadoHtml(u.r, u.nomes, topo, `<button class="btn big" data-a="ver-chave">${ganhou && u.fase < 2 ? 'Continuar na copa →' : 'Ver a chave'}</button> <button class="btn lc-sec" data-a="menu">Menu do jogo</button>`);
        if (ganhou) WowGames.confetti(el, u.fase === 2 ? ['🏆', '⚽', '⭐', '✨'] : ['⚽', '🎉', '✨']);
      }
      // Simula (em blocos, sem travar a tela) os jogos que faltam na fase e, se o jogador saiu, o resto da copa.
      function completarCopa() {
        const c = S.campanha; if (!c || !c.copa || ocupado) return;
        const cp = c.copa;
        const falta = () => {                                             // próximo jogo entre equipes do computador, se houver
          for (let f = 0; f < 3; f++) {
            if (!cp.rodadas[f] || !cp.rodadas[f].length) {
              if (f === 0 || !cp.rodadas[f - 1].length || !cp.rodadas[f - 1].every(Boolean)) return null;
              const jogos = R.confrontos(cp, f);
              if (jogos.some(p => p.includes('voce'))) return null;        // espera o jogador entrar em campo
              cp.rodadas[f] = jogos.map(() => null);
            }
            const k = cp.rodadas[f].findIndex(x => !x);
            if (k >= 0) return R.confrontos(cp, f)[k].includes('voce') ? null : { f, k };
          }
          return null;
        };
        const prox = () => {
          if (!vivo || S.campanha !== c) { ocupado = false; return; }
          const alvo = falta();
          if (!alvo) return concluir();
          ocupado = true;
          const par = R.confrontos(cp, alvo.f)[alvo.k], [ta, tb] = par.map(id => cp.times.find(t => t.id === id));
          const sim = M.criar({ a: { nome: ta.nome, cor: ta.cor, cor2: ta.cor2, formacao: ta.formacao, estilo: ta.estilo, titulares: ta.titulares },
            b: { nome: tb.nome, cor: tb.cor, cor2: tb.cor2, formacao: tb.formacao, estilo: tb.estilo, titulares: tb.titulares }, seed: (cp.semente + 104729 * (alvo.f + 1) + 31 * alvo.k) >>> 0, desempate: 'prorrogacao' });
          const bloco = () => {
            if (!vivo) { ocupado = false; return; }
            for (let i = 0; i < 1200 && !sim.terminado; i++) M.passo(sim);
            if (!sim.terminado) return setTimeout(bloco, 0);
            const r = M.resultado(sim);
            cp.rodadas[alvo.f][alvo.k] = { par, placar: r.placar, pen: r.penaltis, vencedor: par[r.vencedor] };
            salvar(); setTimeout(prox, 0);
          };
          setTimeout(bloco, 0);
        };
        function concluir() {
          ocupado = false;
          const f = cp.fase;
          if (!cp.eliminado && !cp.campeao && cp.rodadas[f] && cp.rodadas[f].length && cp.rodadas[f].every(Boolean) && cp.rodadas[f].some(x => x.vencedor === 'voce')) {
            if (f === 2) cp.campeao = true; else cp.fase = f + 1;
          }
          if (cp.rodadas[2] && cp.rodadas[2].length && cp.rodadas[2].every(Boolean)) cp.campeaoId = cp.rodadas[2][0].vencedor;
          const acabou = cp.campeao || (cp.eliminado && cp.campeaoId);
          if (acabou) {
            c.etapa = 'fim';
            const faseNum = cp.campeao ? 4 : cp.faseElim + 1;
            if (cp.campeao && !c.enviados[c.id + ':fim']) S.titulos = (S.titulos | 0) + 1;
            salvar();
            evento(`${c.id}:fim`, { tipo: 'copa', partida: false, faseNum, campeao: !!cp.campeao, titulos: S.titulos }, c);
          } else salvar();
          if (tela === 'copa') telaCopa();
        }
        prox();
      }

      /* ======================= LEILÃO ENTRE AMIGOS ======================= */
      function telaAmigosConfig() {
        tela = 'amigos-config'; pararPartida();
        el.innerHTML = `<div class="lc lc-cfg"><button class="btn small lc-sec" data-a="menu">← Menu do jogo</button>
          <h2>🔨 Leilão entre Amigos</h2>
          <p>Cada participante começa com ${VERBA(R.ORCAMENTO)}. Os atletas entram em leilão com lance inicial de 1. Quem abre o leilão se alterna a cada atleta.</p>
          <form class="lc-form" data-form="amigos">
            <label>${JOG_COR[0].ico} Jogador 1 <input class="jg-in" name="n1" maxlength="14" value="Jogador 1" required></label>
            <label>${JOG_COR[1].ico} Jogador 2 <input class="jg-in" name="n2" maxlength="14" value="Jogador 2" required></label>
            <label>Atletas no leilão <select name="tam"><option value="30">30 (rápido)</option><option value="40" selected>40</option><option value="54">54 (longo)</option></select></label>
            <button class="btn big" type="submit">Começar o leilão</button>
          </form>
          <ul class="lc-regras-lista"><li>Na sua vez: cubra o lance (com valor maior) ou desista. Se você desistir, o outro leva pelo último lance.</li>
            <li>Se os dois passarem sem lance, o atleta vai para o fim da fila (na segunda vez, sai do leilão).</li>
            <li>Ninguém pode dar lance acima do saldo, e cada um guarda 1 de verba para cada vaga que ainda falta até 11 atletas.</li>
            <li>Quando os dois tiverem 11 ou mais atletas, o leilão pode ser encerrado. Máximo de ${R.MAX_ELENCO} por time.</li></ul>
        </div>`;
      }
      function telaLeilao() {
        tela = 'leilao'; pararPartida();
        const L = S.amigos; if (!L) return telaMenu();
        if (L.etapa !== 'leilao') return L.etapa === 'escalacao' ? telaAmigosEscalacao() : telaAmigosFim();
        if (!L.lote && L.fila.length) { R.abrirLote(L); salvar(); }
        const lt = L.lote, a = lt && R.atleta(lt.id), vez = lt ? lt.vez : null, jv = vez !== null ? L.jog[vez] : null;
        const mx = vez !== null ? R.maxLance(L, vez) : 0, minimo = lt ? lt.lance + 1 : 1, pode = mx >= minimo;
        const coluna = (j, k) => `<section class="lc-part ${vez === k ? 'vez' : ''}" style="--c:${JOG_COR[k].cor}">
          <h3>${JOG_COR[k].ico} ${esc(j.nome)}</h3><p class="lc-saldo">${VERBA(j.saldo)} <small>${j.elenco.length}/${R.MAX_ELENCO} atletas${j.elenco.length < R.MIN_ELENCO ? ` · faltam ${R.MIN_ELENCO - j.elenco.length}` : ''}</small></p>
          <ul>${j.elenco.map(id => { const x = R.atleta(id), h = L.historico.find(e => e.tipo === 'compra' && e.id === id); return `<li><span class="lc-pos" style="--c:${COR_POS[x.pos]}">${x.pos}</span>${esc(x.nome)} <b>${x.nota}</b><small>${h ? h.valor : 0}</small></li>`; }).join('') || '<li class="lc-dica">Nenhum atleta ainda.</li>'}</ul></section>`;
        let centro;
        if (lt) {
          centro = `<div class="lc-lote">
            <p class="lc-vez" style="--c:${JOG_COR[vez].cor}" role="status">${JOG_COR[vez].ico} Vez de <b>${esc(jv.nome)}</b>: ${lt.lider === null ? (lt.passes ? 'o outro passou. Dar o primeiro lance ou passar também?' : 'abrir o leilão ou passar') : `cobrir ${lt.lance} de ${esc(L.jog[lt.lider].nome)} ou desistir`}</p>
            ${cartao(a, { cls: 'grande' })}
            <div class="lc-lance-atual"><small>Lance atual</small><b class="${anim === 'lance' ? 'pulo' : ''}">${lt.lance ? lt.lance : '—'}</b><small>${lt.lider !== null ? 'de ' + esc(L.jog[lt.lider].nome) : 'mínimo 1'}</small></div>
            <div class="lc-botoes-lance">
              ${pode ? [1, 5, 10].filter((d, i) => i === 0 || minimo + d - 1 <= mx).map(d => `<button class="btn" data-a="lance" data-v="${Math.min(mx, lt.lance + d)}">+${d} → ${Math.min(mx, lt.lance + d)}</button>`).join('') : ''}
              <form class="lc-lance-form" data-form="lance" novalidate><input class="jg-in" name="v" type="number" inputmode="numeric" min="${minimo}" max="${Math.max(minimo, mx)}" value="${Math.min(mx, minimo)}" aria-label="Valor do lance" ${pode ? '' : 'disabled'}><button class="btn" type="submit" ${pode ? '' : 'disabled'}>Dar lance</button></form>
              <button class="btn stop" data-a="passar">${lt.lider === null ? 'Passar' : 'Desistir'}</button>
            </div>
            <p class="lc-dica">${pode ? `Lance máximo de ${esc(jv.nome)} agora: ${mx}.` : `${esc(jv.nome)} não pode cobrir este lance (saldo, reserva para completar o time ou elenco cheio).`}</p>
          </div>`;
        } else {
          const enc = R.podeEncerrar(L), faltam = L.jog.filter(j => j.elenco.length < R.MIN_ELENCO);
          centro = `<div class="lc-lote fim"><h3>${L.fila.length ? '' : 'A fila de atletas acabou.'}</h3>
            ${faltam.length ? `<p class="lc-msg erro">${faltam.map(j => esc(j.nome)).join(' e ')} ainda não ${faltam.length > 1 ? 'têm' : 'tem'} 11 atletas.</p>
              <button class="btn" data-a="juvenis">Completar com juvenis (nota 62, sem custo)</button> <button class="btn lc-sec" data-a="amigos-novo">Reiniciar o leilão</button>` : ''}
            ${enc ? `<button class="btn big" data-a="encerrar">Encerrar leilão e escalar os times →</button>` : ''}</div>`;
        }
        const enc = L.lote && L.jog.every(j => j.elenco.length >= R.MIN_ELENCO);
        el.innerHTML = `<div class="lc lc-leilao">
          <div class="lc-topo"><button class="btn small lc-sec" data-a="menu">← Menu do jogo</button><span>Atleta ${L.loteN} · ${L.fila.length} na fila · ${L.vendidos} vendidos</span>
            ${enc ? `<button class="btn small" data-a="encerrar">Encerrar leilão agora</button>` : ''}</div>
          ${aviso()}
          <div class="lc-leilao-grid">${coluna(L.jog[0], 0)}${centro}${coluna(L.jog[1], 1)}</div>
          <div class="lc-leilao-rodape">
            <details open><summary>Histórico</summary><ol class="lc-hist">${L.historico.slice(-12).reverse().map(h => {
              const a2 = R.atleta(h.id), nm = a2 ? esc(a2.nome) : '';
              return `<li>${h.tipo === 'lance' ? `${JOG_COR[h.k].ico} ${esc(L.jog[h.k].nome)} ofereceu ${h.valor} por ${nm}` : h.tipo === 'compra' ? `🔨 <b>${nm}</b> vendido para ${esc(L.jog[h.k].nome)} por ${h.valor}` : h.tipo === 'passou' ? `${JOG_COR[h.k].ico} ${esc(L.jog[h.k].nome)} passou em ${nm}` : h.tipo === 'fimdafila' ? `↩️ ${nm} sem lances: volta para o fim da fila` : `🚫 ${nm} saiu do leilão sem comprador`}</li>`;
            }).join('') || '<li>Nenhum lance ainda.</li>'}</ol></details>
            <details><summary>Próximos atletas (${L.fila.length})</summary><p class="lc-fila">${L.fila.map(id => { const x = R.atleta(id); return `<span><span class="lc-pos" style="--c:${COR_POS[x.pos]}">${x.pos}</span> ${esc(x.nome)} ${x.nota}</span>`; }).join(' ')}</p></details>
          </div></div>`;
        anim = null;
      }
      function telaAmigosEscalacao() {
        tela = 'amigos-esc'; pararPartida();
        const L = S.amigos, k = L.jog[0].pronto ? 1 : 0, j = L.jog[k];
        el.innerHTML = `<div class="lc lc-amigos-esc">
          <div class="lc-topo"><button class="btn small lc-sec" data-a="menu">← Menu do jogo</button>
            <p class="lc-vez" style="--c:${JOG_COR[k].cor}">${JOG_COR[k].ico} <b>${esc(j.nome)}</b> monta o time (${k + 1} de 2)</p></div>
          ${aviso()}
          ${escalacaoHtml(j, true, 'amigos')}
          <div class="lc-res-btns"><button class="btn big" data-a="pronto">${k === 0 ? `Pronto! Vez de ${esc(L.jog[1].nome)} →` : 'Pronto! Começar a partida ⚽'}</button></div></div>`;
      }
      function jogarAmigos() {
        const L = S.amigos;
        if (!L.partida) { L.partida = { seed: R.novaSemente() }; salvar(); }
        const cfg = { a: defTime(L.jog[0], L.jog[0].nome, JOG_COR[0]), b: defTime(L.jog[1], L.jog[1].nome, JOG_COR[1]), seed: L.partida.seed, desempate: 'penaltis' };
        L.etapa = 'partida'; salvar();
        telaPartida(cfg, 'Leilão entre Amigos', r => {
          L.ultimo = { r, nomes: [cfg.a.nome, cfg.b.nome] }; L.etapa = 'fim'; const chave = 'partida:' + L.partida.seed; L.partida = null; salvar();
          evento(chave, { tipo: 'partida', partida: true, modo: 'amigos', saldo: Math.abs(r.placar[0] - r.placar[1]) }, L);
          telaAmigosFim();
        });
      }
      function telaAmigosFim() {
        tela = 'amigos-fim'; pararPartida();
        const L = S.amigos; if (!L.ultimo) { L.etapa = 'escalacao'; L.jog.forEach(j => { j.pronto = false; }); salvar(); return telaAmigosEscalacao(); }
        const u = L.ultimo, v = u.r.vencedor;
        const topo = `<div class="lc-res-topo vit"><div class="big-emoji">🏆</div><h2>${esc(u.nomes[v])} venceu${u.r.penaltis ? ' nos pênaltis' : ''}!</h2></div>`;
        el.innerHTML = resultadoHtml(u.r, u.nomes, topo, `<button class="btn big" data-a="revanche">🔁 Revanche (mesmos elencos)</button> <button class="btn" data-a="amigos-novo">Novo leilão</button> <button class="btn lc-sec" data-a="menu">Menu do jogo</button>`);
        WowGames.confetti(el, ['⚽', '🔨', '✨']);
      }

      /* ======================= Ações ======================= */
      function timeEditado() { return tela === 'copa' ? S.campanha : tela === 'amigos-esc' ? S.amigos.jog[S.amigos.jog[0].pronto ? 1 : 0] : null; }
      function redesenhar() { if (tela === 'copa') telaCopa(); else if (tela === 'amigos-esc') telaAmigosEscalacao(); else if (tela === 'leilao') telaLeilao(); else telaMenu(); }
      function ligarEventos() {
        el.onclick = e => {
          if (!vivo) return;
          const ab = e.target.closest('[data-aba]'); if (ab) { aba = ab.dataset.aba; slotSel = null; msg = null; return telaCopa(); }
          const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
          const a = b.dataset.a, id = b.dataset.id;
          if (a === 'som') return;
          msg = null;
          if (a === 'menu') return telaMenu();
          if (a === 'copa-nova') {
            if (S.campanha && S.campanha.etapa !== 'fim' && !confirmarTroca('copa', b)) return;
            S.campanha = R.novaCampanha(); S.campanha.nomeTime = 'Meu Time'; S.campanha.uniforme = 'azul'; aba = 'mercado'; slotSel = null; salvar(); return telaCopa();
          }
          if (a === 'copa-continuar') { aba = S.campanha.etapa === 'mercado' ? 'mercado' : 'chave'; telaCopa(); return completarCopa(); }
          if (a === 'amigos-novo') { if (S.amigos && S.amigos.etapa !== 'fim' && tela !== 'leilao' && !confirmarTroca('amigos', b)) return; return telaAmigosConfig(); }
          if (a === 'amigos-continuar') { const L = S.amigos; return L.etapa === 'leilao' ? telaLeilao() : L.etapa === 'fim' ? telaAmigosFim() : L.etapa === 'partida' ? jogarAmigos() : telaAmigosEscalacao(); }
          // mercado
          if (a === 'comprar') { const r = R.comprar(S.campanha, id); msg = r.ok ? { ok: true, txt: `✅ ${R.atleta(id).nome} contratado!` } : { ok: false, txt: r.motivo }; if (r.ok) { anim = id; salvar(); } return telaCopa(); }
          if (a === 'dispensar') { const r = R.dispensar(S.campanha, id); msg = r.ok ? { ok: true, txt: `${R.atleta(id).nome} devolvido. A verba voltou.` } : { ok: false, txt: r.motivo }; if (r.ok) salvar(); return telaCopa(); }
          if (a === 'mais') { filtro.limite += 24; return telaCopa(); }
          // escalação
          const t = timeEditado();
          if (t && (a === 'slot' || a === 'por' || a === 'auto' || a === 'tirar')) {
            if (tela === 'copa' && S.campanha.partida) return;
            if (a === 'slot') { const i = +b.dataset.i; slotSel = slotSel === i ? null : i; return redesenhar(); }
            if (a === 'auto') { t.titulares = R.escalarAuto(t.elenco, t.formacao); slotSel = null; salvar(); return redesenhar(); }
            if (a === 'tirar' && slotSel !== null) { t.titulares[slotSel] = null; salvar(); return redesenhar(); }
            if (a === 'por' && slotSel !== null) {
              const j = t.titulares.indexOf(id);
              if (j >= 0) [t.titulares[slotSel], t.titulares[j]] = [t.titulares[j], t.titulares[slotSel]]; else t.titulares[slotSel] = id;
              slotSel = null; salvar(); return redesenhar();
            }
          }
          // copa
          if (a === 'sortear') {
            const c = S.campanha; if (!R.analisar(c.titulares, c.formacao).completa) return telaCopa();
            c.copa = R.sortearCopa(R.novaSemente(), c.elenco); c.etapa = 'copa'; aba = 'chave'; salvar(); return telaCopa();
          }
          if (a === 'jogar') return jogarCopa();
          if (a === 'ver-chave') { aba = 'chave'; telaCopa(); return completarCopa(); }
          // leilão
          if (a === 'lance') return lance(+b.dataset.v);
          if (a === 'passar') { const r = R.desistir(S.amigos, S.amigos.lote.vez); if (!r.ok) msg = { ok: false, txt: r.erro }; else if (r.compra) { msg = { ok: true, txt: `🔨 Vendido! ${R.atleta(r.compra.id).nome} para ${S.amigos.jog[r.compra.k].nome} por ${r.compra.valor}.` }; som('apito', S.som); } else if (r.semComprador) msg = { ok: true, txt: 'Ninguém deu lance. Próximo atleta!' }; salvar(); return telaLeilao(); }
          if (a === 'juvenis') { R.completarComJuvenis(S.amigos); salvar(); return telaLeilao(); }
          if (a === 'encerrar') {
            const L = S.amigos; if (!R.podeEncerrar(L) && L.lote) { if (L.jog.every(j => j.elenco.length >= R.MIN_ELENCO)) { L.fila.unshift(L.lote.id); L.lote = null; } }
            if (!R.podeEncerrar(L)) { msg = { ok: false, txt: 'Os dois precisam ter pelo menos 11 atletas.' }; return telaLeilao(); }
            L.etapa = 'escalacao'; L.jog.forEach(j => { j.pronto = false; if (!R.analisar(j.titulares, j.formacao).completa) j.titulares = R.escalarAuto(j.elenco, j.formacao); }); slotSel = null; salvar(); return telaAmigosEscalacao();
          }
          if (a === 'pronto') {
            const L = S.amigos, k = L.jog[0].pronto ? 1 : 0;
            if (!R.analisar(L.jog[k].titulares, L.jog[k].formacao).completa) { msg = { ok: false, txt: 'Complete os 11 titulares.' }; return telaAmigosEscalacao(); }
            L.jog[k].pronto = true; slotSel = null; salvar();
            return k === 0 ? telaAmigosEscalacao() : jogarAmigos();
          }
          if (a === 'revanche') { const L = S.amigos; L.etapa = 'escalacao'; L.ultimo = null; L.jog.forEach(j => { j.pronto = false; }); salvar(); return telaAmigosEscalacao(); }
        };
        el.onchange = e => {
          const c = e.target.dataset.campo, t = timeEditado();
          if (e.target.dataset.a === 'som') { S.som = e.target.checked; salvar(); return; }
          if (!c || c === 'busca') return;
          if (c === 'pos' || c === 'epoca' || c === 'ordem') { filtro[c] = e.target.value; filtro.limite = 24; return telaCopa(); }
          if (c === 'nomeTime') { S.campanha.nomeTime = e.target.value.trim().slice(0, 20) || 'Meu Time'; salvar(); return; }
          if (!t || (tela === 'copa' && S.campanha.partida) || !['formacao', 'estilo', 'uniforme'].includes(c)) return;
          if (c === 'formacao' && R.FORMACOES[e.target.value]) { t.formacao = e.target.value; t.titulares = R.escalarAuto(t.elenco, t.formacao); slotSel = null; }
          if (c === 'estilo' && R.ESTILOS[e.target.value]) t.estilo = e.target.value;
          if (c === 'uniforme' && CORES.some(x => x.id === e.target.value)) t.uniforme = e.target.value;
          salvar(); redesenhar();
        };
        el.oninput = e => {
          if (e.target.dataset.campo !== 'busca') return;
          filtro.busca = e.target.value; filtro.limite = 24;
          telaCopa();
          const n = el.querySelector('[data-campo="busca"]'); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (er) {} }
        };
        el.onsubmit = e => {
          e.preventDefault();
          const f = e.target.dataset.form;
          if (f === 'amigos') {
            const fd = new FormData(e.target), n1 = String(fd.get('n1')).trim().slice(0, 14) || 'Jogador 1', n2 = String(fd.get('n2')).trim().slice(0, 14) || 'Jogador 2';
            S.amigos = R.novoLeilao(R.novaSemente(), +fd.get('tam') || 40, [n1, n2 === n1 ? n2 + ' (2)' : n2]); R.abrirLote(S.amigos); salvar(); return telaLeilao();
          }
          if (f === 'lance') return lance(Number(new FormData(e.target).get('v')));
        };
      }
      function lance(v) {
        const L = S.amigos; if (!L || !L.lote) return;
        const k = L.lote.vez, r = R.darLance(L, k, v);
        msg = r.ok ? { ok: true, txt: `${JOG_COR[k].ico} ${L.jog[k].nome} ofereceu ${v}. Vez de ${L.jog[1 - k].nome}.` } : { ok: false, txt: r.erro };
        if (r.ok) { anim = 'lance'; som('lance', S.som); salvar(); }
        telaLeilao();
      }
      function confirmarTroca(tipo, b) {                                   // pede confirmação na própria página antes de apagar um progresso salvo
        if (b.dataset.confirmado) return true;
        const box = document.createElement('p'); box.className = 'lc-msg erro lc-conf';
        box.innerHTML = `${tipo === 'copa' ? 'Começar outra campanha apaga a campanha atual.' : 'Começar outro leilão apaga o leilão atual.'} <button class="btn small stop" data-a="${b.dataset.a}" data-confirmado="1">Sim, começar de novo</button>`;
        const velho = el.querySelector('.lc-conf'); if (velho) velho.remove();
        b.insertAdjacentElement('afterend', box); return false;
      }

      ligarEventos();
      telaMenu();
      return () => { vivo = false; pararPartida(); el.onclick = el.onchange = el.oninput = el.onsubmit = null; };
    }
  });
})();
