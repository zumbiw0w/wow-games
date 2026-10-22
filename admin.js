/* wow.games: PAINEL ADMINISTRATIVO LOCAL (ferramenta de desenvolvimento e teste).
   ATENÇÃO: o site é estático, então este painel NÃO é uma autenticação segura. O código de acesso fica guardado só como um
   hash simples (FNV-1a), o que evita deixá-lo legível no arquivo, mas qualquer pessoa que estude o JavaScript pode descobri-lo
   ou alterar o próprio localStorage. Por isso o painel só mexe nos DADOS LOCAIS deste navegador (os mesmos que o jogador
   já pode editar sozinho) e não tem NENHUM acesso ao placar global: não lê nem altera wowgames.placar.v1 e não envia nada pela rede.

   Usa os sistemas existentes, sem cópia do perfil:
     - perfil (XP, pontuação, conquistas, recordes): WowGames.Perfil.dados() para ler e WowGames.Perfil.atualizar() para gravar (wowgames.perfil.v1);
     - moedas: a mesma chave da Máquina de Prêmios e da Loja (wowgames.premios.v1), alterando só o campo "moedas".
   Sem execução de código, sem apagar dados em massa e sem alterar arquivos do site. Toda alteração é revisada e confirmada antes,
   e a última pode ser desfeita enquanto a página estiver aberta. Documentação: docs/painel-admin.md */
