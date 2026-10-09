/* Jogo 6: Complete a Sequência. As 10 sequências são oficiais e fixas, na mesma ordem para todos. */
WowGames.register({
  id: 'sequencia', nome: 'Complete a Sequência', icone: '🔢', cor: 'var(--mint)',
  desc: 'Dez sequências iguais para todo mundo. Descubra o número que falta, o mais rápido que puder.',

  mount(el) {
    // 'x' marca o número que falta. Os valores são texto para preservar o "08" da fase 10.
    const FASES = [
      { seq: ['2', '4', '8', '16', '32', 'x', '128'], resp: 64 },
      { seq: ['5', '10', '15', 'x', '25', '30'], resp: 20 },
      { seq: ['3', '6', '12', 'x', '48'], resp: 24 },
      { seq: ['2', '3', '5', '7', '11', '13', 'x', '19'], resp: 17 },
      { seq: ['1', '4', '9', '16', '25', 'x', '49'], resp: 36 },
      { seq: ['1', '8', '27', '64', 'x', '216'], resp: 125 },
      { seq: ['0', '1', '1', '2', '3', '5', '8', 'x', '21'], resp: 13 },
      { seq: ['1', '11', '21', '1211', 'x', '312211'], resp: 111221 },
      { seq: ['5', '4', '8', '11', 'x', '12', '16', '15'], resp: 9 },
      { seq: ['97', '63', '18', '08', 'x'], resp: 0 }
    ];
    let fase, erros, t0, raf;
    const tick = () => {
      const b = el.querySelector('#s-t');
      if (b) b.textContent = WowGames.fmt((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };

    function inicio() {
      cancelAnimationFrame(raf);
      el.innerHTML = `
        <div class="big-emoji">🔢</div>
        <h2>10 sequências, uma de cada vez</h2>
        <p>Todo mundo recebe as mesmas sequências, na mesma ordem. Complete as 10 o mais rápido possível.</p>
        <p>O tempo começa quando você tocar em Começar.</p>
        <button class="btn big" id="s-go">Começar</button>`;
      el.querySelector('#s-go').onclick = () => { fase = 0; erros = 0; t0 = performance.now(); tick(); mostrar(''); };
    }

    function mostrar(aviso) {
      el.innerHTML = `
        <div class="jg-top"><span>Fase <b>${fase + 1}</b> de ${FASES.length}</span>
          <span>Tempo: <b id="s-t">${WowGames.fmt((performance.now() - t0) / 1000)}</b>s</span>
          <span>Erros: <b id="s-e">${erros}</b></span></div>
        <div class="jg-prog"><i style="width:${fase / FASES.length * 100}%"></i></div>
        <div class="sq-seq">${FASES[fase].seq.map(v => v === 'x' ? '<span class="sq-n x">?</span>' : `<span class="sq-n">${v}</span>`).join('')}</div>
        <div class="jg-campos"><input class="jg-in" id="s-in" inputmode="numeric" autocomplete="off" aria-label="Número que falta"></div>
        <button class="btn big" id="s-ok">Responder</button>
        <p class="jg-msg" id="s-msg">${aviso}</p>
        <button class="link" id="s-reset">Reiniciar partida</button>`;
      const inp = el.querySelector('#s-in');
      inp.focus({ preventScroll: true });
      const enviar = () => {
        const v = inp.value.trim().replace(',', '.');
        const msg = el.querySelector('#s-msg');
        if (v === '' || isNaN(Number(v))) { msg.textContent = 'Digite um número.'; return; }
        if (Number(v) === FASES[fase].resp) {
          fase++;
          return fase === FASES.length ? fim() : mostrar('Certo!');
        }
        erros++;
        el.querySelector('#s-e').textContent = erros;
        msg.textContent = 'Não é esse. Tente de novo!';
        inp.value = '';
        el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
        inp.focus({ preventScroll: true });
      };
      el.querySelector('#s-ok').onclick = enviar;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });
      el.querySelector('#s-reset').onclick = inicio;
    }

    function fim() {
      cancelAnimationFrame(raf);
      const tempo = (performance.now() - t0) / 1000;
      const pontos = Math.max(0, Math.round(2000 - tempo * 8 - erros * 50));
      const rp = WowGames.evento({ jogo: 'sequencia', tipo: 'fim', partida: true, tempo, erros, pontos });
      const nivel = pontos >= 1500 ? 'Mente brilhante! 🧠' : pontos >= 1000 ? 'Muito bom!' : pontos >= 500 ? 'Bom trabalho.' : 'Completou, e isso é o que importa.';
      el.innerHTML = `
        <div class="big-emoji">🏁</div>
        <h2>${nivel}</h2>
        <div class="tp-res">
          <div>Tempo total<b>${WowGames.fmt(tempo)}s</b></div>
          <div>Erros<b>${erros}</b></div>
          <div>Pontuação<b>${pontos}</b></div>
        </div>
        ${WowGames.Pontos ? WowGames.Pontos.html(rp) : ''}
        <p>As sequências são sempre as mesmas. Jogue de novo e tente baixar seu tempo.</p>
        <button class="btn big" id="s-again">Jogar novamente</button>`;
      el.querySelector('#s-again').onclick = inicio;
      WowGames.confetti(el, ['🔢', '✨', '🎉']);
    }

    inicio();
    return () => cancelAnimationFrame(raf);
  }
});
