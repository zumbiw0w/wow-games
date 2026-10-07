/* Jogo 4: Matemática Relâmpago (6 etapas, 4 questões por etapa) */
WowGames.register({
  id: 'matematica', nome: 'Matemática Relâmpago', icone: '🧮', cor: 'var(--sky)',
  desc: 'Seis etapas, de somas fáceis a equações de segundo grau. Quão rápido você chega ao fim?',

  mount(el) {
    const POR_ETAPA = 4;
    const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const pick = a => a[ri(0, a.length - 1)];

    // Cada gerador devolve { t: texto da conta, r: [respostas] }. Resultados sempre inteiros.
    function somaSub(min, max) {
      let a = ri(min, max), b = ri(min, max);
      if (Math.random() < .5) return { t: `${a} + ${b}`, r: [a + b] };
      if (a === b) a += ri(1, 9);
      if (a < b) [a, b] = [b, a];
      return { t: `${a} − ${b}`, r: [a - b] };
    }
    function multDiv(minA, maxA, minB, maxB) {
      const a = ri(minA, maxA), b = ri(minB, maxB);
      return Math.random() < .5 ? { t: `${a} × ${b}`, r: [a * b] } : { t: `${a * b} ÷ ${b}`, r: [a] };
    }
    function pct(i) {
      const p = pick(i < 2 ? [10, 20, 25, 50] : [5, 10, 15, 20, 25, 30, 40, 50, 60, 75]);
      const base = 20 * (i < 2 ? ri(1, 10) : ri(2, 25)); // múltiplo de 20: o resultado é sempre inteiro
      return { t: `${p}% de ${base}`, r: [p * base / 100] };
    }
    function quad(i) {
      const a = i === 3 ? 2 : 1;
      const [lo, hi] = i < 2 ? [1, 6] : i === 2 ? [-9, 9] : [-6, 6];
      let r1, r2;
      do { r1 = ri(lo, hi); r2 = ri(lo, hi); } while (r1 === r2 || r1 === 0 || r2 === 0); // duas raízes inteiras e diferentes
      const b = -a * (r1 + r2), c = a * r1 * r2;
      const termo = (k, v) => k === 0 ? '' : ` ${k < 0 ? '−' : '+'} ${Math.abs(k) === 1 && v ? '' : Math.abs(k)}${v}`;
      return { t: `${a === 1 ? '' : a}x²${termo(b, 'x')}${termo(c, '')} = 0`, r: [r1, r2] };
    }

    const ETAPAS = [
      { nome: 'Adição e subtração fáceis',            gera: () => somaSub(2, 20) },
      { nome: 'Adição e subtração mais difíceis',     gera: () => somaSub(30, 250) },
      { nome: 'Multiplicação e divisão',              gera: i => i < 2 ? multDiv(2, 9, 2, 9) : multDiv(6, 15, 3, 12) },
      { nome: 'Multiplicação e divisão mais difíceis', gera: i => i < 2 ? multDiv(11, 20, 6, 12) : multDiv(15, 30, 8, 15) },
      { nome: 'Porcentagens',                          gera: pct },
      { nome: 'Equações de segundo grau',              gera: quad }
    ];
    const TOTAL = ETAPAS.length * POR_ETAPA;

    let etapa, n, erros, t0, raf, q, aviso;
    const tick = () => {
      const b = el.querySelector('#m-t');
      if (b) b.textContent = WowGames.fmt((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };

    function inicio() {
      cancelAnimationFrame(raf);
      el.innerHTML = `
        <div class="big-emoji">🧮</div>
        <h2>6 etapas, ${TOTAL} contas</h2>
        <p>Da soma simples até equações de segundo grau. Errar não encerra o jogo, mas conta como erro.</p>
        <p>O tempo começa quando você responder a primeira conta.</p>
        <button class="btn big" id="m-go">Começar</button>`;
      el.querySelector('#m-go').onclick = () => { etapa = 0; n = 0; erros = 0; t0 = null; aviso = ''; perguntar(); };
    }

    function perguntar() {
      q = ETAPAS[etapa].gera(n);
      const dupla = q.r.length === 2;
      const campos = dupla
        ? `<p class="jg-msg">Encontre os dois valores de x (esta equação tem duas respostas).</p>
           <div class="jg-campos"><label>x₁ <input class="jg-in" autocomplete="off"></label><label>x₂ <input class="jg-in" autocomplete="off"></label></div>`
        : `<div class="jg-campos"><input class="jg-in" inputmode="numeric" autocomplete="off" aria-label="Sua resposta"></div>`;
      el.innerHTML = `
        <div class="jg-top"><span>Etapa <b>${etapa + 1}</b> de ${ETAPAS.length}</span>
          <span>Tempo: <b id="m-t">${t0 === null ? '0,00' : WowGames.fmt((performance.now() - t0) / 1000)}</b>s</span>
          <span>Erros: <b id="m-e">${erros}</b></span></div>
        <div class="jg-prog"><i style="width:${(etapa * POR_ETAPA + n) / TOTAL * 100}%"></i></div>
        <p class="jg-nome">${ETAPAS[etapa].nome}</p>
        <div class="jg-q">${q.t}</div>${campos}
        <button class="btn big" id="m-ok">Responder</button>
        <p class="jg-msg" id="m-msg">${aviso}</p>`;
      const ins = [...el.querySelectorAll('.jg-in')];
      ins[0].focus({ preventScroll: true });
      const enviar = () => {
        const v = ins.map(i => i.value.trim().replace(',', '.'));
        const msg = el.querySelector('#m-msg');
        if (v.some(x => x === '' || isNaN(Number(x)))) { msg.textContent = 'Digite um número em cada campo.'; return; }
        if (t0 === null) { t0 = performance.now(); tick(); } // o tempo começa na primeira resposta
        const dados = v.map(Number).sort((a, b) => a - b);
        const certo = [...q.r].sort((a, b) => a - b);
        if (dados.every((x, k) => Math.abs(x - certo[k]) < 1e-9)) return acertou();
        erros++;
        el.querySelector('#m-e').textContent = erros;
        msg.textContent = 'Não foi dessa vez. Tente de novo!';
        ins.forEach(i => { i.value = ''; });
        el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
        ins[0].focus({ preventScroll: true });
      };
      el.querySelector('#m-ok').onclick = enviar;
      ins.forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); }));
    }

    function acertou() {
      n++; aviso = 'Certo!';
      if (n === POR_ETAPA) {
        etapa++; n = 0;
        if (etapa === ETAPAS.length) return fim();
        aviso = `Etapa ${etapa} concluída! Agora: ${ETAPAS[etapa].nome}.`;
      }
      perguntar();
    }

    function fim() {
      cancelAnimationFrame(raf);
      const tempo = (performance.now() - t0) / 1000;
      const pontos = Math.max(0, Math.round(3000 - tempo * 10 - erros * 100));
      WowGames.evento({ jogo: 'matematica', tipo: 'fim', partida: true, tempo, erros, pontos });
      const nivel = pontos >= 2200 ? 'Calculadora humana. 🤖' : pontos >= 1500 ? 'Muito bom!' : pontos >= 800 ? 'Bom resultado.' : 'Terminou, e isso já conta.';
      el.innerHTML = `
        <div class="big-emoji">🏁</div>
        <h2>${nivel}</h2>
        <div class="tp-res">
          <div>Tempo total<b>${WowGames.fmt(tempo)}s</b></div>
          <div>Erros<b>${erros}</b></div>
          <div>Pontuação<b>${pontos}</b></div>
        </div>
        <p>Dá para fazer mais rápido? Jogue de novo e tente baixar esse tempo.</p>
        <button class="btn big" id="m-again">Jogar novamente</button>`;
      el.querySelector('#m-again').onclick = inicio;
      WowGames.confetti(el, ['🧮', '✨', '🎉']);
    }

    inicio();
    return () => cancelAnimationFrame(raf);
  }
});
