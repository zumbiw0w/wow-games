/* Jogo 9: Adivinhe o Peso.
   Dois animais por rodada: quantos do primeiro pesam o mesmo que UM do segundo? Os pesos abaixo são valores de REFERÊNCIA do próprio jogo
   (não é uma simulação científica). Todas as respostas saem desta tabela, sempre como número inteiro.
   Pontuação global: regra "peso" em pontuacao.js (o jogo envia pontos, acertos e erros no evento de fim de partida). */
WowGames.register({
  id: 'peso', nome: 'Adivinhe o Peso', icone: '⚖️', cor: 'var(--sun)',
  desc: 'Quantos coelhos pesam o mesmo que um elefante? Estime o peso dos animais em dez rodadas cada vez mais difíceis.',

  mount(el) {
    /* Peso de referência de cada animal, em GRAMAS (inteiros, para a divisão nunca gerar fração por erro de ponto flutuante). */
    const ANIMAIS = [
      { e: '🐭', n: 'Camundongo', pl: 'Camundongos', g: 20 },
      { e: '🐦', n: 'Passarinho', pl: 'Passarinhos', g: 40 },
      { e: '🐹', n: 'Hamster', pl: 'Hamsters', g: 100 },
      { e: '🦉', n: 'Coruja', pl: 'Corujas', g: 1000 },
      { e: '🐓', n: 'Galinha', pl: 'Galinhas', g: 2000 },
      { e: '🐇', n: 'Coelho', pl: 'Coelhos', g: 4000 },
      { e: '🐈', n: 'Gato', pl: 'Gatos', g: 5000 },
      { e: '🐕', n: 'Cachorro', pl: 'Cachorros', g: 20000 },
      { e: '🐧', n: 'Pinguim', pl: 'Pinguins', g: 25000 },
      { e: '🐑', n: 'Ovelha', pl: 'Ovelhas', g: 80000 },
      { e: '🦁', n: 'Leão', pl: 'Leões', g: 160000 },
      { e: '🐖', n: 'Porco', pl: 'Porcos', g: 200000 },
      { e: '🐻', n: 'Urso', pl: 'Ursos', g: 400000 },
      { e: '🐎', n: 'Cavalo', pl: 'Cavalos', g: 500000 },
      { e: '🐄', n: 'Vaca', pl: 'Vacas', g: 600000 },
      { e: '🦒', n: 'Girafa', pl: 'Girafas', g: 1000000 },
      { e: '🦏', n: 'Rinoceronte', pl: 'Rinocerontes', g: 2000000 },
      { e: '🐘', n: 'Elefante', pl: 'Elefantes', g: 5000000 },
      { e: '🐋', n: 'Baleia', pl: 'Baleias', g: 100000000 }
    ];
    const RAZAO_MIN = 2, RAZAO_MAX = 2000;
    const NIVEIS = [                                   // até que razão vai cada nível, margem de acerto e pontos-base da rodada
      { nome: 'Fácil', ate: 10, margem: 0.20, base: 60 },
      { nome: 'Médio', ate: 50, margem: 0.20, base: 100 },
      { nome: 'Difícil', ate: 200, margem: 0.25, base: 150 },
      { nome: 'Extremo', ate: RAZAO_MAX, margem: 0.30, base: 220 }
    ];
    const PLANO = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3];     // nível de cada uma das 10 rodadas: dificuldade progressiva
    const BONUS_EXATO = 1.5;                            // acertar o número exato vale 50% a mais
    const nivelDe = r => NIVEIS.findIndex(n => r <= n.ate);

    // Todas as combinações (leve → pesado) em que o peso do pesado é múltiplo exato do leve: a resposta é sempre inteira.
    const PARES = [];
    ANIMAIS.forEach(a => ANIMAIS.forEach(b => {
      if (b.g > a.g && b.g % a.g === 0) { const r = b.g / a.g; if (r >= RAZAO_MIN && r <= RAZAO_MAX) PARES.push({ a, b, r, nivel: nivelDe(r) }); }
    }));

    const pesoKg = g => (g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' kg';
    const faixa = (r, m) => ({ lo: Math.ceil(r * (1 - m) - 1e-9), hi: Math.floor(r * (1 + m) + 1e-9) });   // respostas que contam como acerto
    const num = n => n.toLocaleString('pt-BR');
    const sorteia = v => v[Math.floor(Math.random() * v.length)];

    let rodadas, i, acertos, exatos, pontos, atual;

    // Monta as 10 rodadas: sem repetir combinação e, se possível, sem repetir animais da rodada anterior.
    function montar() {
      const usados = new Set(), lista = [];
      PLANO.forEach(nv => {
        const ant = lista[lista.length - 1];
        const livres = PARES.filter(p => p.nivel === nv && !usados.has(p.a.e + p.b.e));
        const novos = ant ? livres.filter(p => ![p.a.e, p.b.e].some(e => e === ant.a.e || e === ant.b.e)) : livres;
        const p = sorteia(novos.length ? novos : livres);
        usados.add(p.a.e + p.b.e); lista.push(p);
      });
      return lista;
    }

    function inicio() {
      el.innerHTML = `
        <div class="big-emoji">⚖️</div>
        <h2>Adivinhe o Peso</h2>
        <p>Dois animais aparecem por rodada. Descubra quantos do primeiro pesam o mesmo que <b>um</b> do segundo.</p>
        <p>São 10 rodadas, cada vez mais difíceis. Os pesos são valores de referência do jogo, então use o seu bom senso!</p>
        <p class="pw-dica">Vale chegar perto: cada nível aceita uma margem de erro (de 20% a 30%). Acertar o número exato rende bônus.</p>
        <button class="btn big" id="pw-go">Começar</button>`;
      el.querySelector('#pw-go').onclick = () => { rodadas = montar(); i = 0; acertos = 0; exatos = 0; pontos = 0; pergunta(); };
    }

    function pergunta() {
      atual = rodadas[i];
      const { a, b } = atual, nv = NIVEIS[atual.nivel];
      el.innerHTML = `
        <div class="jg-top"><span>Rodada <b>${i + 1}</b>/${rodadas.length}</span><span>Acertos: <b>${acertos}</b></span><span class="pw-nivel n${atual.nivel}">Nível: <b>${nv.nome}</b></span></div>
        <div class="jg-prog"><i style="width:${i / rodadas.length * 100}%"></i></div>
        <div class="pw-par" aria-hidden="true">
          <div class="pw-an"><span class="pw-e">${a.e}</span><b>${a.n}</b></div>
          <span class="pw-seta">➜</span>
          <div class="pw-an"><span class="pw-e">${b.e}</span><b>${b.n}</b></div>
        </div>
        <p class="pw-perg">Quantos <b>${a.e} ${a.pl}</b> juntos pesam o mesmo que <b>1 ${b.e} ${b.n}</b>?</p>
        <div class="jg-campos"><input class="jg-in" id="pw-in" type="number" inputmode="numeric" min="1" step="1" autocomplete="off" aria-label="Quantidade de ${a.pl}"></div>
        <button class="btn big" id="pw-ok">Confirmar</button>
        <p class="jg-msg" id="pw-msg">Margem aceita neste nível: ±${Math.round(nv.margem * 100)}%.</p>
        <button class="link" id="pw-reset">Reiniciar partida</button>`;
      const inp = el.querySelector('#pw-in');
      inp.focus({ preventScroll: true });
      const enviar = () => {
        const v = Number(inp.value.trim().replace(',', '.'));
        const msg = el.querySelector('#pw-msg');
        if (inp.value.trim() === '' || !isFinite(v) || v <= 0) { msg.textContent = 'Digite um número maior que zero.'; return; }
        responder(v);
      };
      el.querySelector('#pw-ok').onclick = enviar;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });
      el.querySelector('#pw-reset').onclick = inicio;
    }

    function responder(v) {
      const { a, b, r, nivel } = atual, nv = NIVEIS[nivel], f = faixa(r, nv.margem);
      const exato = v === r, perto = v >= f.lo && v <= f.hi;
      const ganho = exato ? Math.round(nv.base * BONUS_EXATO) : perto ? nv.base : 0;     // erro não pontua
      if (perto) acertos++;
      if (exato) exatos++;
      pontos += ganho;
      atual.resp = v; atual.ganho = ganho; atual.res = exato ? 'exato' : perto ? 'perto' : 'erro';
      const titulo = exato ? '🎯 Na mosca!' : perto ? '👍 Perto o bastante!' : '❌ Não foi dessa vez';
      el.innerHTML = `
        <div class="jg-top"><span>Rodada <b>${i + 1}</b>/${rodadas.length}</span><span>Acertos: <b>${acertos}</b></span><span class="pw-nivel n${nivel}">Nível: <b>${nv.nome}</b></span></div>
        <div class="jg-prog"><i style="width:${(i + 1) / rodadas.length * 100}%"></i></div>
        <div class="pw-par" aria-hidden="true"><div class="pw-an"><span class="pw-e">${a.e}</span><b>${a.n}</b></div><span class="pw-seta">➜</span><div class="pw-an"><span class="pw-e">${b.e}</span><b>${b.n}</b></div></div>
        <div class="pw-res ${atual.res}" role="status">
          <h3>${titulo}</h3>
          <p>Você respondeu <b>${num(v)}</b>. A resposta certa é <b>${num(r)}</b> ${a.pl.toLowerCase()}.</p>
          ${!exato && perto ? `<p>Respostas de ${num(f.lo)} a ${num(f.hi)} contam como acerto neste nível.</p>` : ''}
          <p class="pw-conta">${b.e} ${b.n} pesa ${pesoKg(b.g)} e ${a.e} ${a.n} pesa ${pesoKg(a.g)}.<br>Cálculo: peso do ${b.n} ÷ peso do ${a.n} = ${pesoKg(b.g)} ÷ ${pesoKg(a.g)} = <b>${num(r)}</b>.</p>
          <p class="pw-pts">${ganho ? '+' + num(ganho) + ' pontos nesta rodada' : 'Nenhum ponto nesta rodada'}</p>
        </div>
        <button class="btn big" id="pw-next">${i + 1 === rodadas.length ? 'Ver resultado' : 'Próxima rodada'}</button>`;
      const nx = el.querySelector('#pw-next');
      nx.onclick = () => { if (++i === rodadas.length) fim(); else pergunta(); };
      nx.focus({ preventScroll: true });
    }

    function fim() {
      const total = rodadas.length, erros = total - acertos;
      const bonus = acertos === total ? 200 : acertos >= 8 ? 100 : 0;                   // bônus pelo desempenho geral da partida
      const final = pontos + bonus;
      const rp = WowGames.evento({ jogo: 'peso', tipo: 'fim', partida: true, rodadas: total, acertos, erros, exatos, pontos: final });
      const nivel = acertos === total ? 'Balança humana! ⚖️' : acertos >= 8 ? 'Olho clínico! 👀' : acertos >= 5 ? 'Boas estimativas!' : acertos >= 3 ? 'Dá para melhorar. Tente de novo!' : 'Os animais enganaram você. Jogue de novo!';
      el.innerHTML = `
        <div class="big-emoji">🏁</div>
        <h2>${nivel}</h2>
        <div class="tp-res">
          <div>Acertos<b>${acertos}</b></div><div>Erros<b>${erros}</b></div><div>Na mosca<b>${exatos}</b></div><div>Rodadas<b>${total}</b></div>
        </div>
        ${bonus ? `<p>Bônus de desempenho: +${bonus} pontos.</p>` : ''}
        ${WowGames.Pontos ? WowGames.Pontos.html(rp) : `<p>Pontos da partida: ${num(final)}</p>`}
        <ul class="pw-resumo">${rodadas.map((x, k) => `<li class="${x.res}"><span>${k + 1}. ${x.a.e} ➜ ${x.b.e}</span><span>você: ${num(x.resp)} | certo: ${num(x.r)}</span><b>${x.res === 'exato' ? '🎯' : x.res === 'perto' ? '👍' : '❌'}</b></li>`).join('')}</ul>
        <button class="btn big" id="pw-again">Jogar novamente</button>`;
      el.querySelector('#pw-again').onclick = inicio;
      if (acertos >= 5) WowGames.confetti(el, ['⚖️', '🐘', '🐇', '✨']);
    }

    inicio();
    return () => {};
  }
});
