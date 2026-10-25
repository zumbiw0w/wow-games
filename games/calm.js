/* Jogo: wow.calm — um clicker relaxante. Junte serenidade tocando no núcleo de luz e monte, aos poucos, um refúgio tranquilo.
   - Dados e balanceamento: games/calm-dados.js · Sons sintetizados: games/calm-som.js
   - Salvamento próprio em wowgames.calm.v1 (entra automaticamente no código de recuperação, como as outras chaves wowgames.*).
   - A produção automática só acontece com o jogo aberto e a aba visível. Não existe produção offline, renascimento ou prestígio.
   - A serenidade NÃO é moeda do site: não muda o saldo da Máquina de Prêmios nem compra nada na Loja.
   - Integração: XP, recordes, conquistas e pontuação pelo mesmo WowGames.evento usado pelos outros jogos, cada marco uma única vez. */
(function () {
  const D = WowGames.CalmDados, Som = WowGames.CalmSom;
  if (!D || !Som) { console.error('[wow.calm] calm-dados.js e calm-som.js precisam ser carregados antes de calm.js.'); return; }
  const ID = 'calm', CHAVE = 'wowgames.calm.v1', SALVAR_MS = 10000;
  const TOTAL_ITENS = D.ITENS.length, SONS_ITENS = D.ITENS.filter(i => i.cat === 'som');
  const SONS_PADRAO = { chuva: true, chuvaforte: false, ruido: true, lareira: true, paginas: true, asmr: true, despejar: true, musica: true };
  const VOL_PADRAO = { mudo: true, ambiente: .6, efeitos: .6, musica: .5 };

  /* ---------- Salvamento (com validação de dados antigos ou inválidos) ---------- */
  const num = (v, min, max, pad) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : pad);
  function padrao() {
    return { v: 1, ser: 0, total: 0, cliques: 0, niv: {}, intro: false, atm: 'tarde', parede: 'creme', sons: Object.assign({}, SONS_PADRAO),
      vol: Object.assign({}, VOL_PADRAO), enviados: {}, tempo: 0, fimTempo: 0, refeicoes: 0, mudouAtm: false, mudouParede: false, finalVisto: false };
  }
  function validar(o) {
    const s = padrao();
    if (!o || typeof o !== 'object') return s;
    s.ser = num(o.ser, 0, 1e13, 0); s.total = Math.max(s.ser, num(o.total, 0, 1e14, 0)); s.cliques = Math.floor(num(o.cliques, 0, 1e9, 0));
    s.tempo = num(o.tempo, 0, 1e8, 0); s.fimTempo = num(o.fimTempo, 0, 1e8, 0); s.refeicoes = Math.floor(num(o.refeicoes, 0, 1e6, 0));
    if (o.niv && typeof o.niv === 'object') D.ITENS.forEach(it => { const n = Math.floor(num(o.niv[it.id], 0, it.max, 0)); if (n > 0) s.niv[it.id] = n; });
    s.intro = !!o.intro; s.mudouAtm = !!o.mudouAtm; s.mudouParede = !!o.mudouParede; s.finalVisto = !!o.finalVisto;
    if (D.ATMOSFERAS.some(a => a.id === o.atm)) s.atm = o.atm;
    if (D.PAREDES.some(p => p.id === o.parede)) s.parede = o.parede;
    if (o.sons && typeof o.sons === 'object') Object.keys(SONS_PADRAO).forEach(k => { if (typeof o.sons[k] === 'boolean') s.sons[k] = o.sons[k]; });
    if (o.vol && typeof o.vol === 'object') { s.vol.mudo = o.vol.mudo !== false; ['ambiente', 'efeitos', 'musica'].forEach(k => { s.vol[k] = num(o.vol[k], 0, 1, VOL_PADRAO[k]); }); }
    if (o.enviados && typeof o.enviados === 'object') Object.keys(o.enviados).forEach(k => { if (o.enviados[k] === true) s.enviados[k] = true; });
    return s;
  }
  function ler() {
    let bruto = null;
    try { bruto = localStorage.getItem(CHAVE); } catch (e) { return padrao(); }
    if (!bruto) return padrao();
    try {
      const o = JSON.parse(bruto);
      if (o && o.v === 1) return validar(o);
    } catch (e) {}
    // Dado ilegível ou de outra versão: guarda uma cópia (nunca apaga) e começa um refúgio novo
    try { if (!localStorage.getItem(CHAVE + '.copia')) localStorage.setItem(CHAVE + '.copia', bruto); } catch (e) {}
    console.warn('[wow.calm] Salvamento inválido; uma cópia foi guardada em ' + CHAVE + '.copia.');
    return padrao();
  }
  function gravar(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); return true; } catch (e) { console.error('[wow.calm] Não foi possível salvar.', e); return false; } }

  /* ---------- Integração: XP, recordes, conquistas e pontuação ---------- */
  const Perfil = WowGames.Perfil;
  const minutos = v => { const m = Math.floor(v / 60), s = Math.round(v % 60); return m + 'min' + String(s).padStart(2, '0'); };
  if (Perfil) {
    Perfil.registrarJogo({ id: ID, nome: 'wow.calm', icone: '🕯️',
      xp: ev => ev.tipo === 'primeiro' ? 10 : ev.tipo === 'etapa' ? 30 : ev.tipo === 'final' ? 200 : 0,
      recordes: [{ id: 'etapa', rotulo: 'wow.calm: etapa do refúgio', melhor: 'maior', valor: ev => ev.tipo === 'etapa' || ev.tipo === 'final' ? ev.etapa : null, fmt: v => 'Etapa ' + v + ' de 5' },
                 { id: 'tempo', rotulo: 'wow.calm: refúgio completo em', melhor: 'menor', valor: ev => ev.tipo === 'final' ? ev.tempo : null, fmt: minutos }] });
    const deCalm = (tipo, f) => ev => ev.jogo === ID && ev.tipo === tipo && (!f || f(ev));
    [
      { id: 'calmrespiro', icone: '🌬️', nome: 'Primeiro Respiro', desc: 'Toque no núcleo de luz pela primeira vez no wow.calm.', xp: 30, ok: deCalm('primeiro') },
      { id: 'calmcha', icone: '🍵', nome: 'Chá Quentinho', desc: 'Prepare o primeiro chá do seu refúgio no wow.calm.', xp: 40, ok: deCalm('item', ev => ev.item === 'cha') },
      { id: 'calmchuva', icone: '🌧️', nome: 'Chuva na Janela', desc: 'Libere o som de chuva fraca na janela no wow.calm.', xp: 60, ok: deCalm('item', ev => ev.item === 'chuvafraca') },
      { id: 'calmsons', icone: '🎧', nome: 'Sons de Conforto', desc: 'Libere 4 sons diferentes no wow.calm.', xp: 70, ok: deCalm('item', ev => ev.nSons >= 4) },
      { id: 'calmverde', icone: '🌿', nome: 'Cantinho Verde', desc: 'Plante o jardim contemplativo no wow.calm.', xp: 70, ok: deCalm('item', ev => ev.item === 'jardim') },
      { id: 'calmlamen', icone: '🍜', nome: 'Hora do Lámen', desc: 'Prepare e saboreie uma refeição no cantinho de culinária do wow.calm.', xp: 60, ok: deCalm('refeicao') },
      { id: 'calmconstrucao', icone: '🏡', nome: 'Refúgio em Construção', desc: 'Chegue à etapa “Seu próprio refúgio” no wow.calm.', xp: 80, ok: deCalm('etapa', ev => ev.etapa >= 4) },
      { id: 'calmcompleto', icone: '🏮', nome: 'Refúgio Completo', desc: 'Acenda a Lanterna do Refúgio e complete a jornada do wow.calm.', xp: 250, ok: deCalm('final') },
      { id: 'calmdetalhes', icone: '🎨', nome: 'Pequenos Detalhes', desc: 'Mude a cor da parede e a atmosfera do quarto no wow.calm.', xp: 40, ok: deCalm('detalhe') },
      { id: 'calmcolecao', icone: '📖', nome: 'Colecionador de Calma', desc: 'Tenha todos os ' + TOTAL_ITENS + ' itens da coleção do wow.calm, inclusive os opcionais.', xp: 200, ok: deCalm('item', ev => ev.nItens >= ev.total) }
    ].forEach(c => Perfil.registrarConquista(c));
  }
  // Pontuação global: só a conclusão do refúgio pontua (uma vez por salvamento). Cliques e itens não pontuam.
  if (WowGames.Pontos) WowGames.Pontos.registrar(ID, { limite: 1, calcula: ev => ev.tipo === 'final' ? 500 : 0, semLimite: ev => ev.tipo === 'final' });

  /* ---------- Textos auxiliares ---------- */
  const pct = v => Math.round(v * 100) + '%';
  function efeitoTxt(it) {
    const e = it.efeito, p = [], lv = it.max > 1 ? ' por nível' : '';
    if (e.clique) p.push('+' + D.fmtTaxa(e.clique) + ' por clique' + lv);
    if (e.auto) p.push('+' + D.fmtTaxa(e.auto) + '/s' + lv);
    if (e.mult) p.push('+' + pct(e.mult) + ' em tudo');
    if (e.multAuto) p.push('+' + pct(e.multAuto) + ' no automático');
    if (e.multBebidas) p.push('bebidas ×2');
    return p.join(' · ');
  }
  const SOM_ROTULOS = [
    { k: 'chuva', nome: 'Chuva fraca', item: 'chuvafraca', tipo: 'ambiente' }, { k: 'chuvaforte', nome: 'Chuva intensa', item: 'chuvaforte', tipo: 'ambiente' },
    { k: 'ruido', nome: 'Ruído ambiente', item: 'ruido', tipo: 'ambiente' }, { k: 'lareira', nome: 'Lenha estalando', item: 'lareira', tipo: 'ambiente' },
    { k: 'paginas', nome: 'Páginas virando', item: 'paginas', tipo: 'textura' }, { k: 'asmr', nome: 'Toques suaves (ASMR)', item: 'asmr', tipo: 'textura' },
    { k: 'despejar', nome: 'Água na xícara', item: 'despejar', tipo: 'efeito' }, { k: 'musica', nome: 'Música ambiente', item: 'musica', tipo: 'musica' }
  ];
  // Itens com elemento próprio no quarto. Os outros aparecem na prateleira.
  const NA_CENA = ['luminaria', 'caneca', 'almofada', 'cha', 'livros', 'cobertor', 'janela', 'luzes', 'plantas', 'poltrona', 'leitura', 'tapete', 'jardim', 'aquario', 'lareira', 'claraboia', 'lanterna', 'gato', 'mobile', 'culinaria'];
  const NA_PRATELEIRA = D.ITENS.filter(i => !NA_CENA.includes(i.id) && i.id !== 'nucleo' && i.id !== 'respiro');

  function cenaHtml() {
    const o = (id, html = '', extra = '') => `<div class="calm-o calm-${id}" data-o="${id}" ${extra}>${html}</div>`;
    const vapor = '<i class="calm-vapor"></i><i class="calm-vapor v2"></i>';
    return `
      <div class="calm-luz-quente"></div>
      ${o('claraboia', '<i></i><i></i><i></i><i></i><i></i><i></i>')}
      ${o('luzes', Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join(''))}
      ${o('janela', '<div class="calm-vidro"><div class="calm-chuva"></div><div class="calm-ceu-est"></div></div><div class="calm-parapeito"></div>')}
      ${o('plantas', '<span>🪴</span><span>🌱</span><span>🪴</span>')}
      ${o('mobile', '<div><span>🌙</span><span>⭐</span><span>⭐</span></div>')}
      ${o('lanterna', '<span>🏮</span>')}
      <div class="calm-prateleira">${NA_PRATELEIRA.map(i => `<span class="calm-o calm-p" data-o="${i.id}" title="${i.nome}">${i.icone}</span>`).join('')}</div>
      <div class="calm-notas" aria-hidden="true"><i>♪</i><i>♫</i><i>♪</i></div>
      <div class="calm-chao"></div>
      ${o('tapete')}
      ${o('aquario', '<div class="calm-agua"><span class="calm-peixe">🐠</span><span class="calm-peixe p2">🐟</span><i class="calm-bolha"></i><i class="calm-bolha b2"></i></div>')}
      ${o('lareira', '<div class="calm-fogo"><i></i><i></i><i></i></div>')}
      ${o('jardim', Array.from({ length: 6 }, (_, i) => `<span data-j="${i}">${['🌿', '🌷', '🌱', '🌼', '🌿', '🪻'][i]}</span>`).join(''))}
      ${o('livros', '<span>📚</span>')}
      ${o('almofada', '<i></i>')}
      ${o('gato', '<span>🐈</span><small>z</small>')}
      ${o('poltrona', '<span>🛋️</span>')}
      ${o('cobertor', '<i></i>')}
      ${o('leitura', '<div class="calm-livro"><i></i><i class="calm-folha"></i></div>')}
      <div class="calm-mesa calm-o" data-o="mesa"><i></i></div>
      ${o('caneca', `<span>☕</span>${vapor}`)}
      ${o('cha', `<span>🫖</span>${vapor}`)}
      ${o('luminaria', '<i class="calm-cupula"></i><i class="calm-haste"></i><i class="calm-brilho"></i>')}
      ${o('culinaria', '<span>🍳</span>', 'title="Cantinho de culinária (veja abaixo do quarto)"')}
      <div class="calm-vaga" aria-hidden="true"></div>`;
  }

  WowGames.CalmJogo = { atual: null };

  WowGames.register({
    id: ID, nome: 'wow.calm', icone: '🕯️', cor: '#c9b8f0',
    desc: 'Um clicker relaxante: junte serenidade e monte, sem pressa, um refúgio só seu.',

    mount(el) {
      let S = ler(), sujo = false, raf = 0, ultimo = 0, filtroLoja = 'todos', filtroCol = 'todos', painel = null, flutuando = 0, fimAberto = false;
      const timers = [], ouvir = new AbortController(), sinal = { signal: ouvir.signal };   // ouvintes no #stage saem junto com o jogo
      const $ = sel => el.querySelector(sel);
      const essencialFalta = new Set();
      let cache = { etapa: D.etapaAtual(S.niv), prod: D.producao(S.niv) };
      const recalcular = () => { cache = { etapa: D.etapaAtual(S.niv), prod: D.producao(S.niv) }; };
      const salvar = () => { sujo = false; gravar(S); };
      const enviar = (chave, ev) => {                        // cada marco é enviado uma única vez por salvamento
        if (S.enviados[chave]) return null;
        S.enviados[chave] = true; salvar();
        try { return WowGames.evento(Object.assign({ jogo: ID }, ev)); } catch (e) { console.error('[wow.calm] Erro ao enviar evento:', e); return null; }
      };

      el.innerHTML = `
        <div class="calm" id="calm-raiz">
          <div class="calm-topo">
            <div class="calm-saldo" aria-live="off"><small>SERENIDADE</small><b id="calm-ser">0</b><span id="calm-taxa"></span></div>
            <div class="calm-acoes">
              <button class="calm-bt" id="calm-mudo" aria-pressed="false" title="Ligar ou desligar todo o som"></button>
              <button class="calm-bt" data-painel="sons" title="Sons e volumes">🎚️ <span>Sons</span></button>
              <button class="calm-bt" data-painel="quarto" title="Atmosfera e cor da parede">🎨 <span>Quarto</span></button>
              <button class="calm-bt" data-painel="colecao" title="Coleção">📖 <span id="calm-ncol">0/${TOTAL_ITENS}</span></button>
              <button class="calm-bt" id="calm-ajuda" title="Como jogar">❔</button>
            </div>
          </div>
          <div class="calm-jornada">
            <div class="calm-etapa"><small id="calm-etn"></small><b id="calm-etnome"></b></div>
            <div class="calm-barra" role="progressbar" aria-label="Progresso da jornada" aria-valuemin="0" aria-valuemax="100"><i id="calm-barra"></i><span id="calm-pct"></span></div>
            <div class="calm-prox" id="calm-prox"></div>
          </div>
          <div class="calm-main">
            <div class="calm-col-quarto">
              <div class="calm-quarto" id="calm-quarto">
                ${cenaHtml()}
                <button class="calm-nucleo" id="calm-nucleo" aria-label="Núcleo de luz: toque para juntar serenidade"><i class="calm-anel"></i><i class="calm-centro"></i></button>
                <div class="calm-aviso" id="calm-aviso" hidden></div>
              </div>
              <div class="calm-cozinha" id="calm-cozinha" hidden>
                <div class="calm-coz-cena" id="calm-coz">
                  <div class="calm-coz-fogao"><span class="calm-panela">🍲</span><i class="calm-vapor"></i><i class="calm-vapor v2"></i><i class="calm-chama"></i></div>
                  <div class="calm-pers" aria-hidden="true"><div class="calm-cabelo"></div><div class="calm-rosto"><i class="calm-olho"></i><i class="calm-olho d"></i><i class="calm-boca"></i><i class="calm-bochecha"></i><i class="calm-bochecha d"></i></div><div class="calm-corpo"></div></div>
                  <div class="calm-coz-mesa"><span class="calm-tigela">🍜</span><span class="calm-hashi">🥢</span><i class="calm-vapor"></i></div>
                </div>
                <div class="calm-coz-info">
                  <b>🍜 Cantinho de culinária</b>
                  <p id="calm-coz-txt">Uma cozinha pequena e silenciosa. Que tal preparar algo quentinho?</p>
                  <button class="btn small" id="calm-cozinhar">Preparar uma refeição</button>
                </div>
              </div>
            </div>
            <aside class="calm-loja" aria-label="Confortos à venda">
              <div class="calm-loja-cab"><b>Confortos</b><small>A serenidade é só deste jogo e não vale como moeda do site.</small></div>
              <div class="calm-filtros" id="calm-filtros"></div>
              <div class="calm-lista" id="calm-lista"></div>
            </aside>
          </div>
          <div class="calm-painel" id="calm-painel" hidden></div>
          <div class="calm-intro" id="calm-intro" hidden></div>
          <p class="calm-rodape">A produção automática só acontece com o jogo aberto. Os sons são sintetizados no navegador e não são gravações reais.</p>
        </div>`;
      const raiz = $('#calm-raiz'), quarto = $('#calm-quarto'), nucleo = $('#calm-nucleo');

      /* ---------- Som ---------- */
      function aplicarSom() {
        if (!Som.iniciado()) return;
        Som.volumes(S.vol);
        const tem = id => (S.niv[id] || 0) > 0;
        Som.ambientes(SOM_ROTULOS.filter(r => r.tipo === 'ambiente' && S.sons[r.k] && tem(r.item)).map(r => r.k));
        Som.texturas(SOM_ROTULOS.filter(r => r.tipo === 'textura' && S.sons[r.k] && tem(r.item)).map(r => r.k));
        Som.musica(S.sons.musica && tem('musica'));
      }
      function botaoMudo() {
        const b = $('#calm-mudo'); b.textContent = S.vol.mudo ? '🔇 Som desligado' : '🔊 Som ligado'; b.setAttribute('aria-pressed', String(!S.vol.mudo));
      }
      function ligarSom(on) {
        S.vol.mudo = !on;
        if (on) Som.iniciar();                                 // sempre dentro de um clique do jogador
        aplicarSom(); botaoMudo(); salvar();
        if (painel === 'sons') abrirPainel('sons');
      }
      const efeito = nome => { if (!S.vol.mudo) Som.efeito(nome); };

      /* ---------- Quarto ---------- */
      function atualizarCena(novo) {
        const e = cache.etapa;
        quarto.className = `calm-quarto calm-e${D.concluido(S.niv) ? 6 : e} calm-atm-${S.atm}` + (D.concluido(S.niv) ? ' calm-completo' : '');
        const p = D.PAREDES.find(x => x.id === S.parede);
        quarto.style.setProperty('--parede', p.cor); quarto.style.setProperty('--chao', p.chao);
        quarto.querySelectorAll('[data-o]').forEach(n => {
          const id = n.dataset.o, on = id === 'mesa' ? !!(S.niv.caneca || S.niv.cha) : (S.niv[id] || 0) > 0;
          if (on && !n.classList.contains('on') && novo) { n.classList.add('calm-surge'); timers.push(setTimeout(() => n.classList.remove('calm-surge'), 1200)); }
          n.classList.toggle('on', on);
        });
        const nj = Math.ceil((S.niv.jardim || 0) * 6 / 15);
        quarto.querySelectorAll('[data-j]').forEach(n => n.classList.toggle('on', +n.dataset.j < nj));
        quarto.querySelector('.calm-notas').classList.toggle('on', !!S.niv.musica);
        nucleo.style.setProperty('--n', S.niv.nucleo || 0);
        nucleo.classList.toggle('calm-respira', !!S.niv.respiro);
        $('#calm-cozinha').hidden = !S.niv.culinaria;
      }

      /* ---------- Jornada ---------- */
      function atualizarJornada() {
        const fim = D.concluido(S.niv), e = cache.etapa, et = D.ETAPAS[e - 1];
        $('#calm-etn').textContent = fim ? 'Jornada concluída' : `Etapa ${e} de 5`;
        $('#calm-etnome').textContent = fim ? 'Refúgio completo 🏮' : et.nome;
        const p = Math.round(D.progresso(S.niv) * 100);
        $('#calm-barra').style.width = p + '%'; $('#calm-pct').textContent = p + '%';
        $('.calm-barra').setAttribute('aria-valuenow', String(p));
        const nCol = D.ITENS.filter(i => S.niv[i.id]).length;
        $('#calm-ncol').textContent = nCol + '/' + TOTAL_ITENS;
        atualizarProx();
      }
      function atualizarProx() {
        const box = $('#calm-prox');
        if (D.concluido(S.niv)) {
          const falt = D.ITENS.filter(i => !S.niv[i.id]).length;
          box.innerHTML = falt ? `✨ Conteúdo extra: <b>${falt} ${falt === 1 ? 'item' : 'itens'}</b> ainda faltam na coleção.` : '🌟 Coleção completa. Seu refúgio está inteiro. Fique o quanto quiser.';
          return;
        }
        const it = D.proxima(S.niv);
        if (!it) { box.textContent = ''; return; }
        const c = D.custo(it, 0), falta = Math.max(0, c - S.ser), pode = D.disponivel(it, S.niv);
        box.innerHTML = `Próxima recompensa: <b>${it.icone} ${it.nome}</b> · ` + (!pode ? 'compre os itens anteriores primeiro'
          : falta > 0 ? `faltam ${D.fmt(falta)} de serenidade` : '<span class="calm-pronto">pronta para comprar!</span>');
      }

      /* ---------- Loja ---------- */
      function montarFiltros() {
        const cats = [['todos', 'Todos']].concat(Object.entries(D.CATEGORIAS));
        $('#calm-filtros').innerHTML = cats.map(([k, n]) => `<button class="calm-chip${filtroLoja === k ? ' on' : ''}" data-fl="${k}">${n}</button>`).join('');
      }
      function montarLoja() {
        const e = cache.etapa, fim = D.concluido(S.niv);
        const lista = D.ITENS.filter(i => D.disponivel(i, S.niv) && (S.niv[i.id] || 0) < i.max && (filtroLoja === 'todos' || i.cat === filtroLoja))
          .sort((a, b) => (b.essencial && !S.niv[b.id]) - (a.essencial && !S.niv[a.id]) || a.etapa - b.etapa || a.ordem - b.ordem);
        let html = lista.map(it => {
          const n = S.niv[it.id] || 0, c = D.custo(it, n);
          return `<button class="calm-item" data-comprar="${it.id}" data-custo="${c}">
            <span class="calm-item-ico">${it.icone}</span>
            <span class="calm-item-txt"><b>${it.nome}${it.essencial && !n ? ' <em class="calm-ess" title="Essencial para avançar">★</em>' : ''}</b><small>${it.desc}</small><i>${efeitoTxt(it)}</i></span>
            <span class="calm-item-preco"><b>${D.fmt(c)}</b>${it.max > 1 ? `<small>Nível ${n}/${it.max}</small>` : ''}</span>
          </button>`;
        }).join('');
        if (!lista.length) html = `<p class="calm-vazio">${filtroLoja === 'todos' ? 'Nada à venda agora.' : 'Nada desta categoria à venda agora.'}</p>`;
        if (!fim && e < 5) {
          const prox = D.ETAPAS[e];
          html += `<div class="calm-trava">🔒 <b>Etapa ${e + 1}: ${prox.nome}</b><small>Compre os itens marcados com ★ para liberar.</small></div>`;
        } else if (!fim) html += `<div class="calm-trava">🏮 <b>Última etapa</b><small>Compre os itens ★ e acenda a Lanterna do Refúgio.</small></div>`;
        $('#calm-lista').innerHTML = html;
        atualizarPrecos();
      }
      function atualizarPrecos() {
        el.querySelectorAll('[data-comprar]').forEach(b => { const ok = S.ser >= +b.dataset.custo; b.classList.toggle('pode', ok); });
      }
      function comprar(id) {
        const it = D.PORID[id]; if (!it) return;
        const n = S.niv[id] || 0, c = D.custo(it, n);
        if (n >= it.max || !D.disponivel(it, S.niv) || S.ser < c) { if (S.ser < c) aviso(`Faltam ${D.fmt(c - S.ser)} de serenidade.`, 'leve'); return; }
        const etapaAntes = cache.etapa;
        S.ser -= c; S.niv[id] = n + 1;
        if (id === 'chuvafraca' && S.atm === 'tarde') S.atm = 'chuva';
        recalcular();
        efeito('compra');
        if (it.cat === 'bebida' || it.id === 'caneca') { if (S.niv.despejar && S.sons.despejar) timers.push(setTimeout(() => efeito('despejar'), 250)); }
        else if (it.som === 'paginas' || it.som === 'asmr') timers.push(setTimeout(() => efeito(it.som), 300));   // os sons contínuos começam sozinhos em aplicarSom()
        salvar();
        atualizarCena(true); atualizarJornada(); montarLoja(); aplicarSom();
        if (painel) abrirPainel(painel);
        if (n === 0) {
          const nSons = SONS_ITENS.filter(i => S.niv[i.id]).length, nItens = D.ITENS.filter(i => S.niv[i.id]).length;
          enviar('item:' + id, { tipo: 'item', item: id, etapa: it.etapa, nSons, nItens, total: TOTAL_ITENS });
          if (id === 'culinaria') timers.push(setTimeout(cozinhar, 900));
        }
        if (cache.etapa > etapaAntes) {
          for (let k = etapaAntes + 1; k <= cache.etapa; k++) enviar('etapa:' + k, { tipo: 'etapa', etapa: k });
          aviso(`✨ Nova etapa: <b>${D.ETAPAS[cache.etapa - 1].nome}</b>`, 'etapa'); efeito('etapa');
        }
        if (it.final) final();
      }

      /* ---------- Clique no núcleo ---------- */
      function tocarNucleo(x, y) {
        const ganho = cache.prod.clique;
        S.ser += ganho; S.total += ganho; S.cliques++; sujo = true;
        if (S.cliques === 1) enviar('primeiro', { tipo: 'primeiro', partida: true });
        nucleo.classList.remove('calm-pulso'); void nucleo.offsetWidth; nucleo.classList.add('calm-pulso');
        efeito('clique');
        if (flutuando < 14) {
          const r = quarto.getBoundingClientRect(), f = document.createElement('span');
          f.className = 'calm-flut'; f.textContent = '+' + D.fmtTaxa(ganho);
          f.style.left = ((x != null ? x - r.left : r.width / 2) + (Math.random() * 30 - 15)) + 'px';
          f.style.top = ((y != null ? y - r.top : r.height * .55) - 10) + 'px';
          quarto.appendChild(f); flutuando++;
          timers.push(setTimeout(() => { f.remove(); flutuando--; }, 1000));
        }
        atualizarNumeros();
        if (introPasso === 2) { introCliques++; mostrarIntro(); }
      }
      nucleo.addEventListener('click', e => tocarNucleo(e.detail ? e.clientX : null, e.detail ? e.clientY : null));
      nucleo.addEventListener('keydown', e => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault(); });

      /* ---------- Números (atualizados poucas vezes por segundo) ---------- */
      function atualizarNumeros() {
        $('#calm-ser').textContent = D.fmt(S.ser);
        $('#calm-taxa').textContent = `+${D.fmtTaxa(cache.prod.auto)}/s · +${D.fmtTaxa(cache.prod.clique)} por clique`;
      }
      let acum = 0;
      function laco(t) {
        raf = requestAnimationFrame(laco);
        if (!ultimo) { ultimo = t; return; }
        const dt = Math.min(.25, Math.max(0, (t - ultimo) / 1000));   // sem "recuperar" tempo perdido: no máximo 0,25 s por quadro
        ultimo = t;
        if (document.hidden) return;
        const g = cache.prod.auto * dt;
        if (g > 0) { S.ser += g; S.total += g; sujo = true; }
        S.tempo += dt;
        acum += dt;
        if (acum >= .2) { acum = 0; atualizarNumeros(); atualizarPrecos(); atualizarProx(); }
      }
      function iniciarLaco() { if (!raf) { ultimo = 0; raf = requestAnimationFrame(laco); } }
      function pararLaco() { cancelAnimationFrame(raf); raf = 0; ultimo = 0; }
      const salvarTimer = setInterval(() => { if (sujo) salvar(); }, SALVAR_MS);

      /* ---------- Avisos dentro do quarto ---------- */
      let avisoT = 0;
      function aviso(html, tipo) {
        const a = $('#calm-aviso'); a.innerHTML = html; a.className = 'calm-aviso calm-aviso-' + (tipo || 'leve'); a.hidden = false;
        clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, tipo === 'etapa' ? 3600 : 1800);
      }

      /* ---------- Cantinho de culinária (animação original inspirada em vídeos de culinária e mukbang) ---------- */
      let cozinhando = false;
      function cozinhar() {
        if (cozinhando || !S.niv.culinaria) return;
        cozinhando = true;
        const cena = $('#calm-coz'), txt = $('#calm-coz-txt'), bt = $('#calm-cozinhar');
        bt.disabled = true;
        const fases = [['cozinhar', 'Mexendo o caldo devagar…', 2600, 'cozinhar'], ['servir', 'Servindo numa tigela quentinha…', 1600, 'despejar'],
          ['comer', 'Hmm… uma garfada de cada vez.', 3600, 'comer'], ['fim', 'Que delícia. Barriga quentinha, mente tranquila.', 2400, null]];
        let i = 0;
        const passo = () => {
          if (i >= fases.length) {
            cena.className = 'calm-coz-cena'; bt.disabled = false; cozinhando = false; S.refeicoes++; sujo = true;
            txt.textContent = 'Quando quiser, prepare outra refeição.';
            enviar('refeicao', { tipo: 'refeicao' });
            return;
          }
          const [f, t, ms, s] = fases[i++];
          cena.className = 'calm-coz-cena calm-f-' + f; txt.textContent = t;
          if (s && (s !== 'despejar' || (S.niv.despejar && S.sons.despejar))) efeito(s);
          if (f === 'comer') [900, 1800, 2700].forEach(d => timers.push(setTimeout(() => efeito('comer'), d)));
          timers.push(setTimeout(passo, ms));
        };
        passo();
      }
      $('#calm-cozinhar').addEventListener('click', cozinhar);

      /* ---------- Painéis: sons, quarto e coleção ---------- */
      function abrirPainel(qual) {
        painel = qual;
        const p = $('#calm-painel'); let corpo = '';
        if (qual === 'sons') {
          const fx = (k, n) => `<label class="calm-vol"><span>${n}</span><input type="range" min="0" max="100" step="5" value="${Math.round(S.vol[k] * 100)}" data-vol="${k}" aria-label="Volume: ${n}"></label>`;
          corpo = `<h3>🎚️ Sons</h3>
            <p class="calm-nota">Todos os sons são <b>sintetizados no navegador</b> (ruído filtrado e notas simples). Não são gravações reais de chuva, lareira ou ASMR. O jogo funciona igual sem som.</p>
            <button class="btn small calm-mestre" id="calm-mestre">${S.vol.mudo ? '🔇 Som desligado: ligar' : '🔊 Som ligado: desligar'}</button>
            <div class="calm-vols">${fx('ambiente', 'Ambiente')}${fx('efeitos', 'Efeitos')}${fx('musica', 'Música')}</div>
            <h4>Sons liberados</h4>
            <div class="calm-sons">${SOM_ROTULOS.map(r => { const tem = S.niv[r.item] > 0, it = D.PORID[r.item];
              return `<label class="calm-som${tem ? '' : ' trava'}"><input type="checkbox" data-som="${r.k}" ${S.sons[r.k] ? 'checked' : ''} ${tem ? '' : 'disabled'}><span>${it.icone} ${r.nome}</span>${tem ? '' : `<small>🔒 compre “${it.nome}”</small>`}</label>`; }).join('')}</div>`;
        } else if (qual === 'quarto') {
          corpo = `<h3>🎨 Quarto</h3><h4>Atmosfera</h4><div class="calm-opcoes">${D.ATMOSFERAS.map(a => { const ok = a.requer.every(r => S.niv[r]);
              return `<button class="calm-op${S.atm === a.id ? ' on' : ''}" data-atm="${a.id}" ${ok ? '' : 'disabled'}><b>${a.nome}</b>${ok ? '' : `<small>🔒 ${a.requer.map(r => D.PORID[r].nome).join(', ')}</small>`}</button>`; }).join('')}</div>
            <h4>Cor da parede</h4><div class="calm-opcoes">${D.PAREDES.map(c => { const ok = cache.etapa >= c.etapa || D.concluido(S.niv);
              return `<button class="calm-op calm-cor${S.parede === c.id ? ' on' : ''}" data-parede="${c.id}" style="--c:${c.cor}" ${ok ? '' : 'disabled'}><i></i><b>${c.nome}</b>${ok ? '' : `<small>🔒 etapa ${c.etapa}</small>`}</button>`; }).join('')}</div>`;
        } else if (qual === 'colecao') {
          const fl = [['todos', 'Todos']].concat(Object.entries(D.CATEGORIAS), [['faltando', 'Faltando'], ['opcional', 'Opcionais']]);
          const itens = D.ITENS.filter(i => filtroCol === 'todos' || (filtroCol === 'faltando' ? !S.niv[i.id] : filtroCol === 'opcional' ? i.opcional : i.cat === filtroCol));
          const tem = D.ITENS.filter(i => S.niv[i.id]).length;
          corpo = `<h3>📖 Coleção <small>${tem}/${TOTAL_ITENS}</small></h3>
            <div class="calm-filtros">${fl.map(([k, n]) => `<button class="calm-chip${filtroCol === k ? ' on' : ''}" data-fc="${k}">${n}</button>`).join('')}</div>
            <div class="calm-col">${itens.map(i => { const n = S.niv[i.id] || 0, liberada = i.etapa <= cache.etapa || D.concluido(S.niv);
              return `<div class="calm-carta${n ? ' tem' : ''}" data-carta="${i.id}"><span>${n || liberada ? i.icone : '❔'}</span><b>${n || liberada ? i.nome : '???'}</b>
                <small>${n ? (i.max > 1 ? `Nível ${n}/${i.max}` : 'Na coleção ✔') : `Falta · ${D.CATEGORIAS[i.cat]} · etapa ${i.etapa}${i.opcional ? ' · opcional' : ''}`}</small></div>`; }).join('') || '<p class="calm-vazio">Nada aqui. Que bom!</p>'}</div>`;
        }
        p.innerHTML = `<div class="calm-painel-box" role="dialog" aria-modal="true" aria-label="Painel do wow.calm"><button class="calm-fechar" data-fechar aria-label="Fechar">✕</button>${corpo}</div>`;
        p.hidden = false;
      }
      function fecharPainel() { painel = null; $('#calm-painel').hidden = true; }
      function marcarDetalhe() { if (S.mudouAtm && S.mudouParede) enviar('detalhe', { tipo: 'detalhe' }); }

      el.addEventListener('click', e => {
        const t = e.target.closest('button, [data-fechar]');
        if (e.target.id === 'calm-painel') { fecharPainel(); return; }
        if (!t) return;
        if (t.dataset.comprar) comprar(t.dataset.comprar);
        else if (t.dataset.fl) { filtroLoja = t.dataset.fl; montarFiltros(); montarLoja(); }
        else if (t.dataset.painel) abrirPainel(t.dataset.painel);
        else if (t.hasAttribute('data-fechar')) fecharPainel();
        else if (t.dataset.fc) { filtroCol = t.dataset.fc; abrirPainel('colecao'); }
        else if (t.dataset.atm) {
          S.atm = t.dataset.atm; S.mudouAtm = true;
          if (S.atm === 'chuva') { S.sons.chuva = true; S.sons.chuvaforte = false; }
          if (S.atm === 'temporal') { S.sons.chuvaforte = true; S.sons.chuva = false; }
          if (S.atm === 'tarde') { S.sons.chuva = false; S.sons.chuvaforte = false; }
          if (S.atm === 'lareira') S.sons.lareira = true;
          salvar(); atualizarCena(); aplicarSom(); abrirPainel('quarto'); marcarDetalhe();
        } else if (t.dataset.parede) { S.parede = t.dataset.parede; S.mudouParede = true; salvar(); atualizarCena(); abrirPainel('quarto'); marcarDetalhe(); }
        else if (t.id === 'calm-mudo' || t.id === 'calm-mestre') ligarSom(S.vol.mudo);
        else if (t.id === 'calm-ajuda') { introPasso = 1; mostrarIntro(); }
      }, sinal);
      el.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.som) { S.sons[t.dataset.som] = t.checked; if (!S.vol.mudo) Som.iniciar(); aplicarSom(); salvar(); }
      }, sinal);
      el.addEventListener('input', e => {
        const t = e.target;
        if (t.dataset.vol) { S.vol[t.dataset.vol] = +t.value / 100; Som.volumes(S.vol); sujo = true; }
      }, sinal);
      const tecla = e => { if (e.key === 'Escape' && painel) fecharPainel(); };
      document.addEventListener('keydown', tecla);

      /* ---------- Introdução curta e interativa ---------- */
      let introPasso = 0, introCliques = 0;
      function mostrarIntro() {
        const box = $('#calm-intro');
        if (!introPasso) { box.hidden = true; raiz.classList.remove('calm-guiando'); return; }
        box.hidden = false; raiz.classList.toggle('calm-guiando', introPasso === 2);
        if (introPasso === 1) {
          box.className = 'calm-intro';
          box.innerHTML = `<div class="calm-intro-box" role="dialog" aria-modal="true" aria-label="Boas-vindas ao wow.calm">
            <div class="calm-intro-ico">🕯️</div><h3>Respire fundo.</h3>
            <p>Aqui não tem pressa, cronômetro nem derrota. Você junta <b>serenidade</b> tocando no núcleo de luz e monta, um conforto de cada vez, um refúgio só seu.</p>
            <p class="calm-nota">Os sons são sintetizados no navegador (não são gravações) e só tocam se você quiser. Dá para mudar depois em 🎚️ Sons.</p>
            <div class="calm-intro-bts"><button class="btn" id="calm-i-som">🔊 Começar com som</button><button class="btn calm-bt-claro" id="calm-i-mudo">🔇 Começar sem som</button></div></div>`;
          const seguir = som => { introPasso = S.cliques >= 3 && S.intro ? 0 : 2; introCliques = 0; ligarSom(som); if (introPasso === 0) { S.intro = true; salvar(); } mostrarIntro(); };
          box.querySelector('#calm-i-som').onclick = () => seguir(true);
          box.querySelector('#calm-i-mudo').onclick = () => seguir(false);
          box.querySelector('#calm-i-som').focus();
        } else if (introPasso === 2) {
          box.className = 'calm-intro calm-intro-dica';
          if (introCliques >= 3) { introPasso = 3; mostrarIntro(); return; }
          box.innerHTML = `<div class="calm-intro-box"><p>👆 Toque no <b>núcleo de luz</b> no meio do quarto. <b>${introCliques}/3</b></p></div>`;
        } else if (introPasso === 3) {
          box.className = 'calm-intro calm-intro-dica';
          box.innerHTML = `<div class="calm-intro-box"><p>Isso. Com serenidade você compra confortos ao lado. Os itens com <b>★</b> abrem a próxima etapa, e alguns produzem sozinhos <b>enquanto o jogo está aberto</b>.</p>
            <button class="btn small" id="calm-i-ok">Entendi</button></div>`;
          box.querySelector('#calm-i-ok').onclick = () => { introPasso = 0; S.intro = true; salvar(); mostrarIntro(); };
        }
      }

      /* ---------- Final especial ---------- */
      function final() {
        if (!S.fimTempo) S.fimTempo = Math.round(S.tempo);
        salvar();
        const rp = enviar('final', { tipo: 'final', etapa: 5, tempo: S.fimTempo });
        efeito('final');
        raiz.classList.add('calm-acendendo');
        timers.push(setTimeout(() => raiz.classList.remove('calm-acendendo'), 2600));
        timers.push(setTimeout(() => mostrarFinal(rp), 1400));
      }
      function mostrarFinal(rp) {
        fimAberto = true;
        const box = $('#calm-intro'), opc = D.ITENS.filter(i => i.opcional && !S.niv[i.id]).length;
        box.hidden = false; box.className = 'calm-intro calm-intro-final';
        box.innerHTML = `<div class="calm-intro-box calm-final" role="dialog" aria-modal="true" aria-label="Refúgio completo">
          <div class="calm-intro-ico">🏮</div><h3>Refúgio completo</h3>
          <p>A lanterna acendeu e o quarto inteiro ficou quentinho. Chuva na janela, chá na mesa, páginas virando devagar. Este lugar é seu, e ele vai estar aqui sempre que você precisar de uma pausa.</p>
          <div class="calm-final-dados"><span><small>Tempo de jogo</small><b>${minutos(S.fimTempo)}</b></span><span><small>Toques no núcleo</small><b>${S.cliques.toLocaleString('pt-BR')}</b></span><span><small>Serenidade total</small><b>${D.fmt(S.total)}</b></span></div>
          ${rp && WowGames.Pontos ? WowGames.Pontos.html(rp) : ''}
          <p class="calm-nota">${opc ? `Ainda há <b>${opc} itens opcionais</b> para colecionar (como o gatinho sonolento). Não existe recomeço: seu refúgio fica como está.` : 'Você já tem todos os itens.'}</p>
          <button class="btn" id="calm-f-ok">Ficar no refúgio</button></div>`;
        WowGames.confetti(box.querySelector('.calm-final'), ['✨', '🏮', '⭐', '🌙']);
        box.querySelector('#calm-f-ok').onclick = () => { fimAberto = false; S.finalVisto = true; salvar(); box.hidden = true; };
        box.querySelector('#calm-f-ok').focus();
      }

      /* ---------- Visibilidade e saída ---------- */
      const aoVisivel = () => {
        if (document.hidden) { pararLaco(); salvar(); Som.pausar(); }
        else { iniciarLaco(); if (!S.vol.mudo) Som.retomar(); }
      };
      const aoSair = () => salvar();
      document.addEventListener('visibilitychange', aoVisivel);
      window.addEventListener('pagehide', aoSair);

      /* ---------- Início ---------- */
      recalcular(); montarFiltros(); montarLoja(); atualizarCena(); atualizarJornada(); atualizarNumeros(); botaoMudo();
      // O som nunca liga sozinho: mesmo que o jogador tenha deixado ligado, o navegador só toca depois de um novo clique.
      if (!S.vol.mudo) {
        const primeiroGesto = () => { el.removeEventListener('pointerdown', primeiroGesto, true); el.removeEventListener('keydown', primeiroGesto, true); if (!S.vol.mudo) { Som.iniciar(); aplicarSom(); } };
        el.addEventListener('pointerdown', primeiroGesto, { capture: true, signal: ouvir.signal }); el.addEventListener('keydown', primeiroGesto, { capture: true, signal: ouvir.signal });
      }
      if (!S.intro) { introPasso = 1; mostrarIntro(); }
      else if (D.concluido(S.niv) && !S.finalVisto) mostrarFinal(null);
      if (!document.hidden) iniciarLaco();

      WowGames.CalmJogo.atual = { estado: () => S, cache: () => cache, comprar, salvar, _ganhar: n => { S.ser += n; S.total += n; atualizarNumeros(); atualizarPrecos(); atualizarProx(); }, cozinhar };

      return () => {
        pararLaco(); clearInterval(salvarTimer); clearTimeout(avisoT); timers.forEach(clearTimeout); ouvir.abort();
        document.removeEventListener('visibilitychange', aoVisivel); window.removeEventListener('pagehide', aoSair); document.removeEventListener('keydown', tecla);
        salvar(); Som.parar();
        WowGames.CalmJogo.atual = null;
      };
    }
  });
})();
