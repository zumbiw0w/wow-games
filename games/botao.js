/* Jogo 1: O Botão */
WowGames.register({
  id: 'botao', nome: 'O Botão', icone: '🔴', cor: 'var(--coral)',
  desc: 'Parece fácil: é só clicar no botão. Parece.',

  mount(el) {
    const TEXTOS = ['NÃO CLIQUE', 'ME CLICA!', 'CLIQUE... SE PUDER', 'PSIU, AQUI', 'QUASE LÁ'];
    const rand = (a, b) => a + Math.random() * (b - a);
    const timers = [];
    const META = 25;            // acertos necessários
    let raf = 0;                 // animação do cronômetro
    let tries, hits, dodgeLeft, t0;

    function start() {
      tries = 0; hits = 0; dodgeLeft = 0; t0 = null; cancelAnimationFrame(raf);
      el.innerHTML = `
        <p class="bt-q">Você consegue clicar no botão?</p>
        <div class="bt-stats">
          <span>Tentativas: <b id="b-t">0</b></span>
          <span>Cliques certos: <b id="b-h">0</b>/${META}</span>
          <span>Tempo: <b id="b-time">0,00</b>s</span>
        </div>
        <div class="bt-arena" id="b-arena">
          <button class="big-btn" id="b-real">CLIQUE EM MIM</button>
        </div>
        <p class="bt-say" id="b-say">Vai lá, é só um clique.</p>`;
      const $ = id => el.querySelector('#' + id);
      const arena = $('b-arena'), real = $('b-real'), say = $('b-say');
      const tEl = $('b-t'), hEl = $('b-h'), timeEl = $('b-time');
      let total = 0;
      const tick = () => { timeEl.textContent = WowGames.fmt((performance.now() - t0) / 1000); raf = requestAnimationFrame(tick); };

      const place = (node, x, y) => { node.style.left = x + 'px'; node.style.top = y + 'px'; };
      const move = (node = real) => {
        const x = rand(0, Math.max(0, arena.clientWidth - node.offsetWidth));
        const y = rand(0, Math.max(0, arena.clientHeight - node.offsetHeight));
        place(node, x, y);
      };
      const center = () => place(real, (arena.clientWidth - real.offsetWidth) / 2, (arena.clientHeight - real.offsetHeight) / 2);
      center();

      const fakes = [];
      const clearFakes = () => { fakes.splice(0).forEach(f => f.remove()); };
      const spawnFakes = n => {
        for (let i = 0; i < n; i++) {
          const f = document.createElement('button');
          f.className = 'big-btn fake';
          f.textContent = real.textContent;
          arena.appendChild(f); move(f); fakes.push(f);
        }
      };

      // O que acontece depois de cada clique certo (índice = cliques certos até agora)
      const FASES = {
        1: () => say.textContent = 'Fácil, né? Agora vai ficar interessante.',
        2: () => { move(); say.textContent = 'Ué, ele se mexeu.'; },
        3: () => { move(); say.textContent = 'Ele está ficando agitado.'; },
        4: () => { dodgeLeft = 3; move(); say.textContent = 'Agora ele tem medo de você. Tente se aproximar.'; },
        5: () => { dodgeLeft = 3; move(); say.textContent = 'Ele foge, mas se cansa rápido.'; },
        6: () => { real.style.setProperty('--s', rand(0.65, 1.25).toFixed(2)); move(); say.textContent = 'Mudou de tamanho. Sem aviso.'; },
        7: () => { spawnFakes(2); move(); say.textContent = 'Cuidado: nem tudo que parece botão é botão.'; },
        8: () => { clearFakes(); real.textContent = TEXTOS[Math.floor(Math.random() * TEXTOS.length)]; move(); say.textContent = 'Mudou o texto. É o mesmo botão, juro.'; },
        9: () => {
          real.style.setProperty('--rot', rand(-25, 25).toFixed(0) + 'deg');
          real.style.setProperty('--s', '0.8');
          place(real, Math.random() < .5 ? 0 : arena.clientWidth - real.offsetWidth, Math.random() < .5 ? 0 : arena.clientHeight - real.offsetHeight);
          say.textContent = 'Reta final! Ele está ficando desesperado.';
        }
      };

      // Cliques certos em que cada fase começa (as fases 1 a 9 acima)
      const GATILHOS = { 1: 1, 3: 2, 5: 3, 7: 4, 9: 5, 11: 6, 14: 7, 17: 8, 20: 9 };

      arena.addEventListener('pointerdown', e => {
        if (t0 === null) { t0 = performance.now(); tick(); } // o cronômetro começa na 1ª tentativa
        tries++; tEl.textContent = tries;
        if (e.target === real) {
          hits++; hEl.textContent = hits;
          real.classList.remove('pop'); void real.offsetWidth; real.classList.add('pop');
          if (hits >= META) {
            total = (performance.now() - t0) / 1000;
            cancelAnimationFrame(raf);
            timeEl.textContent = WowGames.fmt(total);
            return timers.push(setTimeout(win, 250));
          }
          if (GATILHOS[hits]) FASES[GATILHOS[hits]]();
          else if (hits > 20) FASES[9]();
          else { move(); say.textContent = `Boa! Faltam ${META - hits}.`; }
        } else if (e.target.classList.contains('fake')) {
          e.target.style.opacity = 0;
          const f = e.target; setTimeout(() => f.remove(), 150);
          say.textContent = 'Era falso! 😈';
        } else {
          say.textContent = 'Você clicou no nada. Conta como tentativa.';
        }
      });

      // Fase "foge do cursor" (só com mouse; no celular o botão continua pulando a cada clique)
      arena.addEventListener('pointermove', e => {
        if (dodgeLeft <= 0 || e.pointerType !== 'mouse') return;
        const r = real.getBoundingClientRect();
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        if (d < 90) { dodgeLeft--; move(); say.textContent = dodgeLeft ? 'Ei! Chegou perto demais.' : 'Cansei de correr. Pode vir.'; }
      });

      function win() {
        const rp = WowGames.evento({ jogo: 'botao', tipo: 'fim', partida: true, tempo: total, tentativas: tries });
        const msg = tries <= 30 ? 'Você é bom nisso.'
          : tries <= 50 ? 'Boa! Persistência é uma virtude.'
          : tries <= 80 ? 'Finalmente!'
          : 'Você tem paciência de monge.';
        el.innerHTML = `
          <div class="big-emoji">🏆</div>
          <h2>${msg}</h2>
          <p>Você conseguiu em <b>${WowGames.fmt(total)} segundos</b>!</p>
          <p>Foram <b>${tries}</b> tentativas para acertar o botão ${META} vezes.</p>
          ${WowGames.Pontos ? WowGames.Pontos.html(rp) : ''}
          <button class="btn big" id="b-again">Jogar de novo</button>`;
        el.querySelector('#b-again').onclick = start;
        WowGames.confetti(el, ['🎉', '🔴', '✨']);
      }
    }

    start();
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
  }
});
