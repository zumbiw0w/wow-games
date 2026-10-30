/* Jogo: Repita a Sequência (id 'repita') — observe os botões acenderem e repita na mesma ordem.
   - A cada rodada a sequência ganha um passo. A demonstração acelera só um pouco a cada rodada.
   - Durante a demonstração os botões ficam bloqueados. Cada partida tem um "token": reiniciar ou sair invalida
     todos os timers antigos, então nenhuma sequência velha continua tocando.
   - Som opcional (botão 🔊/🔇). Nada toca antes de o jogador clicar em Jogar. Cada botão tem cor, símbolo e tecla próprios.
   - Salva só a preferência de som em wowgames.repita.v1. Recordes ficam no perfil, como nos outros jogos. */
(function () {
  const A = WowGames.Arcade; if (!A) return;
  const ID = 'repita', CHAVE = 'wowgames.repita.v1';
  const BOTOES = [
    { cor: '#2ecc71', escuro: '#1e8e4f', simbolo: '▲', nome: 'verde', tecla: '1', alt: 'q', freq: 392 },
    { cor: '#e74c3c', escuro: '#a5281c', simbolo: '●', nome: 'vermelho', tecla: '2', alt: 'w', freq: 523.25 },
    { cor: '#f1c40f', escuro: '#a88705', simbolo: '■', nome: 'amarelo', tecla: '3', alt: 'a', freq: 659.25 },
    { cor: '#3498db', escuro: '#1f6594', simbolo: '★', nome: 'azul', tecla: '4', alt: 's', freq: 783.99 }
  ];
  // ritmo da demonstração: começa calmo e acelera aos poucos (nunca abaixo de 260 ms aceso)
  const ritmo = n => ({ aceso: Math.max(260, 560 - (n - 1) * 18), pausa: Math.max(110, 230 - (n - 1) * 7) });
  const pontosDa = n => n * (n + 1) * 5;                                // soma de 10 × tamanho de cada sequência completada

  function lerSom() { try { const s = JSON.parse(localStorage.getItem(CHAVE)); return s && s.v === 1 ? !!s.som : true; } catch (e) { return true; } }   // ligado por padrão, mas só toca depois do clique em Jogar
  function gravarSom(on) { try { localStorage.setItem(CHAVE, JSON.stringify({ v: 1, som: !!on })); } catch (e) {} }

  const Perfil = WowGames.Perfil;
  if (Perfil) {
    Perfil.registrarJogo({ id: ID, nome: 'Repita a Sequência', icone: '🟢', xp: ev => ev.tipo === 'fim' ? Math.min(40, 8 + ev.sequencia * 3) : 0,
      recordes: [{ id: 'pontos', rotulo: 'Repita a Sequência: maior pontuação', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.pontos : null, fmt: A.num },
                 { id: 'sequencia', rotulo: 'Repita a Sequência: maior sequência', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.sequencia : null, fmt: v => v + ' passos' }] });
    Perfil.registrarConquista({ id: 'repitamemoria', icone: '🧠', nome: 'Boa Memória', desc: 'Repita uma sequência de 8 passos no Repita a Sequência.', xp: 60,
      ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.sequencia >= 8 });
    Perfil.registrarConquista({ id: 'repitaextra', icone: '🌟', nome: 'Memória Extraordinária', desc: 'Repita uma sequência de 15 passos no Repita a Sequência.', xp: 150,
      ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.sequencia >= 15 });
  }
  if (WowGames.Pontos) WowGames.Pontos.registrar(ID, { limite: 5, mostrarZero: ev => ev.tipo === 'fim', calcula: ev => ev.tipo === 'fim' ? Math.max(0, Math.round(ev.pontos)) : 0 });

  WowGames.RepitaJogo = { atual: null, ritmo, pontosDa };

  WowGames.register({
    id: ID, nome: 'Repita a Sequência', icone: '🟢', cor: '#7ee0a3',
    desc: 'Observe os botões acenderem e repita a sequência. A cada rodada, um passo a mais.',

    mount(el) {
      let som = lerSom();
      const Q = A.quadro(el, { id: ID, nome: 'Repita a Sequência', icone: '🟢', cor: '#7ee0a3',
        stats: [{ id: 'nivel', rotulo: 'Sequência', inicial: '0' }, { id: 'pontos', rotulo: 'Pontos' }, { id: 'rec', rotulo: 'Recorde', inicial: '—' }],
        extraTopo: `<button class="arc-stat rps-som" data-rps="som" aria-pressed="${som}"><small>Som</small><b>${som ? '🔊' : '🔇'}</b></button>`,
        palco: `<div class="rps-area"><p class="rps-msg" aria-live="polite" data-rps="msg">Pronto?</p>
          <div class="rps-grade">${BOTOES.map((b, i) => `<button class="rps-b" data-i="${i}" style="--c:${b.cor};--e:${b.escuro}" aria-label="Botão ${b.nome} (${b.simbolo}), tecla ${b.tecla}" disabled>
            <span class="rps-sim">${b.simbolo}</span><small>${b.tecla}</small></button>`).join('')}</div></div>`,
        rodape: 'Clique ou toque nos botões. No teclado: 1, 2, 3 e 4 (ou Q, W, A, S).' });
      const audio = A.sons();
      const bts = [...el.querySelectorAll('.rps-b')], msg = el.querySelector('[data-rps="msg"]');
      let seq = [], pos = 0, estado = 'inicio', token = 0, timers = [], completas = 0, ultimaEntrada = 0;
      const later = (fn, ms) => { const tk = token, t = setTimeout(() => { timers = timers.filter(x => x !== t); if (tk === token) fn(); }, ms); timers.push(t); };
      const limpar = () => { token++; timers.forEach(clearTimeout); timers = []; bts.forEach(b => b.classList.remove('on', 'erro', 'certo')); };
      const bloquear = on => { bts.forEach(b => { b.disabled = on; }); Q.raiz.classList.toggle('rps-vez', !on); };
      const recTxt = () => { const r = A.recorde(ID, 'sequencia'); return r === null ? null : r + ' passos'; };
      const atualizarRec = () => Q.stat('rec', A.recorde(ID, 'sequencia') === null ? '—' : String(A.recorde(ID, 'sequencia')));
      // sequência confiável: crypto quando disponível, sem repetir o mesmo botão 3 vezes seguidas
      const sortear = () => {
        const r = () => { if (window.crypto && crypto.getRandomValues) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } return Math.random(); };
        let i;
        do { i = Math.floor(r() * 4); } while (seq.length >= 2 && seq[seq.length - 1] === i && seq[seq.length - 2] === i);
        return i;
      };
      function acender(i, ms, tocar = true) {
        const b = bts[i]; b.classList.add('on');
        if (tocar && som) audio.tocar(BOTOES[i].freq, Math.min(.5, ms / 1000), { tipo: 'triangle', ganho: .13 });
        later(() => b.classList.remove('on'), ms);
      }

      function telaInicio() {
        estado = 'inicio'; limpar(); bloquear(true); msg.textContent = 'Pronto?'; atualizarRec();
        Q.inicio({ regras: ['Os botões acendem em sequência. <b>Observe</b>.', 'Depois, <b>repita</b> na mesma ordem.', 'A cada rodada entra mais um passo. Errou, acabou.'],
          recordeTxt: recTxt(), aoJogar: comecar });
      }
      function comecar() {
        limpar(); Q.esconder();
        seq = []; completas = 0; Q.stat('nivel', '0'); Q.stat('pontos', '0');
        proximaRodada(500);
      }
      function proximaRodada(espera) {
        estado = 'demo'; bloquear(true); pos = 0;
        seq.push(sortear());
        msg.textContent = 'Observe…';
        const { aceso, pausa } = ritmo(seq.length);
        let t = espera;
        seq.forEach(i => { later(() => acender(i, aceso), t); t += aceso + pausa; });
        later(() => { estado = 'vez'; bloquear(false); msg.textContent = 'Sua vez! (' + seq.length + (seq.length === 1 ? ' passo)' : ' passos)'); }, t);
      }
      function apertar(i) {
        if (estado !== 'vez') return;                                    // bloqueado durante a demonstração e no fim
        const agora = performance.now();
        if (agora - ultimaEntrada < 90) return;                          // evita o mesmo toque contar duas vezes
        ultimaEntrada = agora;
        if (i === seq[pos]) {
          acender(i, 220); pos++;
          if (pos === seq.length) {
            completas = seq.length; estado = 'demo'; bloquear(true);
            Q.stat('nivel', String(completas)); Q.stat('pontos', A.num(pontosDa(completas)));
            msg.textContent = completas % 5 === 0 ? `Muito bem! ${completas} passos!` : 'Isso!';
            bts.forEach(b => b.classList.add('certo')); later(() => bts.forEach(b => b.classList.remove('certo')), 380);
            proximaRodada(900);
          }
        } else errar(i);
      }
      function errar(i) {
        estado = 'fim'; bloquear(true);
        const certo = seq[pos];
        bts[i].classList.add('erro'); if (som) audio.tocar(150, .5, { tipo: 'sawtooth', ganho: .08 });
        msg.textContent = `Era o ${BOTOES[certo].simbolo} ${BOTOES[certo].nome}.`;
        let k = 0; const piscar = () => { bts[certo].classList.toggle('on'); if (++k < 6) later(piscar, 160); };
        later(piscar, 250);
        later(() => {
          bts.forEach(b => b.classList.remove('on', 'erro'));
          const pontos = pontosDa(completas);
          const r = A.terminar(ID, { pontos, sequencia: completas, nivel: completas + 1 });
          atualizarRec();
          Q.resultado({ titulo: completas >= 15 ? 'Memória incrível!' : completas >= 8 ? 'Boa memória!' : 'Fim de jogo', emoji: '🟢', novoRecorde: r.novoRecorde, rp: r.rp, aoJogar: comecar,
            linhas: [['Nível alcançado', String(completas + 1)], ['Maior sequência', completas + ' passos'], ['Pontos', A.num(pontos)], ['Recorde', (A.recorde(ID, 'sequencia') ?? 0) + ' passos']] });
        }, 1500);
      }

      const aoApontar = e => {
        const b = e.target.closest('.rps-b'); if (!b) return;
        e.preventDefault(); apertar(+b.dataset.i);
      };
      el.addEventListener('pointerdown', aoApontar);
      const aoClicar = e => {
        const s = e.target.closest('[data-rps="som"]'); if (!s) return;
        som = !som; gravarSom(som); s.setAttribute('aria-pressed', String(som)); s.querySelector('b').textContent = som ? '🔊' : '🔇';
        if (som) audio.tocar(660, .12, { ganho: .08 });
      };
      el.addEventListener('click', aoClicar);
      const tecla = e => {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase(), i = BOTOES.findIndex(b => b.tecla === k || b.alt === k);
        if (i >= 0 && estado === 'vez') { e.preventDefault(); apertar(i); }
      };
      document.addEventListener('keydown', tecla);

      telaInicio();
      WowGames.RepitaJogo.atual = { estado: () => estado, seq: () => seq.slice(), apertar, timersAtivos: () => timers.length, som: () => som, audioCriado: audio.criado };
      return () => { limpar(); audio.fechar(); el.removeEventListener('pointerdown', aoApontar); el.removeEventListener('click', aoClicar); document.removeEventListener('keydown', tecla); WowGames.RepitaJogo.atual = null; };
    }
  });
})();
