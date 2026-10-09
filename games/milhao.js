/* Jogo 8: Rumo ao Milhão. Todo o dinheiro é virtual e existe só dentro do jogo.
   Os números de equilíbrio (limites, multiplicadores, tempos) estão nas constantes do topo. */
(function () {
  const KEY = 'wowgames.milhao.v1';
  const INICIAL = 1000, META = 1000000, MIN_VALOR = 10;
  const BANCO_MS = 5 * 60 * 1000, BANCO_MULT = 10;
  const BANCO_LIMITE = 0.10;          // por depósito: até 10% do patrimônio (mínimo R$100), para o Banco não dominar o jogo
  const FOGUETE_VEL = 0.1;            // multiplicador = e^(0.1 * segundos): 2x em ~7s, 10x em ~23s
  const NIVEIS = [[5, 1], [6, 1], [8, 2], [8, 2], [9, 3], [10, 3], [10, 4], [12, 5]]; // [caixas, bombas] de cada nível da Bomba
  const PASSO = NIVEIS.map(([n, b]) => Math.floor(97 * n / (n - b)) / 100);            // multiplicador de cada nível (probabilidade justa -3%)

  /* Roleta: resultados e chances (soma = 100). Retorno médio = soma(multiplicador x chance) = 92,5%: a longo prazo a roleta consome o saldo,
     então não é um atalho para o milhão. Em simulação (20 mil jogadores apostando sempre o máximo permitido) ninguém chegou a R$1.000.000 só com ela. */
  const ROLETA = [
    { id: 'zero',  icone: '💨', nome: 'Nada',             mult: 0,   chance: 36,   cor: '#ffd0d6' },
    { id: 'meio',  icone: '🌧️', nome: 'Perdeu metade',    mult: 0.5, chance: 24,   cor: '#ffe3c2' },
    { id: 'um',    icone: '🤝', nome: 'Valor devolvido',  mult: 1,   chance: 21,   cor: '#e8e8f2' },
    { id: 'dois',  icone: '✨', nome: 'Dobrou',           mult: 2,   chance: 12.5, cor: '#c9f5df' },
    { id: 'tres',  icone: '🔥', nome: 'Triplicou',        mult: 3,   chance: 5,    cor: '#b9e3ff' },
    { id: 'dez',   icone: '💎', nome: 'Super prêmio',     mult: 10,  chance: 1.2,  cor: '#e3ccff' },
    { id: 'vinte', icone: '🌟', nome: 'Prêmio raríssimo', mult: 25,  chance: 0.3,  cor: '#ffe27a' }
  ];
  const ROLETA_RETORNO = ROLETA.reduce((t, o) => t + o.mult * o.chance / 100, 0);
  const ROLETA_LIMITE = 0.10, ROLETA_MIN_MAX = 100, ROLETA_TETO = 50000;   // por rodada: até 10% do patrimônio (mínimo R$100), nunca mais de R$50.000 e nunca mais que o saldo
  // 14 casas da roda (só visual: as chances reais são as da tabela)
  const RODA = ['zero', 'meio', 'um', 'dois', 'zero', 'meio', 'um', 'tres', 'zero', 'um', 'dois', 'meio', 'dez', 'vinte'];
  const RODA_PASSO = 360 / RODA.length;
  const rotuloMult = m => m === 0.5 ? '½x' : m + 'x';
  const pctR = v => v.toString().replace('.', ',') + '%';
  const sinal = n => (n >= 0 ? '+' : '-') + 'R$' + Math.floor(Math.abs(n)).toLocaleString('pt-BR');

  const brl = n => 'R$' + Math.floor(n).toLocaleString('pt-BR');
  const xf = m => m.toFixed(2).replace('.', ',') + 'x';
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const horas = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 3600) ? Math.floor(s / 3600) + 'h ' + Math.floor(s % 3600 / 60) + 'min' : Math.floor(s / 60) + 'min ' + (s % 60) + 's'; };
  const mult = t => Math.exp(FOGUETE_VEL * t);
  // Ponto em que o foguete para: chance de passar de m = 97% / m (mínimo 1,05x, máximo 500x)
  const crashPoint = () => Math.min(500, Math.max(1.05, Math.floor(97 / (1 - Math.random())) / 100));
  const sorteia = (n, b) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, b); };

  const patrimonio = S => S.saldo + (S.foguete ? S.foguete.stake : 0) + (S.bomba ? S.bomba.stake : 0) + (S.banco ? S.banco.valor : 0);
  const novoEstado = () => ({ saldo: INICIAL, maxPat: INICIAL, foguete: null, bomba: null, banco: null, metas: {}, venceu: null, roletaHist: [],
    stats: { foguetes: 0, bombas: 0, bancos: 0, maxMult: 0, melhorNivel: 0, tempoMs: 0, roletas: 0, roletaMaxMult: 0, roletaSaldo: 0 } });

  /* Metas: 'pat' = metas de patrimônio (aparecem uma de cada vez); as outras aparecem depois de você usar o modo */
  const METAS = [
    { id: 'p1', pat: true, icone: '🎯', nome: 'Primeiro passo', desc: 'Chegue a R$2.000', premio: 100, ok: S => patrimonio(S) >= 2000 },
    { id: 'p2', pat: true, icone: '🎯', nome: 'Pequeno investidor', desc: 'Chegue a R$5.000', premio: 250, ok: S => patrimonio(S) >= 5000 },
    { id: 'p3', pat: true, icone: '🎯', nome: 'Cinco dígitos', desc: 'Chegue a R$10.000', premio: 500, ok: S => patrimonio(S) >= 10000 },
    { id: 'p4', pat: true, icone: '🎯', nome: 'Seis dígitos', desc: 'Chegue a R$100.000', premio: 5000, ok: S => patrimonio(S) >= 100000 },
    { id: 'p5', pat: true, icone: '🎯', nome: 'Meio caminho', desc: 'Chegue a R$500.000', premio: 10000, ok: S => patrimonio(S) >= 500000 },
    { id: 'p6', pat: true, icone: '🏆', nome: 'RUMO AO MILHÃO', desc: 'Chegue a R$1.000.000', premio: 0, ok: S => patrimonio(S) >= META },
    { id: 'c1', icone: '🚀', nome: 'Piloto', desc: 'Colete o Foguete acima de 5,00x', premio: 200, ok: S => S.stats.maxMult > 5 && S.stats.foguetes > 0, mostrar: S => S.stats.foguetes > 0 },
    { id: 'c2', icone: '💣', nome: 'Sobrevivente', desc: 'Passe por 4 níveis da Bomba em um só desafio', premio: 200, ok: S => S.stats.melhorNivel >= 4, mostrar: S => S.stats.bombas > 0 },
    { id: 'c3', icone: '🏦', nome: 'Paciência recompensada', desc: 'Conclua um investimento no Banco', premio: 100, ok: S => S.stats.bancos >= 1, mostrar: S => S.stats.bancos > 0 || !!S.banco }
  ];

  const ler = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const carregar = () => { const b = novoEstado(), s = ler(), r = Object.assign(b, s, { stats: Object.assign(b.stats, s.stats || {}), metas: s.metas || {} }); r.roletaHist = Array.isArray(r.roletaHist) ? r.roletaHist.slice(-10) : []; return r; };

  WowGames.register({
    id: 'milhao', nome: 'Rumo ao Milhão', icone: '💰', cor: '#8ee0b0',
    desc: 'Comece com R$1.000 e tente chegar ao seu primeiro milhão.',

    mount(el) {
      let S = carregar(), aba = 'inicio', raf = 0, iv = 0, ult = Date.now();
      let resRl = null, rolando = null, toR = 0, rodaRot = 0, ultimaAposta = 50;
      let resFg = null, resBm = null, resBk = null, avisos = [], festa = false, bkPronto = !!S.banco && Date.now() >= S.banco.fim;
      const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
      const $ = s => el.querySelector(s);

      /* Atualiza metas (com recompensa), maior patrimônio e vitória. Chamar depois de qualquer mudança de saldo. */
      function checar() {
        let mudou = true;
        while (mudou) {
          mudou = false;
          for (const m of METAS) if (!S.metas[m.id] && m.ok(S)) { S.metas[m.id] = true; S.saldo += m.premio; mudou = true; avisos.push(`🎯 Meta concluída: ${m.nome}${m.premio ? ' (+' + brl(m.premio) + ')' : ''}`); }
        }
        S.maxPat = Math.max(S.maxPat, patrimonio(S));
        WowGames.evento({ jogo: 'milhao', tipo: 'progresso', patrimonio: patrimonio(S), maxPat: S.maxPat });
        if (!S.venceu && patrimonio(S) >= META) {
          S.venceu = { pat: patrimonio(S), tempoMs: S.stats.tempoMs, maxMult: S.stats.maxMult, desafios: S.stats.foguetes + S.stats.bombas, bancos: S.stats.bancos };
          festa = true;
          const rp = WowGames.evento({ jogo: 'milhao', tipo: 'fim', partida: true, patrimonio: patrimonio(S) });
          if (rp && rp.base > 0) S.venceu.pt = { pontos: rp.pontos, base: rp.base, total: rp.total, reduzido: rp.reduzido };
        }
        guardar();
      }

      /* ---------- Partes comuns ---------- */
      function topo() {
        const p = patrimonio(S), pct = Math.min(100, p / META * 100);
        const partes = [`Disponível ${brl(S.saldo)}`];
        if (S.banco) partes.push(`No banco ${brl(S.banco.valor)}`);
        const emJogo = (S.foguete ? S.foguete.stake : 0) + (S.bomba ? S.bomba.stake : 0);
        if (emJogo) partes.push(`Em desafio ${brl(emJogo)}`);
        return `<div class="mi-top">
            <div><small>💰 Patrimônio</small><b>${brl(p)}</b></div><div><small>🎯 Meta</small><b>${brl(META)}</b></div>
            <div><small>📊 Progresso</small><b>${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</b></div></div>
          <div class="mi-barra"><i style="width:${Math.max(pct, 0.6)}%"></i></div><p class="mi-sub">${partes.join(' | ')}</p>`;
      }
      function form(max, acao, rotulo) {
        return `<div class="mi-form"><p><b>Quanto você quer colocar no desafio?</b><br><small>Disponível: ${brl(S.saldo)}${max < S.saldo ? ' | Máximo desta vez: ' + brl(max) : ''}</small></p>
          <input id="mi-v" class="jg-in mi-in" type="number" inputmode="numeric" min="${MIN_VALOR}" max="${max}" step="1" data-max="${max}" placeholder="R$">
          <div class="mi-chips">${[10, 25, 50, 100].map(p => `<button class="mi-chip" data-a="pct" data-v="${p}">${p === 100 ? 'Máximo' : p + '%'}</button>`).join('')}</div>
          <p class="jg-msg" id="mi-err"></p><button class="btn big" data-a="${acao}">${rotulo}</button></div>`;
      }
      function lerValor() {
        const i = $('#mi-v'), v = Math.floor(Number(i.value)), max = Number(i.dataset.max), err = $('#mi-err');
        if (!i.value || !isFinite(v) || v < MIN_VALOR) { err.textContent = `Digite um valor de pelo menos ${brl(MIN_VALOR)}.`; return null; }
        if (v > max) { err.textContent = `Valor acima do permitido. O máximo agora é ${brl(max)}.`; return null; }
        return v;
      }
      const caixaRes = r => r ? `<div class="mi-res ${r.ok ? 'ok' : 'perdeu'} ca-pop">${r.txt}</div>` : '';

      /* ---------- Foguete ---------- */
      function vFoguete() {
        const f = S.foguete;
        const cena = `<div class="mi-cena ${f ? 'voando' : ''}"><span class="mi-foguete" id="fg-r" style="left:8%;bottom:8%">🚀</span></div>`;
        if (!f) return `<h3>🚀 Desafio do Foguete</h3><p>O multiplicador sobe a cada instante, mas o foguete pode parar a qualquer momento. Colete antes disso. Se ele parar, o valor do desafio é perdido.</p>${cena}${caixaRes(resFg)}${form(S.saldo, 'lancar', '🚀 Lançar foguete')}`;
        return `<h3>🚀 Foguete no ar!</h3>${cena}
          <div class="mi-voo"><div><small>Multiplicador</small><b id="fg-m">1,00x</b></div><div><small>Valor no desafio</small><b>${brl(f.stake)}</b></div><div><small>Valor atual</small><b id="fg-v">${brl(f.stake)}</b></div></div>
          <button class="btn big mi-coletar" data-a="coletarF">COLETAR</button>`;
      }
      function desenhaFoguete(m) {
        const f = S.foguete, mm = Math.floor(m * 100) / 100;
        if (!$('#fg-m')) return;
        $('#fg-m').textContent = xf(mm); $('#fg-v').textContent = brl(f.stake * mm);
        const p = Math.min(1, Math.log(m) / Math.log(20)), r = $('#fg-r');
        r.style.left = (8 + 70 * p) + '%'; r.style.bottom = (8 + 58 * p) + '%';
      }
      function voo() {
        cancelAnimationFrame(raf);
        const f = S.foguete; if (!f) return;
        const m = mult((Date.now() - f.inicio) / 1000);
        if (m >= f.crash) return perdeFoguete(false);
        desenhaFoguete(m); raf = requestAnimationFrame(voo);
      }
      function perdeFoguete(fora) {
        const f = S.foguete; S.foguete = null;
        const rp = WowGames.evento({ jogo: 'milhao', tipo: 'foguete', partida: true, mult: 0, perdeu: true });   // derrota: 0 pontos
        resFg = { ok: false, txt: `💥 O foguete parou em <b>${xf(f.crash)}</b>${fora ? ' enquanto você estava fora' : ''}. Você perdeu ${brl(f.stake)} de dinheiro virtual.` + (WowGames.Pontos ? WowGames.Pontos.html(rp) : '') };
        checar(); render();
      }
      function coletarFoguete() {
        const f = S.foguete; if (!f) return;
        const m = Math.floor(mult((Date.now() - f.inicio) / 1000) * 100) / 100;
        if (m >= f.crash) return perdeFoguete(false);
        cancelAnimationFrame(raf);
        const ganho = Math.floor(f.stake * m); S.saldo += ganho; S.foguete = null;
        S.stats.maxMult = Math.max(S.stats.maxMult, m);
        const rp = WowGames.evento({ jogo: 'milhao', tipo: 'foguete', partida: true, mult: m, ganho });
        resFg = { ok: true, txt: `✅ Você coletou em <b>${xf(m)}</b> e recebeu <b>${brl(ganho)}</b> (${ganho >= f.stake ? 'lucro' : 'resultado'} de ${brl(ganho - f.stake)}).` + (WowGames.Pontos ? WowGames.Pontos.html(rp) : '') };
        checar(); render();
      }

      /* ---------- Bomba ---------- */
      function vBomba() {
        const b = S.bomba;
        if (!b) {
          const rev = resBm && resBm.rev ? tabuleiro(resBm.rev) : '';
          return `<h3>💣 Desafio da Bomba</h3><p>Escolha uma caixa por nível. Se for segura, o multiplicador sobe e você decide: continuar ou encerrar e coletar. Se achar a bomba, o valor do desafio é perdido. A cada nível, há mais caixas e mais bombas.</p>${caixaRes(resBm)}${rev}${form(S.saldo, 'iniciarB', '💣 Começar desafio')}`;
        }
        const [n, bo] = NIVEIS[b.nivel], valor = Math.floor(b.stake * b.mult);
        return `<h3>💣 Nível ${b.nivel + 1} de ${NIVEIS.length}</h3><p>${n} caixas, ${bo} ${bo > 1 ? 'bombas' : 'bomba'}. Acertando este nível: ×${PASSO[b.nivel].toFixed(2).replace('.', ',')}</p>
          <div class="mi-voo"><div><small>Multiplicador</small><b>${xf(b.mult)}</b></div><div><small>Valor no desafio</small><b>${brl(b.stake)}</b></div><div><small>Valor atual</small><b>${brl(valor)}</b></div></div>
          <div class="mi-tab">${[...Array(n).keys()].map(i => `<button class="mi-cx" data-a="cx" data-v="${i}" aria-label="Caixa ${i + 1}">?</button>`).join('')}</div>
          <button class="btn big mi-coletar" data-a="coletarB" ${b.nivel > 0 ? '' : 'disabled'}>${b.nivel > 0 ? 'Encerrar e coletar ' + brl(valor) : 'Escolha uma caixa para começar'}</button>`;
      }
      const tabuleiro = r => `<div class="mi-tab rev">${[...Array(r.n).keys()].map(i => `<span class="mi-cx ${r.bombas.includes(i) ? 'bomba' : 'seguro'} ${i === r.esc ? 'esc' : ''}">${r.bombas.includes(i) ? '💣' : '⭐'}</span>`).join('')}</div>`;
      function iniciarBomba(v) {
        S.saldo -= v; S.stats.bombas++;
        S.bomba = { stake: v, nivel: 0, mult: 1, bombas: sorteia(NIVEIS[0][0], NIVEIS[0][1]) }; resBm = null;
      }
      function escolhaBomba(i) {
        const b = S.bomba; if (!b) return;
        const [n] = NIVEIS[b.nivel];
        if (b.bombas.includes(i)) {
          resBm = { ok: false, rev: { n, bombas: b.bombas, esc: i }, txt: `💥 Era a bomba! Você perdeu ${brl(b.stake)} de dinheiro virtual no nível ${b.nivel + 1}. Veja onde ela estava:` };
          const rp = WowGames.evento({ jogo: 'milhao', tipo: 'bomba', partida: true, perdeu: true, niveis: b.nivel });
          if (WowGames.Pontos) resBm.txt += WowGames.Pontos.html(rp);
          S.bomba = null; return checar(), render();
        }
        b.mult = Math.round(b.mult * PASSO[b.nivel] * 100) / 100; b.nivel++;
        S.stats.melhorNivel = Math.max(S.stats.melhorNivel, b.nivel);
        if (b.nivel >= NIVEIS.length) return coletarBomba(true);
        b.bombas = sorteia(NIVEIS[b.nivel][0], NIVEIS[b.nivel][1]);
        checar(); render();
      }
      function coletarBomba(completo) {
        const b = S.bomba; if (!b) return;
        const ganho = Math.floor(b.stake * b.mult); S.saldo += ganho; S.bomba = null;
        S.stats.maxMult = Math.max(S.stats.maxMult, b.mult);
        const rp = WowGames.evento({ jogo: 'milhao', tipo: 'bomba', partida: true, mult: b.mult, niveis: b.nivel });
        resBm = { ok: true, txt: `${completo ? '🏁 Você passou por todos os níveis! ' : '✅ '}Multiplicador final <b>${xf(b.mult)}</b>: você recebeu <b>${brl(ganho)}</b>.` + (WowGames.Pontos ? WowGames.Pontos.html(rp) : '') };
        checar(); render();
      }

      /* ---------- Roleta ---------- */
      const maxRoleta = () => Math.max(0, Math.min(S.saldo, ROLETA_TETO, Math.max(ROLETA_MIN_MAX, Math.floor(patrimonio(S) * ROLETA_LIMITE))));
      function htmlRoda() {
        const grad = RODA.map((id, i) => `${ROLETA.find(o => o.id === id).cor} ${i * RODA_PASSO}deg ${(i + 1) * RODA_PASSO}deg`).join(',');
        const rot = RODA.map((id, i) => `<span class="mi-rl" style="transform:rotate(${(i + 0.5) * RODA_PASSO}deg) translateY(-92px)">${rotuloMult(ROLETA.find(o => o.id === id).mult)}</span>`).join('');
        return `<div class="mi-roda-box"><span class="mi-ponteiro">▼</span><div class="mi-roda" id="rl-roda" style="background:conic-gradient(${grad});transform:rotate(${rodaRot}deg)">${rot}<i class="mi-hub">🎡</i></div></div>`;
      }
      function vRoleta() {
        const max = maxRoleta(), pode = max >= MIN_VALOR;
        const ini = Math.max(Math.min(MIN_VALOR, max), Math.min(max, ultimaAposta));
        const chips = [10, 50, 100, 500, 1000].filter(v => v < max).concat(pode ? [max] : []);
        const tabela = ROLETA.map(o => `<div class="mi-rt" style="--c:${o.cor}"><span>${o.icone}</span><b>${xf(o.mult)}</b><small>${o.nome}</small><small>${pctR(o.chance)}</small></div>`).join('');
        const hist = S.roletaHist.length ? `<h4>Últimas rodadas</h4><ul class="mi-hist">${S.roletaHist.slice().reverse().slice(0, 5).map(h => `<li><span>${brl(h.aposta)} → ${xf(h.mult)}</span><b class="${h.liq >= 0 ? 'g' : 'p'}">${sinal(h.liq)}</b></li>`).join('')}</ul>` : '';
        return `<h3>🎡 ROLETA</h3>
          <p class="mi-aviso">🎲 <b>Os resultados são aleatórios e você pode perder o dinheiro virtual que colocar.</b> O retorno médio é de ${(ROLETA_RETORNO * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%: a longo prazo, a roleta tende a gastar o seu saldo.</p>
          ${htmlRoda()}
          <p class="mi-nota">A roda é só ilustrativa. As chances reais de cada resultado estão na tabela abaixo.</p>
          ${caixaRes(resRl)}
          <div class="mi-voo"><div><small>Saldo atual</small><b>${brl(S.saldo)}</b></div><div><small>Valor selecionado</small><b id="rl-sel">${pode ? brl(ini) : '-'}</b></div><div><small>Máximo por rodada</small><b>${brl(max)}</b></div></div>
          ${pode ? `<div class="mi-form"><input id="mi-v" class="jg-in mi-in" type="number" inputmode="numeric" min="${MIN_VALOR}" max="${max}" step="1" data-max="${max}" value="${ini}" placeholder="R$">
            <div class="mi-chips">${chips.map((v, i) => `<button class="mi-chip" data-a="valr" data-v="${v}">${i === chips.length - 1 ? 'Máximo' : brl(v)}</button>`).join('')}</div>
            <p class="jg-msg" id="mi-err"></p><button class="btn big" data-a="girarR" ${rolando ? 'disabled' : ''}>🎡 Girar roleta</button></div>
            <p class="mi-nota">Valor mínimo ${brl(MIN_VALOR)}. Máximo por rodada: 10% do seu patrimônio (pelo menos ${brl(ROLETA_MIN_MAX)}), até ${brl(ROLETA_TETO)}, e nunca mais do que você tem disponível.</p>`
          : `<div class="mi-res perdeu"><p>Você precisa de pelo menos ${brl(MIN_VALOR)} disponíveis para girar a roleta.</p></div>`}
          <h4>Resultados possíveis</h4><div class="mi-rtab">${tabela}</div>${hist}`;
      }
      function girarRoleta() {
        if (rolando) return;
        const x = lerValor(); if (x === null) return;
        const max = maxRoleta();
        if (x > S.saldo || x > max) { $('#mi-err').textContent = `Valor acima do permitido. O máximo agora é ${brl(max)}.`; return; }
        let r = Math.random() * 100, out = ROLETA[ROLETA.length - 1];
        for (const o of ROLETA) { if ((r -= o.chance) < 0) { out = o; break; } }
        const ganho = Math.floor(x * out.mult), liq = ganho - x;
        S.saldo += liq; ultimaAposta = x;                       // o resultado já vale e fica salvo; a animação só mostra
        S.stats.roletas++; S.stats.roletaSaldo += liq; S.stats.roletaMaxMult = Math.max(S.stats.roletaMaxMult, out.mult);
        S.roletaHist.push({ aposta: x, mult: out.mult, liq }); S.roletaHist = S.roletaHist.slice(-10);
        guardar();
        rolando = { x, ganho, liq, out }; resRl = null;
        const slots = RODA.map((id, i) => id === out.id ? i : -1).filter(i => i >= 0), slot = slots[Math.floor(Math.random() * slots.length)];
        const centro = (slot + 0.5) * RODA_PASSO + (Math.random() - 0.5) * RODA_PASSO * 0.5;
        rodaRot = Math.ceil(rodaRot / 360) * 360 + 360 * 4 + (360 - centro);
        const roda = $('#rl-roda'), bt = $('[data-a="girarR"]');
        if (bt) bt.disabled = true;
        if (roda) { void roda.offsetWidth; roda.style.transition = 'transform 2.4s cubic-bezier(.12,.7,.15,1)'; roda.style.transform = `rotate(${rodaRot}deg)`; }
        toR = setTimeout(() => fimRoleta(true), 2500);
      }
      function fimRoleta(desenhar) {
        const r = rolando; if (!r) return;
        rolando = null; clearTimeout(toR);
        resRl = { ok: r.liq >= 0, txt: `${r.out.icone} <b>${r.out.nome}</b> (${xf(r.out.mult)}). Você colocou ${brl(r.x)} e recebeu <b>${brl(r.ganho)}</b>: ${r.liq >= 0 ? (r.liq > 0 ? 'lucro' : 'sem lucro nem prejuízo') : 'prejuízo'} de ${sinal(r.liq)}.` };
        WowGames.evento({ jogo: 'milhao', tipo: 'roleta', partida: true, mult: r.out.mult, aposta: r.x, ganho: r.ganho });
        checar();
        if (desenhar) render();
      }

      /* ---------- Banco ---------- */
      const limiteBanco = () => Math.min(S.saldo, Math.max(100, Math.floor(patrimonio(S) * BANCO_LIMITE)));
      function vBanco() {
        const k = S.banco;
        if (!k) return `<h3>🏦 Banco</h3><p>Deixe o dinheiro virtual trabalhar: ele fica bloqueado por <b>5 minutos reais</b> e volta multiplicado por <b>${BANCO_MULT}</b>. Só é possível ter um investimento ativo por vez, e cada depósito tem um limite.</p>${caixaRes(resBk)}${form(limiteBanco(), 'depositar', '🏦 Depositar')}`;
        const resto = k.fim - Date.now(), pronto = resto <= 0;
        if (pronto) return `<div class="mi-res ok ca-pop"><h3>🎉 INVESTIMENTO CONCLUÍDO!</h3><p>Você recebeu <b>${brl(k.valor * BANCO_MULT)}</b>.</p></div><button class="btn big" data-a="resgatar">RESGATAR</button>`;
        return `<h3>🏦 INVESTIMENTO ATIVO</h3>
          <div class="mi-voo"><div><small>Valor</small><b>${brl(k.valor)}</b></div><div><small>Retorno</small><b>${brl(k.valor * BANCO_MULT)}</b></div><div><small>Tempo restante</small><b id="bk-t">${mmss(resto)}</b></div></div>
          <div class="mi-barra"><i id="bk-b" style="width:${Math.min(100, (1 - resto / BANCO_MS) * 100)}%"></i></div><p><b>AGUARDANDO...</b> Você pode jogar nos outros desafios enquanto espera, e fechar a página sem perder o tempo.</p>`;
      }
      function bancoTick() {
        const k = S.banco;
        if (!k) { bkPronto = false; return; }
        const resto = k.fim - Date.now(), pronto = resto <= 0;
        if (pronto !== bkPronto) { bkPronto = pronto; return render(); }
        if ($('#bk-t')) { $('#bk-t').textContent = mmss(resto); $('#bk-b').style.width = Math.min(100, (1 - resto / BANCO_MS) * 100) + '%'; }
      }

      /* ---------- Início, estatísticas e vitória ---------- */
      function vInicio() {
        const op = (id, ic, nome, d, c) => `<button class="mi-opcao ${c}" data-a="aba" data-v="${id}"><span>${ic}</span><b>${nome}</b><small>${d}</small></button>`;
        return `<h2>💰 Rumo ao Milhão</h2><p>Você começa com R$1.000. Consegue transformar isso em R$1.000.000?</p>
          <div class="mi-opcoes">${op('foguete', '🚀', 'FOGUETE', 'Desafio de multiplicação', 'a')}${op('bomba', '💣', 'BOMBA', 'Desafio de risco', 'b')}${op('banco', '🏦', 'BANCO', 'Deixe seu dinheiro trabalhar', 'c')}${op('roleta', '🎡', 'ROLETA', 'Gire e arrisque', 'd')}</div>`;
      }
      function vInfo() {
        const st = S.stats, linhas = [['Patrimônio atual', brl(patrimonio(S))], ['Maior patrimônio alcançado', brl(S.maxPat)], ['Desafios do Foguete', st.foguetes], ['Desafios da Bomba', st.bombas],
          ['Investimentos no Banco', st.bancos], ['Rodadas da Roleta', st.roletas], ['Maior resultado da Roleta', st.roletaMaxMult ? xf(st.roletaMaxMult) : '-'], ['Resultado total da Roleta', st.roletas ? sinal(st.roletaSaldo) : '-'], ['Maior multiplicador coletado', st.maxMult ? xf(st.maxMult) : '-'], ['Tempo total jogando', horas(st.tempoMs)],
          ['Progresso até R$1.000.000', Math.min(100, patrimonio(S) / META * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%']];
        const proxima = METAS.find(m => m.pat && !S.metas[m.id]);
        const vis = METAS.filter(m => S.metas[m.id] || m === proxima || (!m.pat && m.mostrar(S)));
        return `<h3>📊 Estatísticas</h3><div class="mi-stats">${linhas.map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
          <h3>🏆 Metas</h3><div class="mi-metas">${vis.map(m => `<div class="mi-meta ${S.metas[m.id] ? 'ok' : ''}"><span>${S.metas[m.id] ? '✅' : m.icone}</span><div><b>${m.nome}</b><small>${m.desc}${m.premio && !S.metas[m.id] ? ' | recompensa ' + brl(m.premio) : ''}</small></div></div>`).join('')}</div>
          <p><small>🔒 Novas metas aparecem conforme você avança.</small></p><button class="link" data-a="reiniciar">Reiniciar este jogo</button>`;
      }
      function telaVitoria() {
        const v = S.venceu;
        return `<div class="ca-capa ca-pop">🏆</div><h2 class="mi-c">VOCÊ CHEGOU AO MILHÃO!</h2>
          <p class="mi-c">Você transformou R$1.000 em R$1.000.000 de dinheiro virtual.</p>
          <div class="mi-stats"><div><small>Patrimônio final</small><b>${brl(v.pat)}</b></div><div><small>Tempo necessário</small><b>${horas(v.tempoMs)}</b></div><div><small>Maior multiplicador</small><b>${v.maxMult ? xf(v.maxMult) : '-'}</b></div>
            <div><small>Desafios jogados</small><b>${v.desafios}</b></div><div><small>Investimentos no Banco</small><b>${v.bancos}</b></div></div>
          ${WowGames.Pontos ? WowGames.Pontos.html(v.pt) : ''}
          <p class="mi-c">Dá para fazer mais rápido? Jogue de novo e tente baixar o seu tempo.</p><div class="mi-c"><button class="btn big" data-a="novo">JOGAR NOVAMENTE</button></div>`;
      }

      const ABAS = [['inicio', '🏠 Início'], ['foguete', '🚀 Foguete'], ['bomba', '💣 Bomba'], ['banco', '🏦 Banco'], ['roleta', '🎡 Roleta'], ['info', '📊 Metas e estatísticas']];
      function render() {
        if (S.venceu) el.innerHTML = `<div class="mi">${telaVitoria()}</div>`;
        else {
          const corpo = { inicio: vInicio, foguete: vFoguete, bomba: vBomba, banco: vBanco, roleta: vRoleta, info: vInfo }[aba]();
          const sem = S.saldo < MIN_VALOR && !S.foguete && !S.bomba && !S.banco;
          el.innerHTML = `<div class="mi">${topo()}${avisos.map(a => `<div class="mi-meta-aviso ca-pop">${a}</div>`).join('')}
            <nav class="ca-abas">${ABAS.map(([id, n]) => `<button class="ca-aba ${aba === id ? 'on' : ''}" data-a="aba" data-v="${id}">${n}${id === 'banco' && bkPronto ? ' ✅' : ''}</button>`).join('')}</nav>
            ${sem ? '<div class="mi-res perdeu"><p>Você ficou sem dinheiro virtual. Que tal recomeçar com R$1.000?</p><button class="btn" data-a="recomecar">Recomeçar</button></div>' : ''}
            <div class="mi-corpo ca-fade">${corpo}</div>
            <p class="mi-nota">Todo o dinheiro deste jogo é virtual e fictício. Não existe dinheiro real, depósito, saque ou prêmio real.</p></div>`;
        }
        if (festa) { festa = false; WowGames.confetti(el, ['💰', '✨', '🎉', '🏆']); }
      }

      function reiniciar() { S = novoEstado(); guardar(); cancelAnimationFrame(raf); clearTimeout(toR); rolando = null; resRl = null; rodaRot = 0; resFg = resBm = resBk = null; avisos = []; aba = 'inicio'; bkPronto = false; }

      el.onclick = e => {
        const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
        const v = b.dataset.v; avisos = [];
        switch (b.dataset.a) {
          case 'aba': aba = v; break;
          case 'pct': {
            const i = $('#mi-v'), max = Number(i.dataset.max);
            i.value = Math.max(Math.min(MIN_VALOR, max), Math.min(max, Math.floor(max * Number(v) / 100))); return;
          }
          case 'lancar': { const x = lerValor(); if (x === null) return; S.saldo -= x; S.stats.foguetes++; S.foguete = { stake: x, inicio: Date.now(), crash: crashPoint() }; resFg = null; checar(); render(); return voo(); }
          case 'valr': { const i = $('#mi-v'); if (!i) return; i.value = Math.min(Number(i.dataset.max), Number(v)); i.dispatchEvent(new Event('input', { bubbles: true })); return; }
          case 'girarR': return girarRoleta();
          case 'coletarF': return coletarFoguete();
          case 'iniciarB': { const x = lerValor(); if (x === null) return; iniciarBomba(x); checar(); break; }
          case 'cx': return escolhaBomba(Number(v));
          case 'coletarB': return coletarBomba(false);
          case 'depositar': { const x = lerValor(); if (x === null) return; if (S.banco) return; S.saldo -= x; S.banco = { valor: x, inicio: Date.now(), fim: Date.now() + BANCO_MS }; resBk = null; bkPronto = false; checar(); break; }
          case 'resgatar': {
            const k = S.banco; if (!k || Date.now() < k.fim) return;
            const g = k.valor * BANCO_MULT; S.saldo += g; S.banco = null; S.stats.bancos++; bkPronto = false;
            const rp = WowGames.evento({ jogo: 'milhao', tipo: 'banco', partida: true });
            resBk = { ok: true, txt: `✅ Você resgatou ${brl(g)} do Banco.` + (WowGames.Pontos ? WowGames.Pontos.html(rp) : '') }; checar(); break;
          }
          case 'recomecar': reiniciar(); break;
          case 'novo': case 'reiniciar': if (!confirm('Isso apaga apenas o progresso deste jogo (Rumo ao Milhão). Continuar?')) return; reiniciar(); break;
        }
        render();
      };

      el.oninput = e => {                                        // mostra o valor selecionado da roleta enquanto digita
        if (e.target.id !== 'mi-v' || !$('#rl-sel')) return;
        const v = Math.floor(Number(e.target.value));
        $('#rl-sel').textContent = e.target.value && isFinite(v) && v > 0 ? brl(v) : '-';
      };
      iv = setInterval(() => {
        const agora = Date.now();
        if (!document.hidden && !S.venceu) S.stats.tempoMs += Math.min(agora - ult, 5000);
        ult = agora; bancoTick(); guardar();
      }, 1000);

      /* Retomar o que estava em andamento ao abrir a página */
      if (S.foguete) { if (mult((Date.now() - S.foguete.inicio) / 1000) >= S.foguete.crash) perdeFoguete(true); else voo(); }
      checar(); render();
      return () => { cancelAnimationFrame(raf); clearInterval(iv); fimRoleta(false); guardar(); };
    }
  });
})();
