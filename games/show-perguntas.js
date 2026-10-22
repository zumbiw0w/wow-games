/* Jogo 12: Show de Perguntas.
   Escada de 15 perguntas de múltipla escolha, com dificuldade crescente, marcos garantidos e quatro ajudas (uma vez cada por partida).
   - Perguntas: games/perguntas-show.js (WowGames.ShowBanco), validadas ao carregar. Perguntas inválidas são ignoradas, sem quebrar o site.
   - Perfil, XP, recordes e conquistas: registrados aqui com WowGames.Perfil.registrarJogo/registrarConquista (o mesmo mecanismo de conquistas.js).
   - Pontuação global: regra "show" em WowGames.Pontos. Os pontos da escada (até 35.000) são internos da partida;
     o perfil recebe 1 ponto a cada 10 pontos da partida, com o mesmo limite diário dos outros jogos.
   - Moedas: o jogo NÃO dá moedas (no site, só a Máquina de Prêmios gera moedas).
   - Guarda só uma chave nova, versionada: wowgames.show.v1 = { v: 1, temas: [...], recentes: [...] } (últimos temas escolhidos e
     perguntas vistas recentemente, para evitar repetições). Ela entra automaticamente no código de recuperação do perfil. */
(function () {
  const ID = 'show';
  const CHAVE = 'wowgames.show.v1';
  const PREMIOS = [100, 200, 300, 500, 800, 1200, 1800, 2500, 3500, 5000, 7000, 10000, 15000, 22000, 35000];
  const MARCOS = [5, 10];                                    // perguntas que, acertadas, garantem o valor mesmo se o jogador errar depois
  const PLANO = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4];  // dificuldade de cada posição da escada
  const NIVEIS = { 1: 'Fácil', 2: 'Média', 3: 'Difícil', 4: 'Muito difícil' };
  const MIN_POR_TEMA = 20, MAX_RECENTES = 120;
  const LETRAS = ['A', 'B', 'C', 'D'];
  const num = n => (n || 0).toLocaleString('pt-BR');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Validação do banco ---------- */
  function validar(banco) {
    const erros = [], avisos = [], porTema = {}, porTemaNivel = {}, ids = new Set(), enunciados = new Set(), validas = [];
    const B = banco || {}, TEMAS = Array.isArray(B.TEMAS) ? B.TEMAS : [], PERG = Array.isArray(B.PERGUNTAS) ? B.PERGUNTAS : [];
    if (!TEMAS.length) erros.push('Nenhum tema cadastrado.');
    const nomes = new Set(TEMAS.map(t => t.nome));
    TEMAS.forEach(t => { porTema[t.nome] = 0; porTemaNivel[t.nome] = { 1: 0, 2: 0, 3: 0, 4: 0 }; });
    PERG.forEach((q, i) => {
      const onde = `pergunta ${q && q.id ? q.id : '#' + (i + 1)}`, e = [];
      if (!q || typeof q !== 'object') { erros.push(onde + ': formato inválido.'); return; }
      if (!q.id || typeof q.id !== 'string') e.push('sem ID');
      else if (ids.has(q.id)) e.push('ID duplicado'); else ids.add(q.id);
      if (!nomes.has(q.tema)) e.push(`tema inexistente ("${q.tema}")`);
      if (!q.pergunta || !String(q.pergunta).trim()) e.push('sem enunciado');
      else { const k = String(q.pergunta).trim().toLowerCase(); if (enunciados.has(k)) e.push('enunciado repetido'); enunciados.add(k); }
      const a = q.alternativas;
      if (!Array.isArray(a) || a.length !== 4) e.push('precisa de exatamente 4 alternativas');
      else {
        if (a.some(x => typeof x !== 'string' || !x.trim())) e.push('alternativa vazia');
        if (new Set(a.map(x => String(x).trim().toLowerCase())).size !== 4) e.push('alternativas duplicadas');
      }
      if (!Number.isInteger(q.correta) || q.correta < 0 || q.correta > 3) e.push('índice da resposta correta inválido');
      if (![1, 2, 3, 4].includes(q.dificuldade)) e.push('dificuldade inválida');
      if (!q.explicacao || !String(q.explicacao).trim()) e.push('sem explicação');
      if (!q.dica || !String(q.dica).trim()) e.push('sem dica');
      if (e.length) { erros.push(onde + ': ' + e.join(', ') + '.'); return; }
      porTema[q.tema]++; porTemaNivel[q.tema][q.dificuldade]++; validas.push(q);
    });
    TEMAS.forEach(t => {
      if (porTema[t.nome] < MIN_POR_TEMA) erros.push(`Tema "${t.nome}" tem ${porTema[t.nome]} perguntas válidas (mínimo ${MIN_POR_TEMA}).`);
      const n = porTemaNivel[t.nome];                        // jogando só este tema: precisa de 5/5/3/2 por nível (+1 para a ajuda Pular)
      [[1, 6], [2, 6], [3, 4], [4, 3]].forEach(([d, min]) => { if (n[d] < min) avisos.push(`Tema "${t.nome}": só ${n[d]} pergunta(s) de nível ${NIVEIS[d]} (ideal: ${min} ou mais).`); });
    });
    return { ok: !erros.length, total: PERG.length, validas, erros, avisos, porTema, porTemaNivel };
  }

  const banco = WowGames.ShowBanco || { TEMAS: [], PERGUNTAS: [] };
  const relatorio = validar(banco);
  if (!WowGames.ShowBanco) console.error('[wow.games] Show de Perguntas: games/perguntas-show.js não foi carregado antes do jogo.');
  if (relatorio.erros.length) console.error('[wow.games] Show de Perguntas: problemas no banco de perguntas:', relatorio.erros);
  if (relatorio.avisos.length) console.warn('[wow.games] Show de Perguntas: avisos do banco de perguntas:', relatorio.avisos);
  const TEMAS = banco.TEMAS || [];
  const VALIDAS = relatorio.validas;

  /* ---------- Armazenamento próprio (versionado; nunca toca nas outras chaves) ---------- */
  function ler() {
    try { const s = JSON.parse(localStorage.getItem(CHAVE)); if (s && s.v === 1) return { v: 1, temas: Array.isArray(s.temas) ? s.temas : [], recentes: Array.isArray(s.recentes) ? s.recentes : [] }; }
    catch (e) {}
    return { v: 1, temas: [], recentes: [] };
  }
  function gravar(fn) { try { const s = ler(); fn(s); localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) { /* sem armazenamento: o jogo continua normalmente */ } }

  /* ---------- Integração com o perfil (mesmos mecanismos dos outros jogos) ---------- */
  const Perfil = WowGames.Perfil;
  if (Perfil) {
    Perfil.registrarJogo({ id: ID, nome: 'Show de Perguntas', icone: '🎤',
      xp: ev => ev.tipo === 'fim' ? (ev.acertos || 0) * 8 + (ev.resultado === 'concluida' ? 100 : 0) : 0,     // até 220 XP; partida sem acertos não rende XP
      recordes: [{ id: 'pontos', rotulo: 'Show de Perguntas: maior prêmio', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.pontos : null, fmt: v => num(v) + ' pts' },
                 { id: 'acertos', rotulo: 'Show de Perguntas: mais acertos', melhor: 'maior', valor: ev => ev.tipo === 'fim' ? ev.acertos : null, fmt: v => v + '/15' }] });
    [
      { id: 'primeiroacerto', icone: '✅', nome: 'Primeiro Acerto', desc: 'Acerte uma pergunta no Show de Perguntas.', xp: 50,
        ok: ev => ev.jogo === ID && ev.tipo === 'acerto' },
      { id: 'menteafiada', icone: '🧠', nome: 'Mente Afiada', desc: 'Acerte 5 perguntas seguidas numa partida do Show de Perguntas.', xp: 120,
        ok: ev => ev.jogo === ID && ev.tipo === 'acerto' && ev.seq >= 5 },
      { id: 'conhecimentoamplo', icone: '🗺️', nome: 'Conhecimento Amplo', desc: 'Termine uma partida do Show de Perguntas com pelo menos 3 temas selecionados.', xp: 100,
        ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.temas >= 3 && ev.respondidas >= 1 },
      { id: 'milionariodosaber', icone: '🎤', nome: 'Milionário do Saber', desc: 'Acerte a 15ª pergunta e conclua uma partida do Show de Perguntas.', xp: 400,
        ok: ev => ev.jogo === ID && ev.tipo === 'fim' && ev.resultado === 'concluida' }
    ].forEach(c => Perfil.registrarConquista(c));
  }
  if (WowGames.Pontos) {
    // Pontuação global = pontos da escada ÷ 10 (máx. 3.500 por partida). Cinco partidas cheias por dia; depois o ritmo cai, como nos outros jogos.
    WowGames.Pontos.registrar(ID, { limite: 5, mostrarZero: ev => ev.tipo === 'fim', calcula: ev => ev.tipo === 'fim' ? Math.floor((Number(ev.pontos) || 0) / 10) : 0 });
  }

  /* ---------- Utilitários do sorteio ---------- */
  function embaralhar(v) { const a = v.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const garantidoCom = acertos => MARCOS.reduce((g, m) => acertos >= m ? PREMIOS[m - 1] : g, 0);
  const acumuladoCom = acertos => acertos ? PREMIOS[acertos - 1] : 0;

  // Monta os "montes" de cada nível só com os temas escolhidos. Perguntas vistas recentemente ficam no fim do monte (só aparecem se faltar).
  function prepararMontes(nomesTemas) {
    const rec = new Set(ler().recentes), montes = { 1: [], 2: [], 3: [], 4: [] };
    const lista = VALIDAS.filter(q => nomesTemas.includes(q.tema));
    [1, 2, 3, 4].forEach(d => {
      const deste = embaralhar(lista.filter(q => q.dificuldade === d));
      montes[d] = deste.filter(q => !rec.has(q.id)).concat(deste.filter(q => rec.has(q.id)));
    });
    return montes;
  }
  function faltasPara(montes) {                              // perguntas necessárias por nível em uma partida
    const precisa = { 1: 0, 2: 0, 3: 0, 4: 0 }; PLANO.forEach(d => precisa[d]++);
    return [1, 2, 3, 4].filter(d => montes[d].length < precisa[d]).map(d => ({ d, tem: montes[d].length, precisa: precisa[d] }));
  }

  WowGames.register({
    id: ID, nome: 'Show de Perguntas', icone: '🎤', cor: 'var(--sky)',
    desc: 'Escolha seus temas e suba a escada de 15 perguntas. Use as ajudas com estratégia e chegue aos 35.000 pontos!',

    mount(el) {
      let vivo = true;
      let selecao = new Set(ler().temas.filter(n => TEMAS.some(t => t.nome === n)));
      let S = null;          // estado da partida (null = tela de temas)
      let confirmandoSaida = false;

      /* ---------- Tela 1: seleção de temas ---------- */
      function telaTemas(msg) {
        S = null; confirmandoSaida = false;
        const cont = relatorio.porTema;
        const nomesSel = TEMAS.filter(t => selecao.has(t.nome)).map(t => t.nome);
        el.innerHTML = `<div class="sp sp-temas-tela">
          <header class="sp-cab"><span class="sp-logo" aria-hidden="true">🎤</span><div><h2>Show de Perguntas</h2>
            <p>Escolha um ou mais temas. Os temas ficam travados até o fim da partida.</p></div></header>
          <div class="sp-sel-barra">
            <button type="button" class="btn small" data-a="todos">Selecionar todos</button>
            <button type="button" class="btn small sp-b-limpar" data-a="limpar">Limpar seleção</button>
          </div>
          <div class="sp-temas" role="group" aria-label="Temas da partida">${TEMAS.map(t => {
            const on = selecao.has(t.nome), n = cont[t.nome] || 0;
            return `<button type="button" class="sp-tema ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" data-tema="${esc(t.nome)}" style="--c:${t.cor}" ${n ? '' : 'disabled'}>
              <span class="sp-tema-ico" aria-hidden="true">${t.icone}</span>
              <span class="sp-tema-txt"><b>${esc(t.nome)}</b><small>${esc(t.desc)}</small><small class="sp-tema-n">${n} perguntas</small></span>
              <span class="sp-check" aria-hidden="true">${on ? '✓' : ''}</span></button>`;
          }).join('')}</div>
          <p class="sp-sel-info" aria-live="polite">${nomesSel.length ? `<b>${nomesSel.length} de ${TEMAS.length}</b> tema${nomesSel.length > 1 ? 's' : ''} selecionado${nomesSel.length > 1 ? 's' : ''}: ${nomesSel.map(esc).join(', ')}` : 'Nenhum tema selecionado. Escolha pelo menos um para começar.'}</p>
          ${msg ? `<p class="sp-aviso" role="alert">${msg}</p>` : ''}
          <button type="button" class="btn big" data-a="comecar" ${nomesSel.length ? '' : 'disabled'}>Começar partida</button>
          <details class="sp-regras"><summary>Como funciona</summary>
            <ul>
              <li>São 15 perguntas: 1 a 5 fáceis, 6 a 10 médias, 11 a 13 difíceis e 14 e 15 muito difíceis.</li>
              <li>Escolha uma alternativa e confirme. Antes de confirmar, você pode trocar a escolha.</li>
              <li>Errou, a partida acaba e você fica com o último <b>marco garantido</b>: 800 pontos na pergunta 5 e 5.000 pontos na pergunta 10.</li>
              <li>Se preferir, pare a qualquer momento e leve os pontos que já acumulou.</li>
              <li>Ajudas, uma vez cada por partida: <b>eliminar duas</b> alternativas erradas, <b>segunda chance</b> (ative antes de confirmar), <b>pular</b> a pergunta e <b>dica</b>.</li>
              <li>Teclado: <kbd>A</kbd>–<kbd>D</kbd> ou <kbd>1</kbd>–<kbd>4</kbd> escolhem, <kbd>Enter</kbd> confirma e avança.</li>
              <li>Os pontos da escada são da partida. O perfil recebe 1 ponto a cada 10 conquistados.</li>
            </ul></details>
        </div>`;
      }

      /* ---------- Início da partida ---------- */
      function comecar() {
        const nomes = TEMAS.filter(t => selecao.has(t.nome)).map(t => t.nome);
        if (!nomes.length) return telaTemas('Selecione pelo menos um tema para começar.');
        const montes = prepararMontes(nomes), faltas = faltasPara(montes);
        if (faltas.length) {                                 // nunca duplica perguntas em silêncio
          return telaTemas('Não há perguntas suficientes para montar a partida com esses temas: ' +
            faltas.map(f => `nível ${NIVEIS[f.d]} tem ${f.tem} de ${f.precisa}`).join('; ') + '. Selecione mais temas.');
        }
        gravar(s => { s.temas = nomes; });
        S = {
          fase: 'pergunta',          // pergunta | confirmada | encerrada | concluida
          temas: nomes, montes, pos: 0, acertos: 0, seq: 0, maxSeq: 0, respondidas: 0,
          q: null, escolha: null, eliminadas: new Set(), erradasAntes: new Set(),
          ajudas: { eliminar: 'livre', dupla: 'livre', pular: 'livre', dica: 'livre' },   // livre | usada
          duplaAtiva: false, dicaVisivel: false, vistas: new Set(), ultimoTema: null,
          feedback: null, resultado: null, final: null, rp: null, finalizado: false, subiu: false
        };
        confirmandoSaida = false;
        novaPergunta();
      }

      // Tira a próxima pergunta do nível da posição atual, evitando repetir o tema da pergunta anterior quando há vários temas.
      function tirar() {
        const monte = S.montes[PLANO[S.pos]];
        if (!monte.length) return null;
        let i = S.temas.length > 1 ? monte.findIndex(q => q.tema !== S.ultimoTema) : 0;
        if (i < 0) i = 0;
        return monte.splice(i, 1)[0];
      }
      function novaPergunta() {
        const q = tirar();
        if (!q) { S.fase = 'encerrada'; S.resultado = 'erro'; return finalizar('Não há mais perguntas disponíveis neste nível.'); }
        S.q = q; S.vistas.add(q.id); S.ultimoTema = q.tema;
        S.escolha = null; S.eliminadas = new Set(); S.erradasAntes = new Set(); S.duplaAtiva = false; S.dicaVisivel = false; S.feedback = null;
        S.fase = 'pergunta';
        gravar(s => { s.recentes = s.recentes.filter(id => id !== q.id).concat(q.id).slice(-MAX_RECENTES); });
        desenharJogo();
      }

      /* ---------- Ações do jogador ---------- */
      const podeEscolher = i => S && S.fase === 'pergunta' && !S.eliminadas.has(i) && !S.erradasAntes.has(i);
      function escolher(i) {
        if (!podeEscolher(i)) return;
        S.escolha = i; confirmandoSaida = false; desenharJogo();
        const b = el.querySelector(`[data-op="${i}"]`); if (b) b.focus({ preventScroll: true });
      }
      function confirmar() {
        if (!S || S.fase !== 'pergunta' || S.escolha === null) return;
        const q = S.q, certo = S.escolha === q.correta;
        confirmandoSaida = false;
        if (!certo && S.duplaAtiva) {                         // segunda chance: elimina só a escolha errada, sem revelar a certa
          S.duplaAtiva = false; S.erradasAntes.add(S.escolha); S.escolha = null; S.seq = 0;
          S.feedback = { tipo: 'segunda', txt: 'Resposta errada, mas a Segunda Chance salvou você! Escolha outra alternativa.' };
          return desenharJogo();
        }
        S.duplaAtiva = false; S.respondidas++;
        if (certo) {
          S.acertos++; S.seq++; S.maxSeq = Math.max(S.maxSeq, S.seq); S.subiu = true;
          S.feedback = { tipo: 'certo' };
          WowGames.evento({ jogo: ID, tipo: 'acerto', numero: S.pos + 1, seq: S.seq, dificuldade: q.dificuldade, tema: q.tema });
          if (S.acertos === PREMIOS.length) { S.fase = 'concluida'; S.resultado = 'concluida'; finalizar(); }
          else S.fase = 'confirmada';
        } else {
          S.seq = 0; S.feedback = { tipo: 'errado' };
          S.fase = 'encerrada'; S.resultado = 'erro'; finalizar();
        }
        desenharJogo();
        const nx = el.querySelector('[data-a="proxima"], [data-a="resultado"]'); if (nx) nx.focus({ preventScroll: true });
      }
      function proxima() {
        if (!S || S.fase !== 'confirmada') return;
        S.pos++; S.subiu = false; novaPergunta();
      }
      function usarAjuda(tipo) {
        if (!S || S.fase !== 'pergunta' || S.ajudas[tipo] !== 'livre' || !ajudaPossivel(tipo)) return;
        const q = S.q;
        if (tipo === 'eliminar') {                           // fica a certa + UMA errada entre as que ainda estão na tela
          const erradas = embaralhar([0, 1, 2, 3].filter(i => i !== q.correta && !S.erradasAntes.has(i)));
          erradas.slice(1).forEach(i => S.eliminadas.add(i));
          if (S.escolha !== null && S.eliminadas.has(S.escolha)) S.escolha = null;
        }
        if (tipo === 'dupla') S.duplaAtiva = true;
        if (tipo === 'dica') S.dicaVisivel = true;
        S.ajudas[tipo] = 'usada';
        if (tipo === 'pular') { S.feedback = null; return novaPergunta(); }   // a pergunta pulada não volta (já saiu do monte) e não vale pontos
        desenharJogo();
      }
      function ajudaPossivel(tipo) {
        if (!S || S.fase !== 'pergunta') return false;
        if (tipo === 'eliminar') return [0, 1, 2, 3].filter(i => !S.eliminadas.has(i) && !S.erradasAntes.has(i)).length > 2;
        if (tipo === 'dupla') return !S.duplaAtiva && S.erradasAntes.size === 0;
        if (tipo === 'pular') return S.montes[PLANO[S.pos]].length > 0;
        return true;
      }
      function parar() {
        if (!S || (S.fase !== 'pergunta' && S.fase !== 'confirmada')) return;
        S.fase = 'encerrada'; S.resultado = 'desistiu'; confirmandoSaida = false;
        finalizar(); telaResultado();
      }

      /* ---------- Fim: envia UM evento por partida ---------- */
      function finalizar(motivo) {
        if (S.finalizado) return;
        S.finalizado = true;
        S.final = S.resultado === 'concluida' ? PREMIOS[PREMIOS.length - 1] : S.resultado === 'desistiu' ? acumuladoCom(S.acertos) : garantidoCom(S.acertos);
        S.motivo = motivo || '';
        if (!S.respondidas) { S.rp = null; if (motivo) desenharJogo(); return; }   // parou sem responder nada: a partida não conta no perfil
        S.rp = WowGames.evento({ jogo: ID, tipo: 'fim', partida: true, resultado: S.resultado, acertos: S.acertos, pontos: S.final,
          pergunta: S.pos + 1, respondidas: S.respondidas, temas: S.temas.length, maxSeq: S.maxSeq,
          ajudas: Object.values(S.ajudas).filter(v => v === 'usada').length });
        if (motivo) desenharJogo();
      }

      /* ---------- Tela 2: pergunta ---------- */
      function escadaHtml() {
        const atual = S.pos, garant = garantidoCom(S.acertos);
        return `<ol class="sp-escada" aria-label="Escada de pontos">${PREMIOS.map((p, i) => {
          const n = i + 1, marco = MARCOS.includes(n), feito = i < S.acertos, agora = i === atual && S.fase !== 'concluida' && i >= S.acertos;
          const seguro = marco && feito;
          return `<li class="${feito ? 'feito' : ''} ${agora ? 'agora' : ''} ${marco ? 'marco' : ''} ${seguro ? 'seguro' : ''} ${feito && i === S.acertos - 1 && S.subiu ? 'subiu' : ''}" ${agora ? 'aria-current="step"' : ''}>
            <span class="sp-esc-n">${n}</span><span class="sp-esc-p">${num(p)}</span>${marco ? `<span class="sp-esc-m" title="Marco garantido">${seguro ? '🔒' : '🛡️'}</span>` : ''}</li>`;
        }).join('')}</ol>
        <p class="sp-esc-leg">🛡️ marco &nbsp;·&nbsp; 🔒 garantido: <b>${num(garant)}</b></p>`;
      }
      function ajudaBtn(tipo, ico, nome, desc) {
        const usada = S.ajudas[tipo] === 'usada', ativa = tipo === 'dupla' && S.duplaAtiva, possivel = !usada && ajudaPossivel(tipo);
        const estado = ativa ? 'ativa' : usada ? 'usada' : possivel ? 'livre' : 'indisp';
        const rot = ativa ? 'Ativa nesta pergunta' : usada ? 'Utilizada' : possivel ? 'Disponível' : 'Indisponível';
        return `<button type="button" class="sp-ajuda ${estado}" data-ajuda="${tipo}" ${possivel ? '' : 'disabled'} aria-label="${nome}: ${rot}. ${desc}" title="${desc}">
          <span class="sp-aj-ico" aria-hidden="true">${ico}</span><b>${nome}</b><small>${rot}</small></button>`;
      }
      function desenharJogo() {
        if (!vivo || !S) return;
        const q = S.q, fim = S.fase === 'encerrada' || S.fase === 'concluida', revelar = S.fase !== 'pergunta';
        const valendo = PREMIOS[S.pos], acum = acumuladoCom(S.acertos), garant = garantidoCom(S.acertos);
        const prox = MARCOS.find(m => m > S.acertos);
        const tema = TEMAS.find(t => t.nome === q.tema) || { icone: '❓', cor: '#fff' };
        const ops = q.alternativas.map((a, i) => {
          const elim = S.eliminadas.has(i), errAntes = S.erradasAntes.has(i), sel = S.escolha === i;
          let cls = sel ? 'sel' : '';
          if (revelar) { if (i === q.correta) cls += ' certa'; else if (sel) cls += ' errada'; }
          if (elim) cls += ' elim'; if (errAntes) cls += ' errada antes';
          const bloq = revelar || elim || errAntes;
          return `<button type="button" class="sp-op ${cls}" data-op="${i}" aria-pressed="${sel}" ${bloq ? 'disabled' : ''}
            aria-label="Alternativa ${LETRAS[i]}: ${esc(a)}${elim ? ' (eliminada)' : ''}${errAntes ? ' (errada)' : ''}">
            <span class="sp-letra">${LETRAS[i]}</span><span class="sp-op-txt">${esc(a)}</span>
            ${revelar && i === q.correta ? '<span class="sp-op-ic" aria-hidden="true">✔</span>' : revelar && sel ? '<span class="sp-op-ic" aria-hidden="true">✖</span>' : ''}</button>`;
        }).join('');
        let fb = '';
        if (S.feedback && S.feedback.tipo === 'segunda') fb = `<div class="sp-fb segunda" role="status">🛟 ${S.feedback.txt}</div>`;
        if (S.feedback && S.feedback.tipo === 'certo') fb = `<div class="sp-fb certo" role="status"><h3>✔ Resposta certa! +${num(valendo)}</h3><p>${esc(q.explicacao)}</p>
          ${S.fase === 'concluida' ? '' : `<p class="sp-fb-acum">Você já acumulou <b>${num(PREMIOS[S.acertos - 1])}</b> pontos.${MARCOS.includes(S.acertos) ? ' 🔒 Novo marco garantido!' : ''}</p>`}</div>`;
        if (S.feedback && S.feedback.tipo === 'errado') fb = `<div class="sp-fb errado" role="status"><h3>✖ Resposta errada</h3>
          <p>A resposta certa era <b>${LETRAS[q.correta]}) ${esc(q.alternativas[q.correta])}</b>.</p><p>${esc(q.explicacao)}</p></div>`;
        if (S.motivo) fb = `<div class="sp-fb errado" role="status"><p>${esc(S.motivo)}</p></div>`;

        let acoes = '';
        if (S.fase === 'pergunta') acoes = `<button type="button" class="btn big sp-confirmar" data-a="confirmar" ${S.escolha === null ? 'disabled' : ''}>${S.escolha === null ? 'Escolha uma alternativa' : `Confirmar ${LETRAS[S.escolha]}`}</button>`;
        else if (S.fase === 'confirmada') acoes = `<button type="button" class="btn big" data-a="proxima">Próxima pergunta →</button>`;
        else if (S.fase === 'concluida') acoes = `<button type="button" class="btn big sp-ouro" data-a="resultado">Ver conclusão 🏆</button>`;
        else acoes = `<button type="button" class="btn big" data-a="resultado">Ver resultado</button>`;
        const sair = fim ? '' : confirmandoSaida
          ? `<div class="sp-sair-conf" role="alertdialog" aria-label="Confirmar parada"><span>Parar agora e levar <b>${num(acum)}</b> pontos?</span>
              <button type="button" class="btn small stop" data-a="parar-sim">Sim, parar</button><button type="button" class="btn small" data-a="parar-nao">Continuar jogando</button></div>`
          : `<button type="button" class="link sp-parar" data-a="parar">🏳️ Parar e levar ${num(acum)} pontos</button>`;

        el.innerHTML = `<div class="sp sp-jogo">
          <div class="sp-main">
            <div class="sp-topo">
              <span class="sp-chip"><span>Pergunta <b>${S.pos + 1}</b>/15</span></span>
              <span class="sp-chip sp-tema-chip" style="--c:${tema.cor}">${tema.icone} ${esc(q.tema)}</span>
              <span class="sp-chip sp-niv n${q.dificuldade}">${NIVEIS[q.dificuldade]}</span>
            </div>
            <div class="sp-placar">
              <div><small>Valendo</small><b>${num(valendo)}</b></div>
              <div><small>Acumulado</small><b>${num(acum)}</b></div>
              <div><small>Se errar, fica com</small><b>${num(garant)}</b></div>
              <div><small>Próximo marco</small><b>${prox ? `${num(PREMIOS[prox - 1])} <i>(pergunta ${prox})</i>` : 'todos garantidos'}</b></div>
            </div>
            <div class="sp-palco ${S.feedback ? 'fx-' + S.feedback.tipo : ''}">
              <p class="sp-perg" id="sp-perg">${esc(q.pergunta)}</p>
              ${S.dicaVisivel ? `<p class="sp-dica">💡 <b>Dica:</b> ${esc(q.dica)}</p>` : ''}
              ${S.duplaAtiva ? '<p class="sp-dupla-on">🛟 Segunda Chance ativa: se errar, você pode tentar de novo.</p>' : ''}
            </div>
            <div class="sp-ops" role="group" aria-labelledby="sp-perg">${ops}</div>
            ${fb}
            <div class="sp-acoes">${acoes}</div>
            <div class="sp-ajudas" role="group" aria-label="Ajudas">
              ${ajudaBtn('eliminar', '✂️', 'Eliminar 2', 'Remove duas alternativas erradas.')}
              ${ajudaBtn('dupla', '🛟', 'Segunda chance', 'Ative antes de confirmar: se errar, tenta de novo.')}
              ${ajudaBtn('pular', '⏭️', 'Pular', 'Troca a pergunta por outra do mesmo nível, sem pontos.')}
              ${ajudaBtn('dica', '💡', 'Dica', 'Mostra uma pista curta.')}
            </div>
            <div class="sp-rodape"><span class="sp-temas-jogo">Temas: ${S.temas.map(esc).join(', ')}</span>${sair}</div>
          </div>
          <aside class="sp-lado">${escadaHtml()}</aside>
        </div>`;
        if (S.fase === 'concluida') WowGames.confetti(el, ['🏆', '🎤', '✨', '⭐']);
      }

      /* ---------- Tela 3: resultado ---------- */
      function telaResultado() {
        if (!S || !S.finalizado) return;
        const r = S.resultado, ok = r === 'concluida';
        const titulo = ok ? 'Milionário do Saber!' : r === 'desistiu' ? 'Você parou na hora certa' : 'Fim de jogo';
        const emoji = ok ? '🏆' : r === 'desistiu' ? '🏳️' : S.acertos >= 10 ? '🥈' : S.acertos >= 5 ? '🥉' : '🎤';
        const frase = ok ? 'Você respondeu as 15 perguntas e chegou ao topo da escada!'
          : r === 'desistiu' ? `Você decidiu parar na pergunta ${S.pos + 1} e levou tudo o que tinha acumulado.`
          : S.acertos >= 10 ? 'Mandou muito bem! O marco da pergunta 10 garantiu seus pontos.'
          : S.acertos >= 5 ? 'Boa! O marco da pergunta 5 garantiu seus pontos.'
          : 'Não foi dessa vez. Tente de novo: as perguntas mudam a cada partida!';
        el.innerHTML = `<div class="sp sp-res ${ok ? 'ouro' : ''}">
          <div class="big-emoji">${emoji}</div>
          <h2>${titulo}</h2><p>${frase}</p>
          <div class="sp-final"><small>Pontos da partida</small><b>${num(S.final)}</b></div>
          <div class="tp-res">
            <div>Acertos<b>${S.acertos}/15</b></div><div>Pergunta alcançada<b>${Math.min(S.pos + 1, 15)}</b></div>
            <div>Maior sequência<b>${S.maxSeq}</b></div><div>Ajudas usadas<b>${Object.values(S.ajudas).filter(v => v === 'usada').length}/4</b></div>
          </div>
          <p class="sp-temas-jogo">Temas: ${S.temas.map(esc).join(', ')}</p>
          ${WowGames.Pontos ? WowGames.Pontos.html(S.rp) : ''}
          ${S.respondidas ? '' : '<p class="sp-obs">Nenhuma resposta foi confirmada, então esta partida não conta no perfil.</p>'}
          <div class="sp-res-btns">
            <button type="button" class="btn big" data-a="denovo">Jogar novamente</button>
            <button type="button" class="btn" data-a="temas">Voltar aos temas</button>
          </div></div>`;
        if (ok) WowGames.confetti(el, ['🏆', '🎤', '💡', '✨', '⭐']);
        const b = el.querySelector('[data-a="denovo"]'); if (b) b.focus({ preventScroll: true });
      }

      /* ---------- Eventos (um único listener de clique no palco e um de teclado, removido ao sair) ---------- */
      el.onclick = e => {
        if (!vivo) return;
        const t = e.target.closest('[data-tema]');
        if (t && !S) { const n = t.dataset.tema; selecao.has(n) ? selecao.delete(n) : selecao.add(n); return telaTemas(); }
        const op = e.target.closest('[data-op]'); if (op) return escolher(Number(op.dataset.op));
        const aj = e.target.closest('[data-ajuda]'); if (aj) return usarAjuda(aj.dataset.ajuda);
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'todos' && !S) { TEMAS.forEach(x => { if (relatorio.porTema[x.nome]) selecao.add(x.nome); }); return telaTemas(); }
        if (a === 'limpar' && !S) { selecao.clear(); return telaTemas(); }
        if (a === 'comecar' && !S) return comecar();
        if (a === 'confirmar') return confirmar();
        if (a === 'proxima') return proxima();
        if (a === 'parar' && S && !S.finalizado) { confirmandoSaida = true; desenharJogo(); const s = el.querySelector('[data-a="parar-nao"]'); if (s) s.focus(); return; }
        if (a === 'parar-nao' && S && !S.finalizado) { confirmandoSaida = false; return desenharJogo(); }
        if (a === 'parar-sim') return parar();
        if (a === 'resultado') return telaResultado();
        if (a === 'denovo' && S && S.finalizado) { selecao = new Set(S.temas); return comecar(); }
        if (a === 'temas') return telaTemas();
      };
      function tecla(e) {
        if (!vivo || !S || e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.body.classList.contains('lj-aberto')) return;           // a loja aberta por cima tem prioridade
        const alvo = e.target, k = e.key;
        if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
        if (S.fase === 'pergunta') {
          const idx = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 }[k.toLowerCase()];
          if (idx !== undefined) { e.preventDefault(); return escolher(idx); }
          if (k === 'Enter' && S.escolha !== null) {
            if (alvo && alvo.tagName === 'BUTTON' && !(alvo.matches('[data-op]') && Number(alvo.dataset.op) === S.escolha)) return;   // Enter em outro botão faz o clique dele
            e.preventDefault(); return confirmar();
          }
        } else if (S.fase === 'confirmada' && k === 'Enter') {
          if (alvo && alvo.tagName === 'BUTTON') return;
          e.preventDefault(); return proxima();
        }
      }
      document.addEventListener('keydown', tecla);

      telaTemas();
      return () => { vivo = false; document.removeEventListener('keydown', tecla); el.onclick = null; S = null; };
    }
  });

  // Ferramentas para conferir o banco pelo Console: WowGames.ShowPerguntas.validar()
  WowGames.ShowPerguntas = { validar: () => validar(WowGames.ShowBanco), relatorio, PREMIOS, MARCOS, PLANO, CHAVE, garantidoCom, acumuladoCom };
})();
