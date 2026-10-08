/* Jogo 3: Máquina de Prêmios */
(function () {
  // Chance (%) de cada raridade por giro. A soma deve dar 100.
  const RAR = [
    { nome: 'Comum',      chance: 54.95, cor: '#8d93a8', falas: ['Poderia ser pior.', 'Básico, mas honesto.', 'Bem, é alguma coisa.'] },
    { nome: 'Incomum',    chance: 26,  cor: '#2fb67c', falas: ['Opa, até que não é ruim!', 'Bom achado.'] },
    { nome: 'Raro',       chance: 12,  cor: '#3b8df0', falas: ['Agora sim! Isso brilha.', 'Pouca gente vê um desses.'] },
    { nome: 'Muito raro', chance: 6.5, cor: '#a05cf0', falas: ['Uau! Isso é sorte de verdade.', 'Tire print, ninguém vai acreditar.'] },
    { nome: 'Lendário',   chance: 0.5, cor: '#f5a300', falas: ['IMPOSSÍVEL. Isso é lendário!', 'A máquina tremeu. Você ouviu?'] },
    // Mítico: extremamente raro (0,05% no nível 1; varia só um pouco com os níveis da máquina). Não recebe o bônus do Giro da Sorte nem dos eventos (só um empurrãozinho nos níveis 6 e 7 da máquina)
    { nome: '🌌 Mítico',  chance: 0.05, cor: '#e63fc0', falas: ['O universo inteiro parou para ver isso.', 'Isso não deveria existir. Mas existe.', 'Quase ninguém na história viu este item.'] }
  ];
  // [índice da raridade, emoji, nome]. 30 prêmios no total (os 20 originais primeiro, depois os 10 novos de cada raridade).
  const PREMIOS = [
    [0,'🍎','Maçã'],[0,'🥤','Refrigerante'],[0,'🧦','Meia solitária'],[0,'🪙','Moeda'],[0,'🥄','Colher'],[0,'🎈','Balão'],
    [1,'🍕','Pizza'],[1,'🎮','Controle'],[1,'🎧','Fone'],[1,'🧸','Urso de pelúcia'],[1,'🪁','Pipa'],
    [2,'💎','Diamante'],[2,'👑','Coroa'],[2,'🛸','Objeto misterioso'],[2,'🏆','Troféu'],
    [3,'🦄','Unicórnio'],[3,'🌌','Galáxia'],[3,'🗿','Estátua misteriosa'],
    [4,'🐉','Dragão de bolso'],[4,'☄️','Cometa engarrafado'],
    // novos
    [0,'🍌','Banana'],[0,'📎','Clipe perdido'],[0,'🥫','Lata de feijão'],
    [1,'🎸','Guitarra'],
    [2,'🔮','Bola de cristal'],[2,'🧭','Bússola encantada'],
    [3,'🧞','Gênio da lâmpada'],[3,'🌋','Vulcão de mesa'],
    [4,'🌈','Pote de ouro'],
    [5,'🪐','Planeta de estimação']
  ].map(([r, e, n]) => ({ r, e, n, id: e }));

  // Probabilidade de cada prêmio = chance da raridade dividida pelo número de prêmios dela
  const tamanho = RAR.map((_, i) => PREMIOS.filter(p => p.r === i).length);
  PREMIOS.forEach(p => { p.peso = RAR[p.r].chance / tamanho[p.r]; });
  // Giro da Sorte: o peso de raro, muito raro e lendário é multiplicado por SORTE e o sorteio
  // continua aleatório (os pesos são renormalizados, não há prêmio garantido).
  const SORTE = 3, GIROS_POR_SORTE = 10;
  /* ----- Moedas, evolução da máquina e eventos: os números para ajustar ficam todos aqui ----- */
  const MOEDAS_REPETIDO = [5, 15, 40, 100, 300, 1000]; // moedas por item repetido, por raridade (igual para todos da mesma raridade)
  const BONUS_MOEDAS = [1, 1, 1, 1, 1, 1.10, 1.10];     // bônus de moedas por item repetido, por nível da máquina (níveis 6 e 7: +10%)
  const CUSTOS_EVOLUCAO = [100, 300, 750, 1500, 4500, 10000]; // custo de cada evolução: 1→2, 2→3, 3→4, 4→5, 5→6 e 6→7
  // Giros em lote: 2 giros desbloqueiam no nível 5 e 3 giros no nível 6 (o custo por giro é sempre o mesmo)
  const LOTE_NIVEL = { 2: 5, 3: 6 };
  const maxLote = nivel => nivel >= LOTE_NIVEL[3] ? 3 : nivel >= LOTE_NIVEL[2] ? 2 : 1;
  const GIRO_EXTRA_MOEDAS = 20;                         // bônus do evento Giro Extra
  const CHANCE_EVENTO = [0.08, 0.08, 0.10, 0.10, 0.12, 0.13, 0.15]; // chance de começar um evento depois de cada giro, por nível da máquina
  // mult = multiplicador do peso de cada raridade [comum, incomum, raro, muito raro, lendário, mítico]; o sorteio é renormalizado
  const MAQUINAS = [
    { icone: '🟢', nome: 'Máquina Básica',     mult: [1, 1, 1, 1, 1, 1],                efeito: 'Sistema normal.' },
    { icone: '🔵', nome: 'Máquina Aprimorada', mult: [1, 1.10, 1.10, 1.10, 1.10, 1],    efeito: 'Pequeno bônus em itens incomuns ou melhores.' },
    { icone: '🟣', nome: 'Máquina Avançada',   mult: [1, 1.15, 1.20, 1.20, 1.20, 1],    efeito: 'Mais bônus de raridade e eventos um pouco mais frequentes.' },
    { icone: '🟠', nome: 'Máquina Premium',    mult: [1, 1.15, 1.25, 1.35, 1.35, 1],    efeito: 'Bônus maior em raros ou melhores e recompensas com mais destaque.' },
    { icone: '🟡', nome: 'Máquina Lendária',   mult: [1, 1.20, 1.30, 1.40, 1.50, 1],    efeito: 'Bônus final, eventos duram 1 giro a mais e animação especial.' },
    { icone: '🔴', nome: 'Máquina Estelar',    mult: [1, 1.22, 1.33, 1.45, 1.55, 1.05], efeito: 'Bônus de sorte um pouco maior, eventos mais frequentes e +10% de moedas em itens repetidos.' },
    { icone: '🌌', nome: 'Máquina Mítica',     mult: [1, 1.25, 1.36, 1.50, 1.60, 1.15], efeito: 'Bônus máximo, eventos ainda mais frequentes e duram 2 giros a mais, brilho cósmico e o Mítico um pouco menos improvável.' }
  ];
  const EVENTOS = {
    raro:  { icone: '⚡', nome: 'HORA DO RARO',  duracao: 3, mult: [1, 1, 1.6, 1.6, 1.6, 1], texto: e => `Próximos ${e.total} giros com bônus de raridade.` },
    dupla: { icone: '💎', nome: 'CHANCE DUPLA',  duracao: 5, mult: [1, 1, 1, 1.5, 1.5, 1],   texto: () => 'Você recebeu um bônus temporário de sorte.' },
    extra: { icone: '🎁', nome: 'GIRO EXTRA',    duracao: 1, mult: null,                  texto: () => `O próximo giro dá uma recompensa extra: 🪙 +${GIRO_EXTRA_MOEDAS} moedas.` },
    sorte: { icone: '🍀', nome: 'SORTE GRANDE',  duracao: 3, mult: [1, 1.3, 1.3, 1.3, 1.3, 1], texto: () => 'A sorte da máquina aumentou um pouco.' }
  };

  // bonus (opcional) = multiplicadores por raridade vindos da máquina e dos eventos. Sem bônus, funciona como antes.
  const pesoDe = (p, mult, bonus) => p.peso * (p.r >= 2 && p.r <= 4 ? mult : 1) * (bonus ? bonus[p.r] : 1);

  function sortear(mult = 1, bonus = null) {
    const total = PREMIOS.reduce((s, p) => s + pesoDe(p, mult, bonus), 0);
    let x = Math.random() * total;
    for (const p of PREMIOS) { if ((x -= pesoDe(p, mult, bonus)) < 0) return p; }
    return PREMIOS[PREMIOS.length - 1];
  }
  const noSorte = i => i >= 2 && i <= 4;                    // o Giro da Sorte multiplica raro, muito raro e lendário (nunca o Mítico)
  const totSorte = RAR.reduce((s, r, i) => s + r.chance * (noSorte(i) ? SORTE : 1), 0);
  const pct = v => v.toFixed(2).replace('.', ',') + '%';
  // Arredonda para 2 casas pelo método do maior resto: os números mostrados na tela sempre somam exatamente 100,00%
  function arredondar(vals) {
    const t = vals.reduce((a, c) => a + c, 0), cent = vals.map(v => v / t * 10000), base = cent.map(Math.floor);
    let falta = 10000 - base.reduce((a, c) => a + c, 0);
    cent.map((c, i) => [c - base[i], i]).sort((a, b) => b[0] - a[0]).slice(0, falta).forEach(([, i]) => base[i]++);
    return base.map(c => c / 100);
  }
  const listaChances = vals => arredondar(vals).map((v, i) => RAR[i].nome + ' ' + pct(v)).join(', ');
  const chancesSorte = listaChances(RAR.map((r, i) => r.chance * (noSorte(i) ? SORTE : 1)));

  const KEY = 'wowgames.premios.v1', KEY_ANTIGA = 'recreio.premios.v1';
  const vazio = () => ({ giros: 0, normais: 0, sorte: 0, achados: {}, moedas: 0, nivel: 1, evento: null });
  function carregar() {
    let est;
    try { est = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(KEY_ANTIGA)); } catch (e) { est = null; }
    if (!est) return vazio();
    est.achados = est.achados || {};
    est.giros = est.giros || 0;
    if (est.normais === undefined) { est.normais = est.giros; est.sorte = Math.floor(est.giros / GIROS_POR_SORTE); } // saves antigos
    est.sorte = est.sorte || 0;
    est.moedas = est.moedas || 0;                                                       // saves antigos não têm moedas nem nível
    est.nivel = Math.min(MAQUINAS.length, Math.max(1, est.nivel || 1));
    if (!(est.evento && EVENTOS[est.evento.id] && est.evento.restantes > 0)) est.evento = null;
    return est;
  }

  WowGames.register({
    id: 'premios', nome: 'Máquina de Prêmios', icone: '🎁', cor: 'var(--mint)',
    desc: 'Gire a máquina e colecione todos os 30 prêmios. Existe um item mítico, quase impossível de achar.',

    mount(el) {
      let est = carregar(), girando = false, iv, to, avTo, msgEvol = '', lote = 1, pendente = null;
      const salvar = () => { try { localStorage.setItem(KEY, JSON.stringify(est)); } catch (e) {} };

      el.innerHTML = `
        <div class="pz-hud"><span>🪙 Moedas: <b id="pz-moedas">0</b></span><span id="pz-nivelhud"></span></div>
        <div class="pz-evento" id="pz-evento"></div>
        <div class="pz-aviso" id="pz-aviso"></div>
        <div class="pz-maq nv1" id="pz-maq">
          <div class="pz-window" id="pz-win"><span class="pz-sym" id="pz-sym">❓</span></div>
          <div class="pz-nome" id="pz-nome"></div>
        </div>
        <div class="pz-info" id="pz-info">Aperte o botão e descubra o que sai.</div>
        <div class="pz-sorte" id="pz-sorte"></div>
        <div class="pz-lotesel" id="pz-lotesel" role="group" aria-label="Quantidade de giros"></div>
        <div class="pz-custo" id="pz-custo"></div>
        <div class="pz-btns">
          <button class="btn big" id="pz-go">GIRAR</button>
          <button class="btn big lucky" id="pz-lucky">⭐ USAR GIRO DA SORTE 3x</button>
        </div>
        <div class="pz-stats" id="pz-stats"></div>
        <div class="pz-evol" id="pz-evol"></div>
        <h2 id="pz-tit"></h2>
        <div class="pz-col" id="pz-col"></div>
        <p class="pz-chances">Chances por giro: ${listaChances(RAR.map(r => r.chance))}.<br>Com Giro da Sorte (${SORTE}x em raro, muito raro e lendário; o Mítico não é afetado): ${chancesSorte}.</p>
        <p class="pz-chances" id="pz-atuais"></p>
        <button class="link" id="pz-reset">Zerar coleção</button>`;
      const $ = id => el.querySelector('#' + id);
      const win = $('pz-win'), sym = $('pz-sym'), info = $('pz-info'), btn = $('pz-go'), luckyBtn = $('pz-lucky');

      /* ----- Máquina, moedas e eventos ----- */
      const bonusAtual = () => RAR.map((_, r) => MAQUINAS[est.nivel - 1].mult[r] * (est.evento && EVENTOS[est.evento.id].mult ? EVENTOS[est.evento.id].mult[r] : 1));
      function chancesAtuais() {
        const b = bonusAtual(), por = RAR.map((_, r) => PREMIOS.filter(p => p.r === r).reduce((s, p) => s + pesoDe(p, 1, b), 0));
        const t = por.reduce((a, c) => a + c, 0);
        return listaChances(por);
      }
      function htmlEvento() {
        const e = est.evento; if (!e) return '';
        const d = EVENTOS[e.id];
        return `<div class="pz-ev ${e.id}"><b>${d.icone} ${d.nome}!</b><span>${d.texto(e)}</span><em>Giros restantes: ${e.restantes}</em></div>`;
      }
      function htmlEvol() {
        const m = MAQUINAS[est.nivel - 1], msg = msgEvol ? `<p class="pz-evmsg">${msgEvol}</p>` : '';
        if (est.nivel >= MAQUINAS.length) return `<h3>🏭 NÍVEL DA MÁQUINA</h3><div class="pz-niveis"><div><small>NÍVEL ATUAL</small><b>${m.icone} ${m.nome}</b><small>${m.efeito}</small></div></div><div class="pz-max">🏆 NÍVEL MÁXIMO<br>Você alcançou a ${m.nome}!</div>${msg}`;
        const prox = MAQUINAS[est.nivel], custo = CUSTOS_EVOLUCAO[est.nivel - 1], pct = Math.min(100, est.moedas / custo * 100), f = n => n.toLocaleString('pt-BR');
        return `<h3>🏭 NÍVEL DA MÁQUINA</h3>
          <div class="pz-niveis"><div><small>NÍVEL ATUAL</small><b>${m.icone} ${m.nome}</b><small>${m.efeito}</small></div>
            <div><small>PRÓXIMO NÍVEL</small><b>${prox.icone} ${prox.nome}</b><small>CUSTO: 🪙 ${f(custo)}</small><small>${prox.efeito}</small></div></div>
          <p>Progresso: <b>${f(est.moedas)} / ${f(custo)} moedas</b></p><div class="pz-barra"><i style="width:${pct}%"></i></div>
          <p>🪙 Suas moedas: <b>${f(est.moedas)}</b></p>
          <button class="btn" id="pz-evoluir">⬆️ EVOLUIR MÁQUINA</button>${msg}`;
      }
      function evoluir() {
        if (girando || est.nivel >= MAQUINAS.length) return;
        const custo = CUSTOS_EVOLUCAO[est.nivel - 1];
        if (est.moedas < custo) { msgEvol = `Você precisa de mais ${custo - est.moedas} moedas.`; return desenhar(); }
        if (!confirm('Você tem certeza que deseja evoluir a máquina?')) return;
        est.moedas -= custo; est.nivel++; salvar();
        const m = MAQUINAS[est.nivel - 1];
        msgEvol = `🎉 MÁQUINA EVOLUÍDA!<br>Agora você tem a ${m.icone} ${m.nome}.`;
        WowGames.evento({ jogo: 'premios', tipo: 'evolucao', nivel: est.nivel });
        desenhar();
        WowGames.confetti(el, [m.icone, '✨', '⬆️']);
      }
      // Depois de cada giro: desconta o giro do evento ativo ou, se não há evento, sorteia se começa um novo (nunca dois ao mesmo tempo)
      function passoEvento() {
        let terminou = null, iniciou = null;
        if (est.evento) {
          est.evento.restantes--;
          if (est.evento.restantes <= 0) { terminou = est.evento; est.evento = null; }
        } else if (Math.random() < CHANCE_EVENTO[est.nivel - 1]) {
          const ids = Object.keys(EVENTOS), id = ids[Math.floor(Math.random() * ids.length)];
          const dur = EVENTOS[id].duracao + (EVENTOS[id].duracao > 1 ? (est.nivel >= 7 ? 2 : est.nivel >= 5 ? 1 : 0) : 0); // nível 5: eventos duram 1 giro a mais; nível 7: 2 a mais
          est.evento = { id, restantes: dur, total: dur }; iniciou = est.evento;
        }
        return { terminou, iniciou };
      }
      function avisar(html) {
        const a = $('pz-aviso'); a.innerHTML = html; a.className = 'pz-aviso show';
        clearTimeout(avTo); avTo = setTimeout(() => { a.className = 'pz-aviso'; }, 4500);
      }

      function desenhar() {
        $('pz-moedas').textContent = est.moedas.toLocaleString('pt-BR');
        const mq = MAQUINAS[est.nivel - 1];
        $('pz-nivelhud').textContent = `${mq.icone} Nível ${est.nivel}`;
        $('pz-nome').textContent = `${mq.icone} ${mq.nome}`;
        $('pz-maq').className = 'pz-maq nv' + est.nivel;
        $('pz-evento').innerHTML = htmlEvento();
        $('pz-evol').innerHTML = htmlEvol();
        $('pz-atuais').textContent = est.nivel > 1 || est.evento ? `Chances atuais (giro normal, com a máquina e o evento ativo): ${chancesAtuais()}.` : '';
        $('pz-sorte').innerHTML = `Giros da sorte: ⭐ <b>${est.sorte}</b><small>Próximo em ${GIROS_POR_SORTE - (est.normais % GIROS_POR_SORTE)} giros normais</small>`;
        const ml = maxLote(est.nivel);
        if (lote > ml) lote = ml;                                     // se a máquina estiver abaixo do nível do lote escolhido, volta para uma opção válida
        $('pz-lotesel').innerHTML = [1, 2, 3].map(n => n <= ml
          ? `<button class="pz-lbtn ${n === lote ? 'on' : ''}" data-n="${n}" ${girando ? 'disabled' : ''}>${n} ${n > 1 ? 'GIROS' : 'GIRO'}</button>`
          : `<button class="pz-lbtn trava" disabled aria-label="${n} giros, desbloqueia no nível ${LOTE_NIVEL[n]}">🔒 ${n} GIROS<small>Desbloqueia no nível ${LOTE_NIVEL[n]}</small></button>`).join('');
        const faltam = Math.max(0, lote - est.sorte), gl = lote > 1 ? lote + ' giros' : '1 giro';
        $('pz-custo').innerHTML = `<div>🎰 <b>Giro normal:</b> custo total ${gl} <small>(grátis: nenhuma moeda é gasta)</small></div>` +
          `<div>⭐ <b>Giro da Sorte:</b> custo total ${lote} de ${est.sorte} ${est.sorte === 1 ? 'disponível' : 'disponíveis'}${faltam ? ` <small>(faltam ${faltam})</small>` : ''}</div>`;
        btn.textContent = lote > 1 ? `GIRAR ${lote}x` : 'GIRAR';
        luckyBtn.textContent = `⭐ USAR ${lote > 1 ? lote + ' GIROS' : 'GIRO'} DA SORTE 3x`;
        btn.disabled = girando;
        luckyBtn.disabled = girando || est.sorte < lote;
        const n = Object.keys(est.achados).length;
        const top = PREMIOS.filter(p => est.achados[p.id]).sort((a, b) => b.r - a.r)[0];
        $('pz-stats').innerHTML =
          `<div><b>${est.giros}</b>giros</div><div><b>${n}/${PREMIOS.length}</b>descobertos</div>` +
          `<div><b>${top ? top.e + ' ' + top.n : '—'}</b>mais raro</div>`;
        $('pz-tit').textContent = `Prêmios descobertos: ${n}/${PREMIOS.length}`;
        $('pz-col').innerHTML = PREMIOS.map(p => est.achados[p.id]
          ? `<div class="pz-cell" style="--c:${RAR[p.r].cor}"><span class="e">${p.e}</span>${p.n}<small>${RAR[p.r].nome} ×${est.achados[p.id]}</small></div>`
          : `<div class="pz-cell off"><span class="e">❔</span>???</div>`).join('');
      }

      /* Resolve UM giro por completo (sorteio, coleção, contadores, moedas e eventos). Os giros múltiplos chamam esta função uma vez por giro. */
      function resolver(sorte) {
        const eventoAtivo = est.evento ? est.evento.id : null;
        const p = sortear(sorte ? SORTE : 1, bonusAtual());          // exatamente um prêmio por giro
        const novo = !est.achados[p.id];
        est.giros++;
        let ganhouSorte = false;
        if (!sorte) { est.normais++; if (est.normais % GIROS_POR_SORTE === 0) { est.sorte++; ganhouSorte = true; } }
        est.achados[p.id] = (est.achados[p.id] || 0) + 1;     // a duplicata continua contando na coleção
        const moedasRepetido = novo ? 0 : Math.round(MOEDAS_REPETIDO[p.r] * BONUS_MOEDAS[est.nivel - 1]);   // só repetidos dão moedas
        const moedasExtra = eventoAtivo === 'extra' ? GIRO_EXTRA_MOEDAS : 0;
        est.moedas += moedasRepetido + moedasExtra;
        const ev = passoEvento();
        return { p, novo, sorte: !!sorte, ganhouSorte, moedasRepetido, moedasExtra, ev, descobertos: Object.keys(est.achados).length, nivel: est.nivel };
      }

      /* Avisa o perfil (XP, conquistas, desafio do dia) de cada giro, uma vez só por lote */
      function enviarEventos(pend) {
        if (!pend || pend.enviado) return;
        pend.enviado = true;
        for (const r of pend.res) WowGames.evento({ jogo: 'premios', tipo: 'giro', partida: true, raridade: r.p.r, novo: r.novo, sorte: r.sorte, descobertos: r.descobertos, nivel: r.nivel, lote: pend.res.length });
      }

      function girar(sorte) {
        const n = Math.min(maxLote(est.nivel), Math.max(1, lote));
        if (girando || (sorte && est.sorte < n)) return;        // nunca gasta mais giros da sorte do que possui
        girando = true; btn.disabled = true; luckyBtn.disabled = true; msgEvol = '';
        if (sorte) est.sorte -= n;                               // o Giro da Sorte é consumido ao usar
        const res = [];
        for (let i = 0; i < n; i++) res.push(resolver(sorte));   // cada giro é sorteado e contabilizado individualmente
        salvar();                                                // tudo já fica salvo antes da animação
        pendente = { res, enviado: false };
        $('pz-lotesel').querySelectorAll('button').forEach(b => { b.disabled = true; });
        win.className = 'pz-window gira';
        info.textContent = n > 1 ? `Girando ${n} vezes...` : 'Girando...';
        iv = setInterval(() => { sym.textContent = PREMIOS[Math.floor(Math.random() * PREMIOS.length)].e; }, 80);
        to = setTimeout(() => revelar(), n > 1 ? 1200 : 1800);
      }

      const classeJanela = p => 'pz-window' + (p.r >= 2 ? ' fx' : '') + (p.r === 4 ? ' leg' : '') + (p.r === 5 ? ' mit' : '');
      function mostrarSimbolo(p) {
        win.className = classeJanela(p);
        sym.textContent = p.e;
        sym.classList.remove('reveal'); void sym.offsetWidth; sym.classList.add('reveal');
        if (p.r >= 2) WowGames.confetti(el, [p.e, '✨', '🎉']);
        if (p.r === 5) WowGames.confetti(el, ['🌌', '🪐', '✨', '💫']);
      }
      function avisosDe(res) {
        const msgs = [];
        for (const r of res) {
          if (r.ev.terminou) msgs.push(`${EVENTOS[r.ev.terminou.id].icone} ${EVENTOS[r.ev.terminou.id].nome} terminou.`);
          if (r.ev.iniciou) { const d = EVENTOS[r.ev.iniciou.id], k = r.ev.iniciou.restantes; msgs.push(`${d.icone} ${d.nome} ATIVA!<br>[${k} ${k > 1 ? 'giros restantes' : 'giro restante'}]`); }
        }
        return msgs;
      }
      function fimDoLote(res) {
        enviarEventos(pendente); pendente = null;
        girando = false;
        desenhar();
        const msgs = avisosDe(res);
        if (msgs.length) {
          avisar(msgs.join('<br>'));
          if (res.some(r => r.ev.iniciou)) { const b = $('pz-evento').firstElementChild; if (b) b.classList.add('pop'); }
        }
      }

      function revelar() {
        clearInterval(iv);
        const res = pendente.res, n = res.length;
        if (n === 1) {                                           // 1 giro: exatamente como antes
          const x = res[0], p = x.p, r = RAR[p.r];
          mostrarSimbolo(p);
          info.innerHTML = (x.sorte ? '<small>⭐ Giro da Sorte 3x</small><br>' : '') + (x.novo ? '<div class="novo">NOVO PRÊMIO DESCOBERTO!</div>' : '') +
            `<span class="tag" style="background:${r.cor}">${r.nome}</span> <b>${p.n}</b><br>` +
            r.falas[Math.floor(Math.random() * r.falas.length)] +
            (x.ganhouSorte ? '<div class="novo">⭐ Você ganhou um Giro da Sorte!</div>' : '') +
            (x.novo ? '' : `<div class="rep">🔁 ITEM REPETIDO!</div><div class="moedas">🪙 +${x.moedasRepetido} moedas</div>`) +
            (x.moedasExtra ? `<div class="moedas">🎁 Giro Extra: 🪙 +${x.moedasExtra} moedas</div>` : '');
          return fimDoLote(res);
        }
        // 2 ou 3 giros: um cardzinho por giro, em sequência, e um resumo no final
        info.innerHTML = '<div class="pz-lote" id="pz-lote"></div><div class="pz-resumo" id="pz-resumo"></div>';
        let i = 0;
        const passo = () => {
          const x = res[i], p = x.p, r = RAR[p.r];
          mostrarSimbolo(p);
          const card = document.createElement('div');
          card.className = 'pz-card'; card.style.setProperty('--c', r.cor);
          card.innerHTML = `<small>GIRO ${i + 1}</small><span class="e">${p.e}</span><b>${p.n}</b><small>${r.nome}</small>` +
            (x.novo ? '<em>NOVO!</em>' : `<small>🪙 +${x.moedasRepetido + x.moedasExtra}</small>`);
          $('pz-lote').appendChild(card);
          i++;
          if (i < n) { to = setTimeout(passo, 450); return; }
          const moedas = res.reduce((t, y) => t + y.moedasRepetido + y.moedasExtra, 0), novos = res.filter(y => y.novo).length, sortes = res.filter(y => y.ganhouSorte).length;
          $('pz-resumo').innerHTML = `<b>${n} giros realizados</b><br>🪙 +${moedas} moedas${novos ? ` | ✨ ${novos} ${novos > 1 ? 'novos prêmios' : 'novo prêmio'}` : ''}${sortes ? ` | ⭐ +${sortes} Giro da Sorte` : ''}<br>` +
            `<small>Itens obtidos: ${res.map(y => y.p.e + ' ' + y.p.n).join(', ')}</small>` + (res.some(y => y.moedasExtra) ? '<br><small>🎁 Giro Extra incluído</small>' : '');
          fimDoLote(res);
        };
        passo();
      }

      btn.onclick = () => girar(false);
      luckyBtn.onclick = () => girar(true);
      $('pz-lotesel').onclick = e => { const b = e.target.closest('[data-n]'); if (!b || girando) return; lote = Math.min(maxLote(est.nivel), Math.max(1, Number(b.dataset.n) || 1)); desenhar(); };
      $('pz-evol').onclick = e => { if (e.target.closest('#pz-evoluir')) evoluir(); };
      $('pz-reset').onclick = () => {
        if (girando) return;
        if (!confirm('Apagar a coleção e as estatísticas? Suas moedas e o nível da máquina continuam.')) return;
        est = Object.assign(vazio(), { moedas: est.moedas, nivel: est.nivel, evento: est.evento }); salvar(); sym.textContent = '❓'; win.className = 'pz-window';
        info.textContent = 'Coleção zerada. Bora de novo.'; desenhar();
      };
      desenhar();
      return () => { clearInterval(iv); clearTimeout(to); clearTimeout(avTo); enviarEventos(pendente); };   // se sair no meio, o estado já está salvo; só avisa o perfil
    }
  });
})();
