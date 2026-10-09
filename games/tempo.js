/* Jogo 2: Pare no Tempo */
(function () {
  const historico = []; // vale enquanto a página estiver aberta (sessão)

  function avaliar(e) {
    if (e < 0.10) return 'ABSURDO. Você tem um relógio dentro da cabeça. 🧠';
    if (e < 0.50) return 'Muito bom!';
    if (e < 1) return 'Quase perfeito.';
    if (e < 2) return 'Não foi ruim.';
    return 'Seu relógio interno precisa de manutenção. 🔧';
  }
  const sinal = n => (n >= 0 ? '+' : '−') + WowGames.fmt(Math.abs(n)) + 's';
  // Sorteio novo a cada rodada: de 1,00 a 30,00 segundos
  const sortear = () => Math.round((1 + Math.random() * 29) * 100) / 100;

  WowGames.register({
    id: 'tempo', nome: 'Pare no Tempo', icone: '⏱️', cor: 'var(--sun)',
    desc: 'Sinta o tempo passar e pare o cronômetro no momento exato.',

    mount(el) {
      let alvo = sortear(), t0 = 0;

      el.innerHTML = `<div id="tp-main"></div>
        <div class="tp-hist"><h2>Sessão</h2><p id="tp-best"></p><ol id="tp-list"></ol></div>`;
      const main = el.querySelector('#tp-main');

      function historicoUI() {
        const best = historico.length ? Math.min(...historico.map(h => Math.abs(h.erro))) : null;
        el.querySelector('#tp-best').textContent = best === null ? 'Nenhuma rodada ainda.' : 'Melhor resultado: erro de ' + WowGames.fmt(best) + 's';
        el.querySelector('#tp-list').innerHTML = historico.map((h, i) =>
          `<li>Rodada ${i + 1}: erro ${sinal(h.erro)}</li>`).join('');
      }

      function pronto() {
        main.innerHTML = `
          <p>Pare o cronômetro no momento certo.</p>
          <p>Seu alvo desta rodada:</p>
          <div class="tp-big">${WowGames.fmt(alvo)}s</div>
          <p class="tp-dica">Quando você começar, o alvo e o relógio somem. Conte por conta própria.</p>
          <button class="btn big" id="tp-go">COMEÇAR</button>`;
        main.querySelector('#tp-go').onclick = correndo;
      }

      function correndo() {
        main.innerHTML = `
          <p>Quanto tempo já passou?</p>
          <div class="tp-big tp-run">?</div>
          <button class="btn big stop" id="tp-stop">PARAR</button>`;
        const b = main.querySelector('#tp-stop');
        t0 = performance.now();
        b.addEventListener('pointerdown', parar);
        b.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); parar(); } });
        b.focus({ preventScroll: true });
      }

      function parar() {
        const dec = (performance.now() - t0) / 1000;
        const erro = dec - alvo;
        historico.push({ alvo, dec, erro });
        const rp = WowGames.evento({ jogo: 'tempo', tipo: 'rodada', partida: true, erro: Math.abs(erro), alvo, dec });
        main.innerHTML = `
          <div class="tp-res">
            <div>Tempo-alvo<b>${WowGames.fmt(alvo)}s</b></div>
            <div>Você parou em<b>${WowGames.fmt(dec)}s</b></div>
            <div>Erro<b>${sinal(erro)}</b></div>
          </div>
          <h2>${avaliar(Math.abs(erro))}</h2>
          ${WowGames.Pontos ? WowGames.Pontos.html(rp) : ''}
          <button class="btn big" id="tp-again">Jogar novamente</button>`;
        main.querySelector('#tp-again').onclick = () => { alvo = sortear(); pronto(); historicoUI(); };
        if (Math.abs(erro) < 0.10) WowGames.confetti(el, ['⏱️', '✨', '🎉']);
        historicoUI();
      }

      pronto(); historicoUI();
    }
  });
})();
