/* wow.games: PLACAR GLOBAL (ranking compartilhado entre todos os jogadores), usando Supabase.
   - Configuração pública em placar-config.js; banco, regras e validações em supabase/placar.sql; passo a passo em docs/placar-global.md.
   - Sem configuração, a página mostra "não configurado" e NADA é enviado pela rede. O localStorage NUNCA é usado como ranking:
     ele guarda só as preferências do jogador e os melhores resultados que ele já enviou (wowgames.placar.v1).
   - Participação opcional (desligada por padrão). É enviado apenas: id do jogo, resultado, nome público escolhido e um id
     anônimo aleatório do aparelho (o servidor guarda só um hash dele, usado para mostrar "você" na lista e limitar envios).
   - Os resultados chegam pelo mesmo evento que os jogos já enviam ao perfil (WowGames.Perfil.aoEvento). O painel de testes
     (admin.js) não tem acesso a este arquivo, a esta chave nem ao servidor.
   - Limitação: como os jogos rodam no navegador, um usuário avançado pode forjar um resultado dentro dos limites aceitos.
     O servidor rejeita valores fora dos limites, formatos inválidos e excesso de envios, mas não consegue provar que a partida foi real. */
(function () {
  const Perfil = WowGames.Perfil;
  if (!Perfil) return;
  const CHAVE = 'wowgames.placar.v1';
  const LIMITE = 50, TEMPO_LIMITE_MS = 8000;
  const NOME_RE = /^[\p{L}\p{N} _.-]{2,16}$/u;
  const num = (v, c = 0) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ESCADA = [100, 200, 300, 500, 800, 1200, 1800, 2500, 3500, 5000, 7000, 10000, 15000, 22000, 35000];

  /* Jogos com resultado comparável. min/max e casas decimais são os MESMOS conferidos pelo servidor (tabela placar_jogos). */
  const JOGOS = [
    { id: 'botao', nome: 'O Botão', icone: '🔴', menor: true, casas: 2, min: 4, max: 3600, rotulo: 'Menor tempo', fmt: v => num(v, 2) + 's',
      valor: ev => ev.tipo === 'fim' ? ev.tempo : null },
    { id: 'tempo', nome: 'Pare no Tempo', icone: '⏱️', menor: true, casas: 3, min: 0, max: 30, rotulo: 'Menor erro', fmt: v => num(v, 3) + 's',
      valor: ev => ev.tipo === 'rodada' ? ev.erro : null },
    { id: 'matematica', nome: 'Matemática Relâmpago', icone: '🧮', menor: false, casas: 0, min: 1, max: 3000, rotulo: 'Maior pontuação', fmt: v => num(v) + ' pts',
      valor: ev => ev.tipo === 'fim' ? ev.pontos : null },
    { id: 'sequencia', nome: 'Complete a Sequência', icone: '🔢', menor: false, casas: 0, min: 1, max: 2000, rotulo: 'Maior pontuação', fmt: v => num(v) + ' pts',
      valor: ev => ev.tipo === 'fim' ? ev.pontos : null },
    { id: 'cor', nome: 'Não Toque no Vermelho', icone: '🎨', menor: false, casas: 0, min: 1, max: 2250, rotulo: 'Maior pontuação', fmt: v => num(v) + ' pts',
      valor: ev => ev.tipo === 'fim' ? ev.pontos : null },
    { id: 'peso', nome: 'Adivinhe o Peso', icone: '⚖️', menor: false, casas: 0, min: 1, max: 1925, rotulo: 'Maior pontuação', fmt: v => num(v) + ' pts',
      valor: ev => ev.tipo === 'fim' ? ev.pontos : null },
    { id: 'show', nome: 'Show de Perguntas', icone: '🎤', menor: false, casas: 0, min: 100, max: 35000, rotulo: 'Maior prêmio', fmt: v => num(v) + ' pts',
      valor: ev => ev.tipo === 'fim' && ESCADA.includes(ev.pontos) ? ev.pontos : null }
  ];
  const jogoDe = id => JOGOS.find(j => j.id === id);
  const melhor = (j, a, b) => j.menor ? a < b : a > b;
  const arred = (v, c) => Math.round(v * 10 ** c) / 10 ** c;

  /* ---------- Configuração ---------- */
  function config() {
    const c = WowGames.PlacarConfig || {}, url = String(c.url || '').trim().replace(/\/+$/, ''), chave = String(c.chaveAnon || '').trim();
    if (!url || !chave) return { ok: false, motivo: 'vazio' };
    if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) return { ok: false, motivo: 'url' };
    if (/^sb_secret_/i.test(chave) || papelDaChave(chave) === 'service_role') {
      console.error('[wow.games] placar-config.js contém uma chave SECRETA. Use a chave pública "anon"/"publishable" e troque a chave secreta no Supabase.');
      return { ok: false, motivo: 'secreta' };
    }
    return { ok: true, url, chave };
  }
  function papelDaChave(k) { try { const p = k.split('.')[1]; return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))).role; } catch (e) { return null; } }

  /* ---------- Estado local (preferências e melhores já enviados; não é ranking) ---------- */
  function ler() {
    try { const s = JSON.parse(localStorage.getItem(CHAVE)); if (s && s.v === 1) return Object.assign({ v: 1, participar: false, nome: '', jogador: null, melhores: {}, pendentes: {} }, s); } catch (e) {}
    return { v: 1, participar: false, nome: '', jogador: null, melhores: {}, pendentes: {} };
  }
  function gravar(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function novoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.random() * 256; });
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const nomeLimpo = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  async function tagDe(id) {                               // os 10 primeiros caracteres do SHA-256 do id, igual ao servidor
    try { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 10); }
    catch (e) { return null; }
  }

  /* ---------- Rede ---------- */
  async function rpc(fn, corpo) {
    const c = config(); if (!c.ok) throw Object.assign(new Error('não configurado'), { tipo: 'config' });
    const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
    let r;
    try {
      r = await fetch(`${c.url}/rest/v1/rpc/${fn}`, { method: 'POST', signal: ctrl.signal, cache: 'no-store',
        headers: { apikey: c.chave, Authorization: 'Bearer ' + c.chave, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(corpo) });
    } catch (e) { throw Object.assign(new Error('sem conexão'), { tipo: 'rede' }); }
    finally { clearTimeout(to); }
    let dados = null; try { dados = await r.json(); } catch (e) {}
    if (!r.ok) throw Object.assign(new Error((dados && (dados.message || dados.hint)) || ('HTTP ' + r.status)), { tipo: 'servidor', status: r.status });
    return dados;
  }
  const ranking = jogo => rpc('placar_ranking', { p_jogo: jogo, p_limite: LIMITE });

  let enviando = false;
  async function enviarPendentes() {
    if (enviando) return; const s0 = ler();
    if (!s0.participar || !s0.jogador || !NOME_RE.test(s0.nome) || !config().ok || !Object.keys(s0.pendentes).length) return;
    enviando = true;
    try {
      for (const id of Object.keys(s0.pendentes)) {
        const j = jogoDe(id), p = ler().pendentes[id]; if (!j || !p) continue;
        try {
          await rpc('placar_enviar', { p_jogo: id, p_valor: p.valor, p_nome: ler().nome, p_jogador: s0.jogador });
          const s = ler(); s.melhores[id] = p.valor; if (s.pendentes[id] && s.pendentes[id].valor === p.valor) delete s.pendentes[id]; gravar(s);
          Perfil.toast(`🌍 <b>PLACAR GLOBAL</b><small>Novo melhor resultado enviado: ${esc(j.nome)}, ${esc(j.fmt(p.valor))}</small>`, 'placar');
        } catch (e) {
          if (e.tipo === 'servidor' && !/muitos_envios/.test(e.message) && e.status < 500) {   // rejeitado de vez (valor/nome inválido): não insiste
            console.warn('[wow.games] Placar recusou o resultado de ' + id + ':', e.message);
            const s = ler(); delete s.pendentes[id]; gravar(s);
          } else break;                                       // sem rede, servidor fora ou limite de envios: tenta depois
        }
      }
    } finally { enviando = false; }
  }

  /* ---------- Recebe os resultados dos jogos (depois de o perfil processar o evento) ---------- */
  Perfil.aoEvento(ev => {
    const j = jogoDe(ev && ev.jogo); if (!j) return;
    const s = ler(); if (!s.participar || !config().ok) return;
    let v = j.valor(ev);
    if (typeof v !== 'number' || !isFinite(v)) return;
    v = arred(v, j.casas);
    if (v < j.min || v > j.max) return;
    const ref = s.pendentes[j.id] ? s.pendentes[j.id].valor : s.melhores[j.id];
    if (ref !== undefined && !melhor(j, v, ref)) return;      // só envia quando supera o próprio melhor
    s.pendentes[j.id] = { valor: v, data: new Date().toISOString() }; gravar(s);
    enviarPendentes();
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(enviarPendentes, 1500));   // reenvia o que ficou pendente (ex.: estava sem internet)

  /* ---------- Página ---------- */
  let abaAtual = JOGOS[0].id;
  function pagina(el) {
    let vivo = true, pedido = 0, minhaTag = null, aviso = null;
    const s0 = ler(); if (s0.jogador) tagDe(s0.jogador).then(t => { minhaTag = t; });

    function desenhar() {
      const c = config(), s = ler(), j = jogoDe(abaAtual);
      const nomeSug = s.nome || nomeLimpo(Perfil.dados().nome);
      const pend = Object.keys(s.pendentes).length;
      el.innerHTML = `<div class="pg">
        <header class="pg-topo"><span class="pg-globo" aria-hidden="true">🌍</span><div><h2>Placar global</h2>
          <p>Os melhores resultados de jogadores do mundo todo, um ranking para cada jogo.</p></div></header>
        ${c.ok ? '' : `<div class="pg-status off" role="status"><b>⚙️ O placar global ainda não foi configurado.</b>
          <p>${c.motivo === 'secreta' ? 'A configuração contém uma chave secreta e foi bloqueada por segurança.' : c.motivo === 'url' ? 'A URL configurada é inválida.' : 'Falta ligar o site a um banco de dados compartilhado (Supabase).'} Enquanto isso, nenhum resultado é enviado. Seus recordes pessoais continuam no perfil.</p></div>`}
        <section class="pg-part ${s.participar ? 'on' : ''}">
          <label class="pg-toggle"><input type="checkbox" id="pg-part" ${s.participar ? 'checked' : ''} ${c.ok ? '' : 'disabled'}> <b>Participar do placar global</b></label>
          <div class="pg-nome"><label for="pg-nome">Nome público</label><input id="pg-nome" class="jg-in pg-in" maxlength="16" autocomplete="off" value="${esc(nomeSug)}" ${c.ok ? '' : 'disabled'}>
            <button type="button" class="btn small" data-pg="salvar" ${c.ok ? '' : 'disabled'}>Salvar</button></div>
          <p class="pg-nota">Só são enviados o jogo, o resultado, este nome (2 a 16 letras, números, espaço, ponto, _ ou -) e um código anônimo do aparelho. Use um apelido, não seu nome completo. ${pend ? `<b>${pend} resultado(s) aguardando envio.</b>` : ''}</p>
          ${aviso ? `<p class="pg-aviso ${aviso.ok ? 'ok' : 'erro'}" role="status">${esc(aviso.txt)}</p>` : ''}
        </section>
        <nav class="pg-abas" role="tablist" aria-label="Jogos do placar">${JOGOS.map(x => `<button type="button" role="tab" class="pg-aba ${x.id === abaAtual ? 'on' : ''}" aria-selected="${x.id === abaAtual}" data-pg-aba="${x.id}">${x.icone} <span>${esc(x.nome)}</span></button>`).join('')}</nav>
        <section class="pg-lista" aria-live="polite">
          <div class="pg-lista-topo"><h3>${j.icone} ${esc(j.nome)} <small>${j.rotulo} · top ${LIMITE}</small></h3>
            <button type="button" class="btn small" data-pg="atualizar" ${c.ok ? '' : 'disabled'}>↻ Atualizar</button></div>
          ${s.melhores[j.id] !== undefined ? `<p class="pg-meu">Seu melhor enviado: <b>${esc(j.fmt(s.melhores[j.id]))}</b></p>` : ''}
          <div id="pg-res">${c.ok ? '<p class="pg-carregando">Carregando…</p>' : '<p class="pg-vazio">Placar indisponível até a configuração ser concluída.</p>'}</div>
        </section>
        <p class="pg-nota pg-rodape">Empates ficam na mesma posição; quem fez primeiro aparece antes. Cada jogador aparece uma vez por jogo, com o melhor resultado. Os jogos rodam no navegador, então o placar confere limites e formatos, mas não consegue garantir que toda partida foi real.</p>
      </div>`;
      if (c.ok) carregar();
    }

    async function carregar() {
      const meu = ++pedido, j = jogoDe(abaAtual), box = () => el.querySelector('#pg-res');
      if (box()) box().innerHTML = '<p class="pg-carregando"><span class="pg-spin" aria-hidden="true"></span> Carregando…</p>';
      try {
        const linhas = await ranking(j.id);
        if (!vivo || meu !== pedido || !box()) return;
        if (!Array.isArray(linhas) || !linhas.length) { box().innerHTML = '<p class="pg-vazio">Ainda não há resultados neste jogo. Que tal ser o primeiro? 🏁</p>'; return; }
        const s = ler(); if (s.jogador && !minhaTag) minhaTag = await tagDe(s.jogador);
        if (!vivo || meu !== pedido || !box()) return;
        box().innerHTML = `<ol class="pg-rank">${linhas.map(l => {
          const eu = minhaTag && l.jogador_tag === minhaTag, pos = Number(l.posicao);
          const v = Number(l.valor), data = l.criado_em ? new Date(l.criado_em).toLocaleDateString('pt-BR') : '';
          return `<li class="${eu ? 'eu' : ''} ${pos <= 3 ? 'top' + pos : ''}"><span class="pg-pos">${pos <= 3 ? ['🥇', '🥈', '🥉'][pos - 1] : pos + 'º'}</span>
            <span class="pg-quem">${esc(l.nome)}${eu ? ' <em>você</em>' : ''}</span><b class="pg-val">${esc(isFinite(v) ? j.fmt(v) : '—')}</b><small class="pg-data">${esc(data)}</small></li>`;
        }).join('')}</ol>`;
      } catch (e) {
        if (!vivo || meu !== pedido || !box()) return;
        box().innerHTML = `<div class="pg-erro" role="alert"><p>${e.tipo === 'rede' ? '📡 Não foi possível conectar ao placar. Verifique sua internet.' : '⚠️ O placar não respondeu como esperado.'}</p>
          <button type="button" class="btn small" data-pg="atualizar">Tentar de novo</button></div>`;
        console.warn('[wow.games] Placar: erro ao carregar o ranking:', e.message);
      }
    }

    el.onclick = e => {
      const a = e.target.closest('[data-pg-aba]');
      if (a) { abaAtual = a.dataset.pgAba; aviso = null; return desenhar(); }
      const b = e.target.closest('[data-pg]'); if (!b) return;
      if (b.dataset.pg === 'atualizar') return carregar();
      if (b.dataset.pg === 'salvar') salvarNome();
    };
    el.onchange = e => {
      if (e.target.id !== 'pg-part') return;
      const s = ler();
      if (e.target.checked) {
        const n = nomeLimpo(el.querySelector('#pg-nome').value);
        if (!NOME_RE.test(n)) { e.target.checked = false; return avisar(false, 'Escolha um nome público válido antes de participar (2 a 16 letras, números, espaço, ponto, _ ou -).'); }
        s.participar = true; s.nome = n; if (!s.jogador) s.jogador = novoId();
        aviso = { ok: true, txt: 'Pronto! Seus próximos melhores resultados serão enviados ao placar.' };
      } else { s.participar = false; s.pendentes = {}; aviso = { ok: true, txt: 'Você saiu do placar. Nada mais será enviado (resultados já enviados continuam lá).' }; }
      gravar(s); tagDe(s.jogador || '').then(t => { minhaTag = s.jogador ? t : null; }); desenhar();
    };
    function avisar(okk, txt) {                              // mostra o aviso sem redesenhar (não apaga o que foi digitado)
      aviso = { ok: okk, txt };
      const sec = el.querySelector('.pg-part'); if (!sec) return;
      let p = sec.querySelector('.pg-aviso'); if (!p) { p = document.createElement('p'); p.setAttribute('role', 'status'); sec.appendChild(p); }
      p.className = 'pg-aviso ' + (okk ? 'ok' : 'erro'); p.textContent = txt;
    }
    function salvarNome() {
      const n = nomeLimpo(el.querySelector('#pg-nome').value);
      if (!NOME_RE.test(n)) return avisar(false, 'Nome inválido: use de 2 a 16 letras, números, espaço, ponto, _ ou -.');
      const s = ler(); s.nome = n; gravar(s); aviso = { ok: true, txt: 'Nome público salvo. Ele aparece nos próximos envios.' }; desenhar();
    }

    desenhar();
    enviarPendentes();
    return () => { vivo = false; el.onclick = null; el.onchange = null; };
  }

  WowGames.registerPage({ id: 'placar', nome: '🌍 Placar global', mount: pagina });
  WowGames.Placar = { JOGOS, CHAVE, configurado: () => config().ok, ranking, enviarPendentes };
})();
