/* wow.world — ESTADO DO JOGADOR, salvamento e regras de missões/segredos.
   Chave própria e versionada: wowgames.mundo.v1 (não toca no perfil nem em outras chaves). Como começa com "wowgames.",
   entra automaticamente no código de recuperação do perfil (perfil-recuperacao.js), sem nenhuma mudança nele.
   Tudo aqui é idempotente: marcar de novo algo já marcado não muda nada, não grava de novo e não dá recompensa outra vez.
   As ações que desbloqueiam coisas conferem as condições aqui dentro (ex.: um cristal só acende com uma reação já descoberta). */
(function () {
  const MD = WowGames.MundoDados;
  const CHAVE = 'wowgames.mundo.v1', VERSAO = 1;
  const agora = () => new Date().toISOString();
  const CAMPOS = {                                                     // campo: lista de chaves válidas (null = qualquer id curto)
    visitadas: MD.REGIOES.map(r => r.id), pontos: null, registros: Object.keys(MD.REGISTROS), simbolos: Object.keys(MD.SIMBOLOS),
    reacoes: Object.keys(MD.REACOES), cristais: MD.CRISTAIS.map(c => c.id), provas: Object.keys(MD.PROVAS),
    segredos: MD.SEGREDOS.map(s => s.id), marcos: ['portaoFloresta', 'clareira', 'portaoAntigos', 'tempoPerfeito', 'camara', 'ponte'],
    recompensas: MD.MISSOES.map(m => m.id).concat('segredos')
  };
  const vazio = () => { const s = { v: VERSAO }; Object.keys(CAMPOS).forEach(k => { s[k] = {}; }); return s; };

  /* ---------- Carregar com validação (JSON inválido ou campos estranhos nunca travam o site) ---------- */
  let S = null, erroSalvar = null, aviso = null;
  function limpar(bruto) {
    const s = vazio();
    if (!bruto || typeof bruto !== 'object' || bruto.v !== VERSAO) return s;
    Object.entries(CAMPOS).forEach(([k, ok]) => {
      const o = bruto[k]; if (!o || typeof o !== 'object' || Array.isArray(o)) return;
      Object.entries(o).forEach(([id, v]) => {
        if (typeof id !== 'string' || id.length > 40 || (ok && !ok.includes(id))) return;
        if (k === 'cristais') { if (typeof v === 'string' && MD.REACOES[v] && MD.CRISTAIS.find(c => c.id === id).reacoes.includes(v)) s[k][id] = v; return; }
        if (typeof v === 'string' && v.length <= 40) s[k][id] = v;
      });
    });
    return s;
  }
  function carregar() {
    let raw = null;
    try { raw = localStorage.getItem(CHAVE); } catch (e) { aviso = 'O navegador bloqueou o armazenamento: o progresso do wow.world vale só nesta visita.'; return vazio(); }
    if (raw === null) return vazio();
    try { return limpar(JSON.parse(raw)); }
    catch (e) {                                                        // guarda uma cópia do dado ilegível antes de seguir com um estado novo
      try { if (!localStorage.getItem(CHAVE + '.ilegivel')) localStorage.setItem(CHAVE + '.ilegivel', raw); } catch (e2) {}
      aviso = 'O progresso salvo do wow.world estava ilegível e foi guardado à parte. Um novo diário foi iniciado.';
      return vazio();
    }
  }
  const dados = () => (S || (S = carregar()));
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(dados())); erroSalvar = null; return true; }
    catch (e) { erroSalvar = 'Não foi possível salvar o progresso do wow.world neste navegador (armazenamento cheio ou bloqueado).'; console.error('[wow.world]', e); return false; }
  }

  /* ---------- Mudanças: só gravam e avisam se algo mudou de fato ---------- */
  const ouvintes = [];
  let novidades = [];
  function marcar(campo, id, valor) {
    const s = dados();
    if (s[campo][id]) return false;
    s[campo][id] = valor || agora(); return true;
  }
  function aplicar(fn, rotulo) {
    const antes = JSON.stringify(dados());
    const r = fn(dados());
    if (JSON.stringify(dados()) === antes) return r;                   // nada novo: sem gravação, sem recompensa
    salvar(); verificarRecompensas();
    const n = novidades; novidades = [];
    ouvintes.forEach(o => { try { o(rotulo, n); } catch (e) { console.error('[wow.world]', e); } });
    return r;
  }

  /* ---------- Ecos (descobertas que abrem a câmara) ---------- */
  function ecos() {
    const s = dados(), lista = [];
    Object.entries(MD.SIMBOLOS).forEach(([k, v]) => lista.push({ id: 'simbolo_' + k, nome: `Símbolo ${v.icone} ${v.nome}`, ok: !!s.simbolos[k], onde: 'Floresta dos Sussurros (trilha)' }));
    lista.push({ id: 'clareira', nome: 'Caderno da clareira escondida', ok: !!s.marcos.clareira, onde: 'Floresta dos Sussurros, depois do Portão de Raízes' });
    MD.CRISTAIS.forEach(c => lista.push({ id: 'cristal_' + c.id, nome: c.nome + ' desperto', ok: !!s.cristais[c.id], onde: 'Ilhas Elementais (Altar dos Cristais)' }));
    lista.push({ id: 'portao_antigos', nome: 'Portão dos Antigos aberto', ok: !!s.marcos.portaoAntigos, onde: 'Distrito das Provas' });
    MD.SEGREDOS.forEach(g => lista.push({ id: 'segredo_' + g.id, nome: 'Segredo: ' + g.nome, ok: !!s.segredos[g.id], onde: 'segredo', segredo: true }));
    lista.push({ id: 'reg_telescopio', nome: 'Diário do último astrônomo', ok: !!s.registros.telescopio, onde: 'Observatório Esquecido' });
    lista.push({ id: 'reg_placa', nome: 'A placa partida', ok: !!s.registros.placa, onde: 'Observatório Esquecido' });
    return lista;
  }
  const nEcos = () => ecos().filter(e => e.ok).length;

  /* ---------- Missões (estado calculado a partir das descobertas reais) ---------- */
  function missoes() {
    const s = dados(), c = k => Object.keys(s[k]).length;
    const regOk = MD.REGIOES.filter(r => s.visitadas[r.id] && s.pontos[r.principal]).length;
    const prog = {
      m1: [regOk, 5], m2: [c('simbolos') + (s.marcos.portaoFloresta ? 1 : 0), 4], m3: [(c('reacoes') ? 1 : 0) + (c('cristais') ? 1 : 0), 2],
      m4: [(c('provas') ? 1 : 0) + (s.marcos.portaoAntigos ? 1 : 0), 2], m5: [Math.min(nEcos(), MD.ECOS_NECESSARIOS) + (s.marcos.camara ? 1 : 0), MD.ECOS_NECESSARIOS + 1]
    };
    const feita = { m1: regOk === 5, m2: !!s.marcos.portaoFloresta, m3: c('cristais') > 0, m4: !!s.marcos.portaoAntigos, m5: !!s.marcos.camara };
    return MD.MISSOES.map(m => ({ ...m, progresso: prog[m.id][0], total: prog[m.id][1], estado: feita[m.id] ? 'concluida' : prog[m.id][0] > 0 ? 'andamento' : 'disponivel' }));
  }
  const nivelTorre = () => missoes().filter(m => m.estado === 'concluida').length;

  /* ---------- Recompensas: conquistas do sistema existente (dão XP uma única vez) ---------- */
  function verificarRecompensas() {
    const s = dados(), envios = [];
    missoes().forEach(m => { if (m.estado === 'concluida' && !s.recompensas[m.id]) { s.recompensas[m.id] = agora(); envios.push({ tipo: 'missao', id: m.id, nome: m.nome }); } });
    if (Object.keys(s.segredos).length === MD.SEGREDOS.length && !s.recompensas.segredos) { s.recompensas.segredos = agora(); envios.push({ tipo: 'segredos', id: 'segredos', nome: 'Todos os segredos' }); }
    if (!envios.length) return;
    salvar();                                                            // grava ANTES de avisar o perfil: nunca envia duas vezes
    envios.forEach(e => {
      novidades.push(e);
      if (WowGames.Perfil) WowGames.Perfil.toast(e.tipo === 'missao' ? `🗺️ <b>MISSÃO CONCLUÍDA!</b><span>“${e.nome}”</span><small>wow.world</small>` : `🗝️ <b>TODOS OS SEGREDOS!</b><small>wow.world</small>`, 'conquista');
      try { WowGames.evento({ jogo: 'mundo', tipo: e.tipo, id: e.id }); } catch (er) { console.error('[wow.world]', er); }
    });
  }

  /* ---------- Ações validadas ---------- */
  const A = {
    visitar: id => aplicar(() => { if (MD.REGIOES.some(r => r.id === id)) marcar('visitadas', id); }, 'visita'),
    examinar: id => aplicar(() => {
      const todos = Object.values(MD.PONTOS).flat();
      if (!todos.some(p => p.id === id)) return;
      marcar('pontos', id);
      const p = todos.find(x => x.id === id); if (p.registro) marcar('registros', p.registro);
    }, 'ponto'),
    lerRegistro: id => aplicar(() => {                                  // só registros que fazem parte de um lugar já desbloqueado
      const s = dados();
      const liberado = { clareira: !!s.marcos.portaoFloresta, eco: !!s.marcos.camara, ponte: !!s.marcos.ponte }[id];   // os demais se leem examinando o lugar
      if (liberado) marcar('registros', id);
    }, 'registro'),
    acharSimbolo: k => aplicar(() => { if (MD.SIMBOLOS[k]) { if (marcar('simbolos', k)) novidades.push({ tipo: 'simbolo', id: k }); } }, 'simbolo'),
    abrirPortaoFloresta(seq) {
      const s = dados();
      if (Object.keys(s.simbolos).length < 3) return { ok: false, msg: 'O portão tem três encaixes vazios. Ainda faltam símbolos para descobrir na trilha.' };
      if (!Array.isArray(seq) || seq.join() !== MD.ORDEM_PORTAO.join()) return { ok: false, msg: 'As raízes se fecham de novo. A ordem não está certa: releia as frases das pedras.' };
      aplicar(() => { if (marcar('marcos', 'portaoFloresta')) novidades.push({ tipo: 'portao' }); }, 'portao');
      return { ok: true, msg: 'As raízes se afastam devagar e revelam uma passagem para a clareira escondida!' };
    },
    acharClareira: () => aplicar(() => { if (dados().marcos.portaoFloresta) { marcar('marcos', 'clareira'); marcar('registros', 'clareira'); } }, 'clareira'),
    ativarCristal(cid, rid) {
      const s = dados(), c = MD.CRISTAIS.find(x => x.id === cid);
      if (!c) return { ok: false, msg: 'Cristal desconhecido.' };
      if (s.cristais[cid]) return { ok: true, msg: `${c.nome} já está aceso.` };
      if (!s.reacoes[rid]) return { ok: false, msg: 'Você ainda não descobriu essa reação no wow.elements.' };
      if (!c.reacoes.includes(rid)) return { ok: false, msg: `O ${c.nome.toLowerCase()} não reage a “${MD.REACOES[rid]}”. Tente outra energia.` };
      aplicar(() => {
        s.cristais[cid] = rid; novidades.push({ tipo: 'cristal', id: cid });
        if (Object.keys(s.cristais).length === MD.CRISTAIS.length) { marcar('marcos', 'ponte'); marcar('registros', 'ponte'); }
      }, 'cristal');
      return { ok: true, msg: `${c.nome} despertou com a energia de “${MD.REACOES[rid]}”!` };
    },
    abrirPortaoAntigos() {
      if (!Object.keys(dados().provas).length) return { ok: false, msg: 'O portão não reconhece você. Termine uma prova de Matemática Relâmpago, Complete a Sequência ou O Caso #001.' };
      aplicar(() => { if (marcar('marcos', 'portaoAntigos')) novidades.push({ tipo: 'antigos' }); }, 'antigos');
      return { ok: true, msg: 'O Portão dos Antigos range e se abre. Os juízes de pedra fazem uma reverência.' };
    },
    revelarRaiz() { aplicar(() => { if (marcar('segredos', 'raiz')) novidades.push({ tipo: 'segredo', id: 'raiz' }); }, 'segredo'); return { ok: true }; },
    tocarSino() {
      const s = dados();
      if (s.segredos.sino) return { ok: true, msg: 'Blém! O sino dourado responde com alegria.' };
      if (!s.marcos.tempoPerfeito) return { ok: false, msg: 'Você puxa a corda, mas o sino fica em silêncio. Talvez ele espere alguém com um relógio interno muito preciso…' };
      aplicar(() => { marcar('segredos', 'sino'); novidades.push({ tipo: 'segredo', id: 'sino' }); }, 'segredo');
      return { ok: true, msg: 'BLÉM! O sino reconhece quem parou o tempo quase no instante exato e fica dourado!' };
    },
    constelacao(seq) {
      if (dados().segredos.constelacao) return { ok: true, msg: 'A constelação esquecida continua brilhando.' };
      if (!Array.isArray(seq) || seq.join() !== MD.ORDEM_PORTAO.join()) return { ok: false, msg: 'As estrelas piscam e se apagam. Não é essa a ordem.' };
      aplicar(() => { marcar('segredos', 'constelacao'); novidades.push({ tipo: 'segredo', id: 'constelacao' }); }, 'segredo');
      return { ok: true, msg: 'As três estrelas se ligam por fios de luz: a constelação esquecida voltou ao céu!' };
    },
    abrirCamara() {
      const n = nEcos();
      if (dados().marcos.camara) return { ok: true, msg: 'A câmara está aberta.' };
      if (n < MD.ECOS_NECESSARIOS) return { ok: false, msg: `A porta vibra, mas não abre: ${n} de ${MD.ECOS_NECESSARIOS} ecos reunidos.` };
      aplicar(() => { marcar('marcos', 'camara'); marcar('registros', 'eco'); novidades.push({ tipo: 'camara' }); }, 'camara');
      return { ok: true, msg: 'Os ecos se juntam e a porta de pedra desliza. A Câmara do Primeiro Eco está aberta!' };
    }
  };

  /* ---------- Resultados vindos dos jogos (chamado só pela camada de integração; tudo validado) ---------- */
  function processarEvento(ev) {
    if (!ev || typeof ev.jogo !== 'string' || ev.jogo === 'mundo') return;
    return aplicar(s => {
      if (ev.jogo === 'elementos') {
        if (ev.tipo === 'reacao' && MD.REACOES[ev.reacao]) { if (marcar('reacoes', ev.reacao)) novidades.push({ tipo: 'reacao', id: ev.reacao }); }
        if (ev.tipo === 'sync' && Array.isArray(ev.ids)) ev.ids.forEach(id => { if (MD.REACOES[id]) marcar('reacoes', id); });
      }
      if (MD.PROVAS[ev.jogo] && ev.tipo === 'fim') { if (marcar('provas', ev.jogo)) novidades.push({ tipo: 'prova', id: ev.jogo }); }
      if (ev.jogo === 'tempo' && ev.tipo === 'rodada' && typeof ev.erro === 'number' && isFinite(ev.erro) && ev.erro >= 0 && ev.erro <= .15) {
        if (marcar('marcos', 'tempoPerfeito')) novidades.push({ tipo: 'tempo' });
      }
    }, 'evento');
  }
  // Resultados anteriores ao wow.world, lidos do perfil (somente leitura): recordes existem apenas depois de partidas concluídas.
  function importarDoPerfil(P) {
    if (!P || !P.recordes) return;
    return aplicar(() => {
      const r = P.recordes;
      if (r['matematica:tempo']) marcar('provas', 'matematica', 'perfil');
      if (r['sequencia:tempo']) marcar('provas', 'sequencia', 'perfil');
      if (r['caso001:pontos']) marcar('provas', 'caso001', 'perfil');
      if (r['tempo:erro'] && typeof r['tempo:erro'].valor === 'number' && r['tempo:erro'].valor <= .15) marcar('marcos', 'tempoPerfeito', 'perfil');
      if (P.conquistas && P.conquistas.pequenojardineiro) marcar('reacoes', 'germinar', 'perfil');
    }, 'perfil');
  }

  WowGames.MundoEstado = Object.assign({ CHAVE, VERSAO, dados, salvar, ecos, nEcos, missoes, nivelTorre, processarEvento, importarDoPerfil,
    aoMudar: fn => ouvintes.push(fn), erro: () => erroSalvar, aviso: () => { const a = aviso; aviso = null; return a; },
    _recarregar: () => { S = null; return dados(); } }, A);
})();