(function () {
  const Perfil = WowGames.Perfil;
  if (!Perfil) return;
  const HASH = 0xb564d398;                                  // FNV-1a 32 bits do código de acesso
  const PREMIOS_KEY = 'wowgames.premios.v1';
  const MAX = 1e9, MAX_NIVEL = 300;
  const fmt = n => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function fnv(s) { let h = 0x811c9dc5; for (const b of new TextEncoder().encode(s)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }

  let liberado = false;                                     // vale só enquanto a página estiver aberta
  let tentativas = 0, bloqueadoAte = 0;
  let desfazer = null;                                      // { perfil, premios, quando } da última alteração aplicada

  function lerPremios() { try { const raw = localStorage.getItem(PREMIOS_KEY); return { raw, obj: raw ? JSON.parse(raw) : null }; } catch (e) { return { raw: null, obj: null, erro: true }; } }
  const moedasAtuais = () => { const p = lerPremios().obj; return Math.max(0, Math.floor(Number(p && p.moedas) || 0)); };

  /* ---------- Validação ---------- */
  function inteiro(txt, nome, max = MAX) {
    const t = String(txt).trim();
    if (!/^\d+$/.test(t)) throw new Error(`${nome}: use um número inteiro, sem sinais, pontos ou vírgulas.`);
    const n = Number(t);
    if (!Number.isSafeInteger(n) || n > max) throw new Error(`${nome}: o máximo permitido é ${fmt(max)}.`);
    return n;
  }
  function decimal(txt, nome) {
    const t = String(txt).trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(t)) throw new Error(`${nome}: use um número maior ou igual a zero (ex.: 12 ou 12,5).`);
    const n = Number(t);
    if (!isFinite(n) || n > MAX) throw new Error(`${nome}: valor fora do limite.`);
    return n;
  }

  /* ---------- Coleta das alterações do formulário ---------- */
  function coletar(el) {
    const P = Perfil.dados(), m = [], v = id => el.querySelector('#' + id).value;
    const moedas = inteiro(v('ad-moedas'), 'Moedas');
    if (moedas !== moedasAtuais()) m.push({ tipo: 'moedas', de: moedasAtuais(), para: moedas, txt: `Moedas: ${fmt(moedasAtuais())} → ${fmt(moedas)}` });

    const xp = inteiro(v('ad-xp'), 'XP'), nivel = inteiro(v('ad-nivel'), 'Nível', MAX_NIVEL);
    if (nivel < 1) throw new Error('Nível: o mínimo é 1.');
    const nivelAtual = Perfil.nivelDe(P.xp);
    if (xp !== P.xp && nivel !== nivelAtual) throw new Error('Altere o XP OU o nível, não os dois ao mesmo tempo (o nível é calculado pelo XP).');
    if (xp !== P.xp) m.push({ tipo: 'xp', para: xp, txt: `XP: ${fmt(P.xp)} → ${fmt(xp)} (nível ${nivelAtual} → ${Perfil.nivelDe(xp)})` });
    else if (nivel !== nivelAtual) {
      const novo = Perfil.xpDoNivel(nivel);                  // início do nível escolhido, pela mesma fórmula do perfil
      m.push({ tipo: 'xp', para: novo, txt: `Nível: ${nivelAtual} → ${nivel} (XP ${fmt(P.xp)} → ${fmt(novo)}, início do nível)` });
    }

    const pont = inteiro(v('ad-pontuacao'), 'Pontuação');
    if (pont !== P.pontuacao) m.push({ tipo: 'pontuacao', para: pont, txt: `Pontuação total: ${fmt(P.pontuacao)} → ${fmt(pont)}` });

    el.querySelectorAll('[data-ad-conq]').forEach(c => {
      const id = c.dataset.adConq, tem = !!P.conquistas[id], def = Perfil.conquistas.find(x => x.id === id);
      if (c.checked !== tem) m.push({ tipo: c.checked ? 'desbloquear' : 'bloquear', id, txt: `${c.checked ? '🔓 Desbloquear' : '🔒 Bloquear'} conquista “${def ? def.nome : id}”` });
    });

    el.querySelectorAll('[data-ad-rec]').forEach(inp => {
      const k = inp.dataset.adRec, atual = P.recordes[k], limpar = el.querySelector(`[data-ad-limpar="${k}"]`).checked, t = inp.value.trim();
      if (limpar) { if (atual) m.push({ tipo: 'recorde', k, para: null, txt: `Recorde ${inp.dataset.nome}: apagar (era ${fmt(atual.valor)})` }); return; }
      if (t === '') { if (atual) throw new Error(`Recorde ${inp.dataset.nome}: para remover, marque “apagar”. Deixar vazio não é permitido.`); return; }
      const n = decimal(t, `Recorde ${inp.dataset.nome}`);
      if (!atual || n !== atual.valor) m.push({ tipo: 'recorde', k, para: n, txt: `Recorde ${inp.dataset.nome}: ${atual ? fmt(atual.valor) : '—'} → ${fmt(n)}` });
    });
    return m;
  }

  /* ---------- Aplicação (tudo ou nada) ---------- */
  function aplicar(mudancas) {
    const antesPerfil = localStorage.getItem(Perfil.CHAVE), antesPremios = lerPremios();
    if (antesPremios.erro) throw new Error('Não foi possível ler as moedas salvas. Nada foi alterado.');
    const mMoedas = mudancas.find(x => x.tipo === 'moedas');
    try {
      if (mMoedas) {                                         // mesma técnica da Loja: altera só o campo "moedas" e mantém o resto do save
        const novo = Object.assign({}, antesPremios.obj || {}, { moedas: mMoedas.para });
        localStorage.setItem(PREMIOS_KEY, JSON.stringify(novo));
      }
      const resto = mudancas.filter(x => x.tipo !== 'moedas');
      if (resto.length) {
        Perfil.atualizar(P => {
          for (const x of resto) {
            if (x.tipo === 'xp') P.xp = x.para;
            if (x.tipo === 'pontuacao') P.pontuacao = x.para;
            if (x.tipo === 'desbloquear') P.conquistas[x.id] = new Date().toISOString();   // não concede XP: é só para teste
            if (x.tipo === 'bloquear') delete P.conquistas[x.id];
            if (x.tipo === 'recorde') { if (x.para === null) delete P.recordes[x.k]; else P.recordes[x.k] = { valor: x.para }; }
          }
        });
      }
      // confere se tudo foi gravado de fato
      const P = Perfil.dados();
      const ok = resto.every(x => x.tipo === 'xp' ? P.xp === x.para : x.tipo === 'pontuacao' ? P.pontuacao === x.para
        : x.tipo === 'desbloquear' ? !!P.conquistas[x.id] : x.tipo === 'bloquear' ? !P.conquistas[x.id]
        : x.para === null ? !P.recordes[x.k] : P.recordes[x.k] && P.recordes[x.k].valor === x.para) && (!mMoedas || moedasAtuais() === mMoedas.para);
      if (!ok) throw new Error('A gravação não foi confirmada pelo navegador.');
    } catch (e) {                                            // desfaz tudo para nunca deixar os dados pela metade
      try {
        if (antesPerfil === null) localStorage.removeItem(Perfil.CHAVE); else localStorage.setItem(Perfil.CHAVE, antesPerfil);
        if (antesPremios.raw === null) localStorage.removeItem(PREMIOS_KEY); else localStorage.setItem(PREMIOS_KEY, antesPremios.raw);
      } catch (e2) {}
      throw new Error('Não foi possível salvar as alterações (' + e.message + '). Os dados anteriores foram mantidos.');
    }
    desfazer = { perfil: antesPerfil, premios: antesPremios.raw, quando: new Date() };
    if (WowGames.Loja) WowGames.Loja.aplicarCursor();
  }
  function desfazerUltima() {
    if (!desfazer) throw new Error('Não há alteração para desfazer.');
    if (desfazer.perfil === null) localStorage.removeItem(Perfil.CHAVE); else localStorage.setItem(Perfil.CHAVE, desfazer.perfil);
    if (desfazer.premios === null) localStorage.removeItem(PREMIOS_KEY); else localStorage.setItem(PREMIOS_KEY, desfazer.premios);
    desfazer = null;
    if (WowGames.Loja) WowGames.Loja.aplicarCursor();
  }

  /* ---------- Interface ---------- */
  function pagina(el) {
    let msg = null, revisao = null;
    const aviso = () => msg ? `<p class="ad-msg ${msg.ok ? 'ok' : 'erro'}" role="${msg.ok ? 'status' : 'alert'}">${esc(msg.txt)}</p>` : '';

    function telaCodigo() {
      el.innerHTML = `<div class="ad ad-entrada">
        <div class="big-emoji">🔧</div><h2>Ferramentas de teste</h2>
        <p>Área para desenvolvimento e testes. Altera apenas os dados salvos <b>neste navegador</b>.</p>
        <form class="ad-form-cod" autocomplete="off"><label for="ad-cod"><b>Código de acesso</b></label>
          <input id="ad-cod" class="jg-in ad-in" type="password" maxlength="40" autocomplete="off" spellcheck="false">
          <button class="btn" type="submit">Entrar</button></form>
        ${aviso()}
        <p class="ad-nota">Este código não é uma senha segura: o site é estático e não tem servidor. O painel não tem acesso ao placar global.</p>
        <a class="link" href="#/perfil">← Voltar ao perfil</a></div>`;
      const inp = el.querySelector('#ad-cod'); inp.focus({ preventScroll: true });
      el.querySelector('form').onsubmit = e => {
        e.preventDefault();
        if (Date.now() < bloqueadoAte) { msg = { ok: false, txt: 'Muitas tentativas. Aguarde alguns segundos.' }; return telaCodigo(); }
        if (fnv(inp.value.trim()) === HASH) { liberado = true; tentativas = 0; msg = null; return telaPainel(); }
        tentativas++; if (tentativas >= 5) { bloqueadoAte = Date.now() + 10000; tentativas = 0; }
        msg = { ok: false, txt: 'Código incorreto.' }; telaCodigo();
      };
    }

    function telaPainel() {
      const P = Perfil.dados(), r = Perfil.resumoXP(P.xp), moedas = moedasAtuais(), temPremios = !!lerPremios().obj;
      const recs = [];
      Perfil.jogos.forEach(j => (j.recordes || []).forEach(rc => recs.push({ k: j.id + ':' + rc.id, nome: rc.rotulo, j, rc })));
      el.innerHTML = `<div class="ad">
        <header class="ad-topo"><div><h2>🔧 Ferramentas de teste</h2><small>Perfil local: <b>${esc(P.nome)}</b></small></div>
          <button type="button" class="btn small stop" data-ad="fechar">Fechar sem aplicar</button></header>
        ${aviso()}
        <section class="ad-sec"><h3>Valores atuais</h3>
          <div class="ad-resumo">
            <div><small>XP</small><b>${fmt(P.xp)}</b></div><div><small>Nível</small><b>${r.nivel}</b></div>
            <div><small>🪙 Moedas</small><b>${fmt(moedas)}</b></div><div><small>🏆 Pontuação</small><b>${fmt(P.pontuacao)}</b></div>
            <div><small>Conquistas</small><b>${Object.keys(P.conquistas).length}/${Perfil.conquistas.length}</b></div><div><small>Partidas</small><b>${fmt(P.partidas)}</b></div>
          </div></section>
        <form id="ad-form" novalidate>
        <section class="ad-sec"><h3>Moedas, XP e pontuação</h3>
          <div class="ad-campos">
            <label>🪙 Moedas<input id="ad-moedas" class="jg-in ad-in" inputmode="numeric" value="${moedas}"></label>
            <label>XP<input id="ad-xp" class="jg-in ad-in" inputmode="numeric" value="${P.xp}"></label>
            <label>Nível<input id="ad-nivel" class="jg-in ad-in" inputmode="numeric" value="${r.nivel}"></label>
            <label>🏆 Pontuação<input id="ad-pontuacao" class="jg-in ad-in" inputmode="numeric" value="${P.pontuacao}"></label>
          </div>
          <p class="ad-nota">Mudar o nível coloca o XP no início do nível escolhido (nível n começa em 50·n·(n−1) XP). ${temPremios ? '' : 'Ainda não existe save da Máquina de Prêmios; definir moedas cria um save novo com os valores padrão da Máquina.'}</p>
        </section>
        <section class="ad-sec"><h3>Conquistas</h3>
          <p class="ad-nota">Marcado = desbloqueada. Desbloquear por aqui não dá XP; bloquear permite testar o desbloqueio de novo.</p>
          <div class="ad-conqs">${Perfil.conquistas.map(c => `<label class="ad-conq"><input type="checkbox" data-ad-conq="${esc(c.id)}" ${P.conquistas[c.id] ? 'checked' : ''}>
            <span>${c.icone} <b>${esc(c.nome)}</b><small>${esc(c.id)}</small></span></label>`).join('')}</div>
          <div class="ad-linha"><button type="button" class="btn small" data-ad="conq-todas">Marcar todas</button><button type="button" class="btn small" data-ad="conq-nenhuma">Desmarcar todas</button><button type="button" class="btn small" data-ad="conq-reset">Voltar ao salvo</button></div>
        </section>
        <section class="ad-sec"><h3>Recordes e progresso dos jogos</h3>
          <p class="ad-nota">Recordes são números (tempos em segundos). Partidas por jogo são só para consulta. O placar global não é afetado.</p>
          <div class="ad-recs">${recs.map(x => { const v = P.recordes[x.k]; return `<div class="ad-rec">
            <span>${x.j.icone || ''} ${esc(x.nome)}<small>${x.rc.melhor === 'menor' ? 'menor é melhor' : 'maior é melhor'} · atual: ${v ? esc(x.rc.fmt ? x.rc.fmt(v.valor) : v.valor) : '—'}</small></span>
            <input class="jg-in ad-in" data-ad-rec="${esc(x.k)}" data-nome="${esc(x.nome)}" inputmode="decimal" value="${v ? v.valor : ''}" placeholder="—" aria-label="${esc(x.nome)}">
            <label class="ad-limpar"><input type="checkbox" data-ad-limpar="${esc(x.k)}" ${v ? '' : 'disabled'}> apagar</label></div>`; }).join('')}</div>
          <ul class="ad-partidas">${Perfil.jogos.map(j => `<li>${j.icone || ''} ${esc(j.nome)}: <b>${fmt(P.jogos[j.id] || 0)}</b> partida(s)</li>`).join('')}</ul>
        </section>
        <div class="ad-acoes"><button type="submit" class="btn big">Revisar alterações</button>
          ${desfazer ? `<button type="button" class="btn" data-ad="desfazer">↩️ Desfazer última alteração</button>` : ''}</div>
        </form></div>`;
      el.querySelector('#ad-form').onsubmit = e => {
        e.preventDefault();
        try { revisao = coletar(el); } catch (er) { msg = { ok: false, txt: er.message }; return mostrarMsg(); }
        if (!revisao.length) { msg = { ok: false, txt: 'Nenhuma alteração para aplicar.' }; return mostrarMsg(); }
        telaRevisao();
      };
    }
    function mostrarMsg() {                                  // mostra a mensagem sem perder o que foi digitado
      const box = el.querySelector('.ad'), velho = box.querySelector('.ad-msg'); if (velho) velho.remove();
      box.querySelector('.ad-topo').insertAdjacentHTML('afterend', aviso());
      box.querySelector('.ad-msg').scrollIntoView({ block: 'nearest' });
    }
    function telaRevisao() {
      const grandes = revisao.some(x => x.tipo === 'bloquear' || (x.tipo === 'recorde' && x.para === null) || x.tipo === 'xp' || x.tipo === 'moedas' || x.tipo === 'pontuacao');
      el.innerHTML = `<div class="ad"><header class="ad-topo"><h2>Confirmar alterações</h2></header>
        <p>As alterações abaixo serão gravadas no perfil deste navegador:</p>
        <ul class="ad-lista">${revisao.map(x => `<li>${esc(x.txt)}</li>`).join('')}</ul>
        ${grandes ? '<p class="ad-alerta">⚠️ Isto muda valores importantes do perfil. Você poderá desfazer a última alteração enquanto esta página estiver aberta. Se quiser uma cópia de segurança, gere antes o código de recuperação no perfil.</p>' : ''}
        <div class="ad-acoes"><button type="button" class="btn big" data-ad="aplicar">Confirmar e aplicar</button>
          <button type="button" class="btn" data-ad="voltar">Voltar sem aplicar</button></div></div>`;
      el.querySelector('[data-ad="aplicar"]').focus({ preventScroll: true });
    }

    el.onclick = e => {
      const b = e.target.closest('[data-ad]'); if (!b || !liberado) return;
      const a = b.dataset.ad;
      try {
        if (a === 'fechar') { revisao = null; liberado = false; msg = null; location.hash = '#/perfil'; return; }
        if (a === 'voltar') { revisao = null; msg = { ok: true, txt: 'Nada foi alterado.' }; return telaPainel(); }
        if (a === 'aplicar' && revisao) { const n = revisao.length; aplicar(revisao); revisao = null; msg = { ok: true, txt: `✅ ${n} alteração(ões) aplicada(s) com sucesso.` }; return telaPainel(); }
        if (a === 'desfazer') { desfazerUltima(); msg = { ok: true, txt: '↩️ Última alteração desfeita.' }; return telaPainel(); }
        if (a === 'conq-todas' || a === 'conq-nenhuma') { el.querySelectorAll('[data-ad-conq]').forEach(c => { c.checked = a === 'conq-todas'; }); return; }
        if (a === 'conq-reset') { const P = Perfil.dados(); el.querySelectorAll('[data-ad-conq]').forEach(c => { c.checked = !!P.conquistas[c.dataset.adConq]; }); return; }
      } catch (er) { msg = { ok: false, txt: er.message }; revisao = null; telaPainel(); }
    };

    liberado ? telaPainel() : telaCodigo();
    return () => { el.onclick = null; revisao = null; };
  }

  WowGames.registerPage({ id: 'admin', nome: '🔧 Ferramentas de teste', mount: pagina });
  WowGames.Admin = { versao: 1 };
})();
