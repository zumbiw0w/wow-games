/* wow.games: núcleo do site.
   Cada jogo chama WowGames.register({ id, nome, desc, icone, cor, mount(el) }).
   mount recebe o elemento onde o jogo deve desenhar e pode devolver uma função de limpeza. */
const WowGames = (() => {
  const games = [];
  let cleanup = null;
  const app = () => document.getElementById('app');

  const pages = [];                       // páginas internas (perfil, conquistas), fora da grade de jogos
  const register = g => games.push(g);
  const registerPage = p => pages.push(p);
  const fmt = n => n.toFixed(2).replace('.', ',');

  function confetti(box, emojis = ['🎉', '✨', '🎊', '⭐']) {
    for (let i = 0; i < 28; i++) {
      const s = document.createElement('span');
      s.className = 'confete';
      s.textContent = emojis[i % emojis.length];
      s.style.setProperty('--dx', (Math.random() * 500 - 250) + 'px');
      s.style.setProperty('--dy', (-40 - Math.random() * 320) + 'px');
      s.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      box.appendChild(s);
      setTimeout(() => s.remove(), 1400);
    }
  }

  function home() {
    document.title = 'wow.games: minijogos de poucos minutos';
    app().innerHTML = `
      <main class="home">
        <header class="hero">
          <h1>wow.games</h1>
          <p>Uma coleção de minijogos rápidos. Escolha um e brinque por alguns minutos.</p>
        </header>
        ${api.homeExtra()}
        <section class="grid">
          ${games.map(g => `
            <article class="card">
              <div class="ico" style="background:${g.cor}">${g.icone}</div>
              <h2>${g.nome}</h2>
              <p>${g.desc}</p>
              <a class="btn" href="#/${g.id}">Jogar</a>
            </article>`).join('')}
        </section>
      </main>`;
  }

  function play(g) {
    document.title = g.nome + ' | wow.games';
    app().innerHTML = `
      <main class="game">
        <nav><a class="btn small" href="#/">← Início</a><h1>${g.nome}</h1></nav>
        <section class="stage" id="stage"></section>
      </main>`;
    cleanup = g.mount(document.getElementById('stage')) || null;
  }

  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    const id = location.hash.replace('#/', '');
    const g = games.find(x => x.id === id) || pages.find(x => x.id === id);
    g ? play(g) : home();
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', route);
    route();
  });

  // evento e homeExtra começam vazios e são preenchidos por perfil.js
  // recarregar(): redesenha só o início e o perfil (usado pela loja ao fechar), sem reiniciar um jogo em andamento
  const recarregar = () => { const h = location.hash.replace('#/', ''); if (h === '' || h === 'perfil') { const y = window.scrollY; route(); window.scrollTo(0, y); } };
  const api = { register, registerPage, fmt, confetti, evento: () => {}, homeExtra: () => '', recarregar };
  return api;
})();
