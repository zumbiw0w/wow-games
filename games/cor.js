/* Jogo 5: Não Toque no Vermelho + Qual é a Cor? (15 rodadas) */
WowGames.register({
  id: 'cor', nome: 'Não Toque no Vermelho + Qual é a Cor?', icone: '🎨', cor: 'var(--coral)',
  desc: 'Evite o vermelho, ache o vermelho e descubra a cor do texto. Tudo misturado e cada vez mais rápido.',

  mount(el) {
    const RODADAS = 15;
    const COR = { vermelho: '#e5202e', azul: '#2f7bff', verde: '#1fa64a', amarelo: '#f2c200', roxo: '#a465ff', laranja: '#ff8a00', rosa: '#ff6fa5', bordo: '#7d1a2b' };
    const NOMES = ['vermelho', 'azul', 'verde', 'amarelo', 'roxo', 'laranja']; // cores usadas no "Qual é a cor?"
    const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const pick = a => a[ri(0, a.length - 1)];
    const embaralha = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    // 5 rodadas de cada tipo, em ordem aleatória, sem 3 iguais seguidas
    function ordem() {
      const base = [...Array(5).fill('nao'), ...Array(5).fill('sim'), ...Array(5).fill('stroop')];
      let o;
      do { o = embaralha(base); } while (o.some((x, i) => i > 1 && x === o[i - 1] && x === o[i - 2]));
      return o;
    }
    // Dificuldade crescente: mais elementos, elementos menores, menos tempo
    const cfg = r => ({ n: Math.min(14, 4 + Math.floor(r * .7)), tam: Math.max(46, 90 - r * 3), seg: Math.max(2.8, 7 - r * .28) });
    const paleta = r => r < 4 ? ['azul', 'verde', 'amarelo', 'roxo']
      : r < 8 ? ['azul', 'verde', 'amarelo', 'roxo', 'laranja']
      : ['laranja', 'rosa', 'bordo', 'roxo', 'amarelo', 'azul']; // tons mais próximos do vermelho

    let seq, r, erros, acertos, pontos, t0, raf, timer, travado;
    const tick = () => {
      const b = el.querySelector('#c-t');
      if (b) b.textContent = WowGames.fmt((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };

    function inicio() {
      clearTimeout(timer); cancelAnimationFrame(raf);
      el.innerHTML = `
        <div class="big-emoji">🎨</div>
        <h2>${RODADAS} rodadas, 3 desafios misturados</h2>
        <p><b>NÃO CLIQUE NO VERMELHO</b>: toque em qualquer elemento, menos nos vermelhos.</p>
        <p><b>CLIQUE NO VERMELHO</b>: ache o único elemento vermelho.</p>
        <p><b>QUAL É A COR?</b>: responda a cor do texto, não o que a palavra diz.</p>
        <button class="btn big" id="c-go">Começar</button>`;
      el.querySelector('#c-go').onclick = () => { seq = ordem(); r = 0; erros = 0; acertos = 0; pontos = 0; t0 = null; rodada(); };
    }

    function rodada() {
      const tipo = seq[r], { n, tam, seg } = cfg(r), tempo = seg + (tipo === 'stroop' ? 1 : 0);
      let instr, dica = '&nbsp;', corpo, cor;
      if (tipo === 'stroop') {
        cor = pick(NOMES);
        const palavra = pick(NOMES.filter(x => x !== cor));
        const total = r < 5 ? 4 : r < 10 ? 5 : 6;
        const ops = embaralha([cor, palavra, ...embaralha(NOMES.filter(x => x !== cor && x !== palavra)).slice(0, total - 2)]);
        instr = 'QUAL É A COR DO TEXTO?'; dica = 'Ignore o que a palavra diz.';
        corpo = `<div class="cr-palavra" style="color:${COR[cor]}">${palavra.toUpperCase()}</div>
          <div class="cr-ops">${ops.map(o => `<button class="btn" data-c="${o}">${o}</button>`).join('')}</div>`;
      } else {
        const reds = tipo === 'sim' ? 1 : ri(1, Math.max(1, Math.floor(n / 2)));
        const pal = paleta(r);
        const cores = embaralha([...Array(reds).fill('vermelho'), ...Array.from({ length: n - reds }, () => pick(pal))]);
        const palavras = r >= 4 && r <= 7; // quadrados com palavras para confundir
        instr = tipo === 'sim' ? 'CLIQUE NO VERMELHO' : 'NÃO CLIQUE NO VERMELHO';
        if (palavras) dica = 'Vale a cor do quadrado, não a palavra escrita nele.';
        corpo = `<div class="cr-tiles">${cores.map(c => `<button class="cr-tile" data-c="${c}"
          style="--sz:${tam}px;background:${COR[c]};color:${c === 'amarelo' || c === 'laranja' ? '#1c1840' : '#fff'};font-size:${Math.round(tam * .16)}px">${palavras ? pick(NOMES).toUpperCase() : ''}</button>`).join('')}</div>`;
      }
      el.innerHTML = `
        <div class="jg-top"><span>Rodada <b>${r + 1}</b>/${RODADAS}</span><span>Pontos: <b id="c-p">${pontos}</b></span>
          <span>Erros: <b id="c-e">${erros}</b></span><span>Tempo: <b id="c-t">${t0 === null ? '0,00' : WowGames.fmt((performance.now() - t0) / 1000)}</b>s</span></div>
        <div class="cr-instr">${instr}</div>
        <p class="jg-msg">${dica}</p>
        <div class="cr-barra"><i style="animation-duration:${tempo}s"></i></div>
        ${corpo}
        <p class="jg-msg" id="c-msg">&nbsp;</p>`;
      if (t0 === null) { t0 = performance.now(); tick(); }
      travado = false;
      const inicioRodada = performance.now();

      const responder = (ok, botao, esgotou) => {
        if (travado) return;
        travado = true; clearTimeout(timer);
        el.querySelector('.cr-barra i').style.animationPlayState = 'paused';
        const msg = el.querySelector('#c-msg');
        if (ok) {
          acertos++;
          pontos += 100 + Math.round(50 * Math.max(0, tempo - (performance.now() - inicioRodada) / 1000) / tempo);
          msg.textContent = 'Certo!';
        } else {
          erros++;
          if (botao) botao.classList.add('errado');
          const pre = esgotou ? 'Tempo esgotado! ' : '';
          if (tipo === 'stroop') {
            el.querySelector(`[data-c="${cor}"]`).classList.add('certo');
            msg.textContent = `${pre}A cor do texto era ${cor}.`;
          } else if (tipo === 'sim') {
            el.querySelector('[data-c="vermelho"]').classList.add('certo');
            msg.textContent = `${pre}O vermelho era este!`;
          } else {
            el.querySelectorAll('[data-c="vermelho"]').forEach(b => b.classList.add('perigo'));
            msg.textContent = `${pre}Era só evitar os vermelhos (marcados).`;
          }
        }
        el.querySelector('#c-p').textContent = pontos;
        el.querySelector('#c-e').textContent = erros;
        setTimeout(() => { if (++r >= RODADAS) fim(); else rodada(); }, ok ? 350 : 1500);
      };
      el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
        const c = b.dataset.c;
        responder(tipo === 'stroop' ? c === cor : tipo === 'sim' ? c === 'vermelho' : c !== 'vermelho', b);
      });
      timer = setTimeout(() => responder(false, null, true), tempo * 1000);
    }

    function fim() {
      cancelAnimationFrame(raf);
      const tempo = (performance.now() - t0) / 1000;
      WowGames.evento({ jogo: 'cor', tipo: 'fim', partida: true, tempo, erros, acertos, pontos });
      const nivel = pontos >= 1800 ? 'Reflexos de campeão! ⚡' : pontos >= 1200 ? 'Muito bem!' : pontos >= 600 ? 'Dá para melhorar.' : 'Respire fundo e tente de novo.';
      el.innerHTML = `
        <div class="big-emoji">🎯</div>
        <h2>${nivel}</h2>
        <div class="tp-res">
          <div>Pontuação<b>${pontos}</b></div>
          <div>Acertos<b>${acertos}/${RODADAS}</b></div>
          <div>Erros<b>${erros}</b></div>
          <div>Tempo<b>${WowGames.fmt(tempo)}s</b></div>
        </div>
        <button class="btn big" id="c-again">Jogar novamente</button>`;
      el.querySelector('#c-again').onclick = inicio;
      if (pontos >= 1200) WowGames.confetti(el, ['🎨', '✨', '🎉']);
    }

    inicio();
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); travado = true; };
  }
});
