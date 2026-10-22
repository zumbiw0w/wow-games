/* wow.games: FAVORITOS da página inicial.
   - Usa o id estável de cada jogo (o mesmo de WowGames.register), nunca o nome visível. Funciona com qualquer jogo registrado, inclusive futuros.
   - Guarda só uma chave própria e versionada: wowgames.favoritos.v1 = { v: 1, ids: ['botao', ...], filtro: 'todos' | 'favoritos' }.
     Como começa com "wowgames.", ela entra automaticamente no código de recuperação do perfil (perfil-recuperacao.js).
   - Favoritar não mexe em XP, moedas, conquistas, recordes ou pontuação.
   - Liga-se à página inicial pelos pontos de extensão de script.js: antesDaGrade, cardExtra e depoisDoInicio. */
(function () {
  const CHAVE = 'wowgames.favoritos.v1';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let memoria = null;                                       // se o navegador bloquear o localStorage, os favoritos valem só nesta visita
  function ler() {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE));
      if (s && s.v === 1) return { v: 1, ids: Array.isArray(s.ids) ? s.ids.filter(x => typeof x === 'string') : [], filtro: s.filtro === 'favoritos' ? 'favoritos' : 'todos' };
    } catch (e) {}
    return memoria || { v: 1, ids: [], filtro: 'todos' };
  }
  function gravar(s) { memoria = s; try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) {} }

  const ehFavorito = id => ler().ids.includes(id);
  function alternar(id) {
    const s = ler(), i = s.ids.indexOf(id);
    if (i >= 0) s.ids.splice(i, 1); else s.ids.push(id);
    gravar(s); return i < 0;
  }
  function filtrar(f) { const s = ler(); s.filtro = f === 'favoritos' ? 'favoritos' : 'todos'; gravar(s); }

  const rotulo = (nome, on) => on ? `Remover ${nome} dos favoritos` : `Adicionar ${nome} aos favoritos`;

  /* ---------- Página inicial ---------- */
  WowGames.antesDaGrade = () => `
    <div class="fv-barra" role="group" aria-label="Filtrar jogos">
      <button type="button" class="fv-aba" data-fv-filtro="todos" aria-pressed="false">🎮 Todos os jogos <b data-fv-n="todos"></b></button>
      <button type="button" class="fv-aba" data-fv-filtro="favoritos" aria-pressed="false">⭐ Favoritos <b data-fv-n="favoritos"></b></button>
    </div>
    <p class="fv-vazio" hidden>⭐ Você ainda não tem jogos favoritos. Toque na estrela de um jogo para guardá-lo aqui e encontrar mais rápido.</p>`;

  WowGames.cardExtra = g => {
    const on = ehFavorito(g.id), nome = esc(g.nome);
    return `<button type="button" class="fv-btn ${on ? 'on' : ''}" data-fav="${esc(g.id)}" data-nome="${nome}" aria-pressed="${on}" aria-label="${rotulo(nome, on)}" title="${on ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}"><span aria-hidden="true">${on ? '★' : '☆'}</span></button>`;
  };

  // Aplica o filtro e atualiza contadores sem redesenhar a página (mantém a rolagem e o foco).
  function aplicar(raiz) {
    const r = raiz || document;
    const grade = r.querySelector('#wg-grade'); if (!grade) return;
    const s = ler(), ids = new Set(s.ids), cards = [...grade.querySelectorAll('.card[data-jogo]')];
    const nFav = cards.filter(c => ids.has(c.dataset.jogo)).length;
    cards.forEach(c => { c.hidden = s.filtro === 'favoritos' && !ids.has(c.dataset.jogo); });
    r.querySelectorAll('[data-fv-filtro]').forEach(b => { const on = b.dataset.fvFiltro === s.filtro; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const nt = r.querySelector('[data-fv-n="todos"]'), nf = r.querySelector('[data-fv-n="favoritos"]');
    if (nt) nt.textContent = cards.length; if (nf) nf.textContent = nFav;
    const vazio = r.querySelector('.fv-vazio'); if (vazio) vazio.hidden = !(s.filtro === 'favoritos' && nFav === 0);
    grade.classList.toggle('fv-filtrada', s.filtro === 'favoritos');
  }
  WowGames.depoisDoInicio = raiz => aplicar(raiz);

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fav]');
    if (b) {
      e.preventDefault(); e.stopPropagation();               // nunca abre o jogo
      const on = alternar(b.dataset.fav), nome = b.dataset.nome || '';
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', rotulo(nome, on)); b.title = on ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
      b.querySelector('span').textContent = on ? '★' : '☆';
      b.classList.remove('pulo'); void b.offsetWidth; b.classList.add('pulo');
      aplicar();
      return;
    }
    const f = e.target.closest('[data-fv-filtro]');
    if (f) { filtrar(f.dataset.fvFiltro); aplicar(); }
  });

  WowGames.Favoritos = { CHAVE, lista: () => ler().ids.slice(), ehFavorito, alternar, filtro: () => ler().filtro };
})();
