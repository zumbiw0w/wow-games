/* wow.games: LOJA (títulos, ícones, molduras e cursores). Tudo é cosmético: nada aqui dá vantagem nos jogos.
   - Gasta as MOEDAS que já existem (as da Máquina de Prêmios, guardadas em wowgames.premios.v1). Não cria nova moeda.
   - Itens comprados e equipados ficam no PERFIL (P.loja, em wowgames.perfil.v1), por isso já entram no código de recuperação.
   - Abre como uma janela por cima da página (sem recarregar e sem página nova), a partir de qualquer botão com data-loja.
   Para adicionar um item novo, basta incluir uma linha em ITENS. */
(function () {
  const Perfil = WowGames.Perfil;
  const PREMIOS_KEY = 'wowgames.premios.v1';      // onde a Máquina de Prêmios guarda as moedas
  const fmt = n => Math.floor(n || 0).toLocaleString('pt-BR');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CATS = [
    { id: 'titulo', nome: 'Títulos', icone: '🎖️', vazio: 'Aparece embaixo do seu nome no perfil.' },
    { id: 'icone', nome: 'Ícones', icone: '🖼️', vazio: 'Substitui o avatar do perfil enquanto estiver equipado.' },
    { id: 'moldura', nome: 'Molduras', icone: '🪟', vazio: 'Contorno em volta do ícone do perfil.' },
    { id: 'cursor', nome: 'Cursores', icone: '🖱️', vazio: 'Troca o cursor do mouse. Funciona em computador com mouse (no celular não existe cursor).' }
  ];

  /* ---------- Catálogo ----------
     Faixas de preço (a Máquina rende em média ~22 moedas por giro, então 500 moedas = ~25 giros e 60.000 = ~2.700 giros):
     básico até 1.500 | intermediário até 7.500 | especial até 30.000 | extremo acima disso */
  const T = (id, icone, nome, preco, desc) => ({ id: 't-' + id, cat: 'titulo', icone, nome, preco, desc });
  const I = (id, emoji, nome, preco, desc) => ({ id: 'i-' + id, cat: 'icone', emoji, nome, preco, desc });
  const M = (id, nome, preco, desc) => ({ id: 'm-' + id, cat: 'moldura', cls: id, nome, preco, desc });
  const C = (id, emoji, nome, preco, desc) => ({ id: 'c-' + id, cat: 'cursor', cls: id, emoji, nome, preco, desc });
  const ITENS = [
    T('iniciante', '🌱', 'Iniciante', 500, 'Todo mundo começa em algum lugar.'),
    T('velocista', '⚡', 'Velocista', 1000, 'Para quem não gosta de esperar.'),
    T('detetive', '🔎', 'Detetive', 1500, 'Nenhuma pista passa despercebida.'),
    T('sortudo', '🍀', 'Sortudo', 2000, 'A máquina parece gostar de você.'),
    T('especialista', '🎯', 'Especialista', 3000, 'Sabe o que está fazendo.'),
    T('veterano', '🎖️', 'Veterano', 5000, 'Já viu de tudo por aqui.'),
    T('mestrejogos', '🎮', 'Mestre dos Jogos', 10000, 'Domina todos os minijogos.'),
    T('mestremaquina', '🎁', 'Mestre da Máquina', 15000, 'Conhece cada giro da Máquina de Prêmios.'),
    T('milionario', '💰', 'Milionário', 25000, 'Dinheiro virtual, orgulho de verdade.'),
    T('lenda', '🌌', 'Lenda do wow.games', 60000, 'O título mais raro da loja.'),

    I('controle', '🎮', 'Controle', 500, 'O clássico.'),
    I('alvo', '🎯', 'Alvo', 750, 'Na mosca.'),
    I('cerebro', '🧠', 'Cérebro', 1000, 'Para as mentes rápidas.'),
    I('raio', '⚡', 'Raio', 1500, 'Energia pura.'),
    I('fogo', '🔥', 'Fogo', 3000, 'Está pegando fogo.'),
    I('fantasma', '👻', 'Fantasma', 4000, 'Buuu!'),
    I('robo', '🤖', 'Robô', 5000, 'Bip bop, partida iniciada.'),
    I('estrela', '🌟', 'Estrela', 7500, 'Brilha em qualquer lugar.'),
    I('coroa', '👑', 'Coroa', 15000, 'Para quem manda no pedaço.'),
    I('diamante', '💎', 'Diamante', 25000, 'Raro e brilhante.'),
    I('trofeu', '🏆', 'Troféu', 30000, 'Prova de campeão.'),
    I('planeta', '🪐', 'Planeta', 60000, 'Um mundo só seu.'),

    M('simples', 'Moldura simples', 500, 'Um contorno limpo e discreto.'),
    M('azul', 'Moldura azul', 1500, 'Azul céu, com brilho suave.'),
    M('dourada', 'Moldura dourada', 4000, 'Ouro de verdade (virtual).'),
    M('neon', 'Moldura neon', 7500, 'Luz que pulsa no escuro.'),
    M('fogo', 'Moldura de fogo', 12000, 'Chamas em movimento.'),
    M('galactica', 'Moldura galáctica', 20000, 'Cores do espaço profundo.'),
    M('lendaria', 'Moldura lendária', 35000, 'Dourado reluzente e animado.'),
    M('mitica', 'Moldura mítica', 75000, 'A moldura mais rara do site.'),

    C('oculos', '🕶️', 'Cursor com óculos de sol', 1000, 'Sempre na moda.'),
    C('pirata', '🏴‍☠️', 'Cursor de pirata', 2000, 'Rumo ao tesouro.'),
    C('fantasma', '👻', 'Cursor fantasma', 3500, 'Flutua suavemente.'),
    C('robo', '🤖', 'Cursor robô', 5000, 'Precisão mecânica.'),
    C('real', '👑', 'Cursor real', 7500, 'Clique com realeza.'),
    C('eletrico', '⚡', 'Cursor elétrico', 10000, 'Faíscas em cada movimento.'),
    C('chamas', '🔥', 'Cursor em chamas', 15000, 'Esquenta por onde passa.'),
    C('diamante', '💎', 'Cursor diamante', 25000, 'Brilha sem parar.'),
    C('galactico', '🌌', 'Cursor galáctico', 40000, 'Cores que mudam como as estrelas.'),
    C('mitico', '🪐', 'Cursor mítico', 80000, 'O cursor mais raro do site.')
  ];
  const itemDe = id => ITENS.find(i => i.id === id) || null;
  const tierDe = p => p <= 1500 ? { id: 'basico', nome: 'Básico' } : p <= 7500 ? { id: 'inter', nome: 'Intermediário' } : p <= 30000 ? { id: 'especial', nome: 'Especial' } : { id: 'extremo', nome: 'Extremo' };

  /* ---------- Moedas (as mesmas da Máquina de Prêmios) ---------- */
  function lerPremios() { try { return JSON.parse(localStorage.getItem(PREMIOS_KEY)) || null; } catch (e) { return null; } }
  const moedas = () => { const s = lerPremios(); return Math.max(0, Math.floor(Number(s && s.moedas) || 0)); };

  /* ---------- Estado no perfil ---------- */
  const dados = () => Perfil.dados();
  const equipadoDe = (P, cat) => { const it = itemDe(P.loja.equipado[cat]); return it && it.cat === cat && P.loja.comprados[it.id] ? it : null; };   // só vale se foi comprado

  function comprar(id) {
    const it = itemDe(id);
    if (!it) return { ok: false, msg: 'Item não encontrado.' };
    const P = dados();
    if (P.loja.comprados[id]) return { ok: false, msg: 'Você já tem este item.' };                // um item não pode ser comprado duas vezes
    const s = lerPremios(), saldo = moedas();
    if (!s || saldo < it.preco) return { ok: false, falta: true, msg: `Faltam ${fmt(it.preco - saldo)} moedas para comprar ${it.nome} (${fmt(it.preco)} 🪙). Você tem ${fmt(saldo)}.` };
    try { localStorage.setItem(PREMIOS_KEY, JSON.stringify(Object.assign({}, s, { moedas: s.moedas - it.preco }))); }
    catch (e) { return { ok: false, msg: 'Não foi possível salvar a compra. Nada foi cobrado.' }; }
    Perfil.atualizar(Q => { Q.loja.comprados[id] = new Date().toISOString(); });
    if (!dados().loja.comprados[id]) {                                                          // se o perfil não gravou, devolve as moedas
      try { localStorage.setItem(PREMIOS_KEY, JSON.stringify(s)); } catch (e) {}
      return { ok: false, msg: 'Não foi possível salvar a compra no perfil. Suas moedas foram devolvidas.' };
    }
    return { ok: true, msg: `✅ Compra feita! ${it.nome} agora é seu. Você ainda tem ${fmt(moedas())} 🪙.`, id };
  }
  function equipar(id) {
    const it = itemDe(id), P = dados();
    if (!it || !P.loja.comprados[id]) return false;
    Perfil.atualizar(Q => { Q.loja.equipado[it.cat] = id; });                                    // só um item por categoria
    if (it.cat === 'cursor') aplicarCursor();
    return true;
  }
  function desequipar(cat) {
    Perfil.atualizar(Q => { delete Q.loja.equipado[cat]; });
    if (cat === 'cursor') aplicarCursor();
  }

  /* ---------- Aparência no perfil ---------- */
  function avatar(P, grande) {
    const ico = equipadoDe(P, 'icone'), mol = equipadoDe(P, 'moldura');
    const miolo = `<span class="pf-av ${grande ? 'grande' : ''}">${ico ? ico.emoji : P.avatar}</span>`;
    return `<span class="lj-av ${mol ? 'f m-' + mol.cls : ''}" ${mol ? `data-moldura="${mol.cls}"` : ''}>${miolo}</span>`;
  }
  function tituloHtml(P) { const t = equipadoDe(P, 'titulo'); return t ? `<small class="lj-titulo">${t.icone} ${esc(t.nome)}</small>` : ''; }
  const botaoHtml = () => `<button type="button" class="btn lj-abrir" data-loja aria-haspopup="dialog">🛒 LOJA<small>🪙 ${fmt(moedas())}</small></button>`;

  /* ---------- Cursor personalizado (só computador com mouse) ----------
     Um elemento leve acompanha o mouse (1 elemento, só transform; os efeitos são animações CSS). O cursor do sistema só é escondido
     depois do primeiro movimento do mouse, então nunca fica sem cursor visível. */
  let cur = null, curId = null, curX = 0, curY = 0, curRaf = 0, curVisivel = false, curLigado = false;
  const comMouse = () => { try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; } };
  function mover(e) { if (e.pointerType && e.pointerType !== 'mouse') return; curX = e.clientX; curY = e.clientY; if (!curRaf) curRaf = requestAnimationFrame(pintar); }
  function pintar() {
    curRaf = 0; if (!cur) return;
    cur.style.transform = `translate3d(${curX}px,${curY}px,0)`;
    if (!curVisivel) { curVisivel = true; cur.style.opacity = '1'; document.body.classList.add('lj-cursor-on'); }
  }
  const clicar = () => { if (cur) cur.classList.add('clica'); };
  const soltar = () => { if (cur) cur.classList.remove('clica'); };
  const sumir = () => { if (cur) { cur.style.opacity = '0'; curVisivel = false; document.body.classList.remove('lj-cursor-on'); } };
  function removerCursor() {
    if (cur) { cur.remove(); cur = null; }
    curId = null; curVisivel = false; document.body.classList.remove('lj-cursor-on');
    if (curLigado) {
      document.removeEventListener('pointermove', mover); document.removeEventListener('pointerdown', clicar); document.removeEventListener('pointerup', soltar);
      document.documentElement.removeEventListener('mouseleave', sumir); curLigado = false;
    }
  }
  function aplicarCursor() {
    try {
      const it = equipadoDe(dados(), 'cursor');
      if (!it || !comMouse()) return removerCursor();
      if (cur && curId === it.id) return;
      removerCursor();
      cur = document.createElement('div');
      cur.id = 'lj-cursor'; cur.className = 'lj-cursor fx-' + it.cls; cur.setAttribute('aria-hidden', 'true'); cur.style.opacity = '0';
      cur.innerHTML = `<span>${it.emoji}</span><i></i>`;
      document.body.appendChild(cur); curId = it.id;
      document.addEventListener('pointermove', mover, { passive: true }); document.addEventListener('pointerdown', clicar); document.addEventListener('pointerup', soltar);
      document.documentElement.addEventListener('mouseleave', sumir); curLigado = true;
    } catch (e) { console.error('[wow.games] Erro no cursor da loja:', e); removerCursor(); }
  }

  /* ---------- Janela da loja ---------- */
  let fundo = null, aba = 'titulo', msg = null, voltarFoco = null;
  function previa(it, P) {
    if (it.cat === 'titulo') return `<span class="lj-tit-prev">${it.icone} ${esc(it.nome)}</span>`;
    if (it.cat === 'icone') return `<span class="lj-ico-prev">${it.emoji}</span>`;
    if (it.cat === 'moldura') { const ico = equipadoDe(P, 'icone'); return `<span class="lj-av f m-${it.cls}"><span class="pf-av grande">${ico ? ico.emoji : P.avatar}</span></span>`; }
    return `<span class="lj-cur-prev fx-${it.cls}">${it.emoji}</span>`;
  }
  function card(it, P, saldo) {
    const tem = !!P.loja.comprados[it.id], eq = tem && P.loja.equipado[it.cat] === it.id, t = tierDe(it.preco), falta = !tem && saldo < it.preco;
    const acao = tem
      ? `<button type="button" class="btn small lj-b" data-lj="${eq ? 'desequipar' : 'equipar'}" data-id="${it.id}">${eq ? 'DESEQUIPAR' : 'EQUIPAR'}</button>`
      : `<button type="button" class="btn small lj-b lj-comprar ${falta ? 'falta' : ''}" data-lj="comprar" data-id="${it.id}">COMPRAR · 🪙 ${fmt(it.preco)}</button>`;
    return `<article class="lj-card t-${t.id} ${tem ? 'tem' : 'bloq'} ${eq ? 'eq' : ''}" data-item="${it.id}">
      <div class="lj-prev">${previa(it, P)}</div>
      <h4>${esc(it.nome)}</h4><small class="lj-tier">${t.nome}</small>
      <p>${esc(it.desc)}</p>
      <div class="lj-estado">${eq ? '<b class="lj-eq">✓ EQUIPADO</b>' : tem ? '<b class="lj-ok">✔ COMPRADO</b>' : falta ? `<small class="lj-falta">🔒 Faltam ${fmt(it.preco - saldo)} moedas</small>` : '<small>🔒 À venda</small>'}</div>
      ${acao}</article>`;
  }
  function desenhar() {
    if (!fundo) return;
    const P = dados(), saldo = moedas(), cat = CATS.find(c => c.id === aba), lista = ITENS.filter(i => i.cat === aba).sort((a, b) => a.preco - b.preco);
    const donos = ITENS.filter(i => P.loja.comprados[i.id]).length;
    fundo.querySelector('.lj').innerHTML = `
      <header class="lj-topo"><h2 id="lj-titulo">🛒 Loja</h2><button type="button" class="btn small lj-fechar" data-lj="fechar" aria-label="Fechar loja">✕</button></header>
      <div class="lj-perfil">${avatar(P, true)}<div><b>${esc(P.nome)}</b>${tituloHtml(P)}<small>🏆 Pontuação: ${fmt(P.pontuacao)}</small></div>
        <div class="lj-saldo" aria-live="polite"><small>Suas moedas</small><b>🪙 ${fmt(saldo)}</b><small>${donos}/${ITENS.length} itens</small></div></div>
      <nav class="lj-abas" role="tablist">${CATS.map(c => `<button type="button" role="tab" aria-selected="${c.id === aba}" class="lj-aba ${c.id === aba ? 'on' : ''}" data-aba="${c.id}">${c.icone} ${c.nome}</button>`).join('')}</nav>
      <p class="lj-msg ${msg ? (msg.ok ? 'ok' : 'erro') : ''}" role="status" aria-live="polite">${msg ? esc(msg.txt) + (msg.id && msg.ok ? ` <button type="button" class="btn small" data-lj="equipar" data-id="${msg.id}">EQUIPAR AGORA</button>` : '') : esc(cat.vazio)}</p>
      <div class="lj-grade">${lista.map(i => card(i, P, saldo)).join('')}</div>
      <p class="lj-rodape">As moedas são as da Máquina de Prêmios (você ganha com itens repetidos). Tudo aqui é só visual e não dá vantagem nos jogos.</p>`;
  }
  function agir(a, id) {
    if (a === 'fechar') return fechar();
    const it = itemDe(id);
    if (a === 'comprar') {
      if (it && it.preco >= 10000 && !dados().loja.comprados[id] && moedas() >= it.preco && !confirm(`Comprar ${it.nome} por ${fmt(it.preco)} moedas?`)) return;   // itens caros pedem confirmação
      const r = comprar(id); msg = { ok: r.ok, txt: r.msg, id: r.ok ? id : null };
    }
    if (a === 'equipar' && it) { equipar(id); msg = { ok: true, txt: `${it.nome} equipado.` }; }
    if (a === 'desequipar' && it) { desequipar(it.cat); msg = { ok: true, txt: `${it.nome} desequipado.` }; }
    desenhar();
  }
  function tecla(e) {
    if (!fundo) return;
    if (e.key === 'Escape') { e.preventDefault(); return fechar(); }
    if (e.key === 'Tab') {                                                                       // mantém o foco dentro da janela
      const fs = [...fundo.querySelectorAll('button:not([disabled])')]; if (!fs.length) return;
      const a = fs[0], z = fs[fs.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  }
  function abrir(origem) {
    if (fundo) return;
    voltarFoco = origem || document.activeElement; msg = null;
    fundo = document.createElement('div');
    fundo.className = 'lj-fundo'; fundo.id = 'lj';
    fundo.innerHTML = '<div class="lj" role="dialog" aria-modal="true" aria-labelledby="lj-titulo"></div>';
    fundo.addEventListener('click', e => {
      if (e.target === fundo) return fechar();
      const a = e.target.closest('[data-aba]'); if (a) { aba = a.dataset.aba; msg = null; return desenhar(); }
      const b = e.target.closest('[data-lj]'); if (b) agir(b.dataset.lj, b.dataset.id);
    });
    document.body.appendChild(fundo); document.body.classList.add('lj-aberto');
    document.addEventListener('keydown', tecla);
    desenhar();
    const f = fundo.querySelector('.lj-fechar'); if (f) f.focus();
  }
  function fechar() {
    if (!fundo) return;
    fundo.remove(); fundo = null; document.body.classList.remove('lj-aberto'); document.removeEventListener('keydown', tecla);
    WowGames.recarregar && WowGames.recarregar();                                                // atualiza a faixa do perfil / página de perfil
    try { if (voltarFoco && document.contains(voltarFoco)) voltarFoco.focus(); } catch (e) {}
  }

  document.addEventListener('click', e => { const b = e.target.closest('[data-loja]'); if (b) { e.preventDefault(); abrir(b); } });
  window.addEventListener('hashchange', () => { if (fundo) { fundo.remove(); fundo = null; document.body.classList.remove('lj-aberto'); document.removeEventListener('keydown', tecla); } aplicarCursor(); });
  window.addEventListener('storage', aplicarCursor);
  document.addEventListener('DOMContentLoaded', aplicarCursor);
  aplicarCursor();

  WowGames.Loja = { ITENS, CATS, itemDe, tierDe, moedas, comprar, equipar, desequipar, abrir, fechar, avatar, tituloHtml, botaoHtml, aplicarCursor, equipadoDe };
})();
