/* wow.games: código de recuperação, exportar e importar save.
   Não existe servidor, então o código CONTÉM o progresso: ele é um texto longo (dados compactados + verificação de erros)
   que começa com um ID aleatório do perfil, ex.: W7K9-XP42-8MQL-4R2F-9Z8C-....  Como o progresso fica dentro dele,
   o código funciona em outro computador ou navegador, mas representa o progresso do momento em que foi gerado.
   Este arquivo não guarda nada novo: o ID fica dentro do próprio perfil (Perfil.recuperacao) e o save inclui
   automaticamente TODAS as chaves "wowgames.*" do localStorage, inclusive as de jogos futuros. */
(function () {
  const Perfil = WowGames.Perfil;
  const FORMATO = 'wowgames-save', VERSAO = 1, PREFIXO = 'wowgames.';
  const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';       // Base32 sem I, L, O, U (evita confusão ao digitar)
  const ID_TAM = 20, MAX_NOTAS = 3000;

  /* Versões futuras: se o formato mudar, crie MIGRACOES[1] = save => (save da versão 2). Saves antigos continuam abrindo. */
  const MIGRACOES = {};
  /* Chaves cujo conteúdo, no estado inicial, não conta como "perfil existente" (usado só no aviso antes de substituir). */
  const SEM_PROGRESSO = {
    'wowgames.milhao.v1': v => v.saldo === 1000 && !v.foguete && !v.bomba && !v.banco && !Object.keys(v.metas || {}).length && !(v.stats && (v.stats.foguetes || v.stats.bombas || v.stats.bancos)),
    'wowgames.caso001.estado': v => v.fase === 'intro',
    'wowgames.caso001.notas': v => !v,
    'wowgames.premios.v1': v => !v.giros
  };

  const erro = m => Object.assign(new Error(m), { amigavel: true });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bytesDe = s => new window.TextEncoder().encode(s);
  const juntar = (a, b) => { const r = new Uint8Array(a.length + b.length); r.set(a); r.set(b, a.length); return r; };

  /* ---------- CRC32 (verificação de integridade) ---------- */
  const TAB = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = bytes => { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = TAB[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const crcHex = store => crc32(bytesDe(JSON.stringify(store))).toString(16).padStart(8, '0');

  /* ---------- Base32 ---------- */
  function b32enc(bytes) {
    let bits = 0, val = 0, out = '';
    for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += ALFABETO[(val >>> (bits - 5)) & 31]; bits -= 5; } val &= (1 << bits) - 1; }
    if (bits > 0) out += ALFABETO[(val << (5 - bits)) & 31];
    return out;
  }
  function b32dec(str) {
    let bits = 0, val = 0; const out = [];
    for (const ch of str) { val = (val << 5) | ALFABETO.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } val &= (1 << bits) - 1; }
    return Uint8Array.from(out);
  }
  const formatar = t => t.match(/.{1,4}/g).join('-');

  /* ---------- ID aleatório (crypto.getRandomValues; Math.random só se o navegador não tiver crypto) ---------- */
  function novoId() {
    const a = new Uint8Array(ID_TAM), c = window.crypto;
    if (c && c.getRandomValues) c.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = (Math.floor(Math.random() * 256) ^ (Date.now() >>> (i % 8))) & 255;
    return Array.from(a, x => ALFABETO[x & 31]).join('');
  }

  /* ---------- Compactação (quando o navegador suporta) ---------- */
  async function comprimir(b) {
    if (!window.CompressionStream) return { b, flag: 0 };
    try {
      const cs = new window.CompressionStream('deflate-raw'), w = cs.writable.getWriter();
      w.write(b); w.close();
      return { b: new Uint8Array(await new window.Response(cs.readable).arrayBuffer()), flag: 1 };
    } catch (e) { return { b, flag: 0 }; }
  }
  async function descomprimir(b) {
    if (!window.DecompressionStream) throw erro('Este navegador não consegue abrir esse código. Atualize o navegador ou use o arquivo .json.');
    try {
      const ds = new window.DecompressionStream('deflate-raw'), w = ds.writable.getWriter();
      w.write(b); w.close();
      return new Uint8Array(await new window.Response(ds.readable).arrayBuffer());
    } catch (e) { throw erro('Os dados do código estão corrompidos.'); }
  }

  /* ---------- Montar e validar o save ---------- */
  function montarSave(id) {
    const store = {};
    const chaves = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIXO)) chaves.push(k); }
    chaves.sort().forEach(k => { const raw = localStorage.getItem(k); try { store[k] = JSON.parse(raw); } catch (e) { store[k] = { __texto: raw }; } });
    const nk = PREFIXO + 'caso001.notas';
    if (typeof store[nk] === 'string' && store[nk].length > MAX_NOTAS) store[nk] = store[nk].slice(0, MAX_NOTAS);   // anotações enormes deixariam o código gigante
    const P = store[Perfil.CHAVE] || {};
    return { format: FORMATO, version: VERSAO, recoveryId: id, savedAt: new Date().toISOString(),
      resumo: { nome: String(P.nome || 'Jogador').slice(0, 16), xp: P.xp || 0, nivel: Perfil.nivelDe(P.xp || 0), conquistas: Object.keys(P.conquistas || {}).length, partidas: P.partidas || 0 }, store };
  }
  const objeto = o => o && typeof o === 'object' && !Array.isArray(o);
  function validar(s) {
    if (!objeto(s) || s.format !== FORMATO) throw erro('Isto não é um save do wow.games.');
    if (!Number.isInteger(s.version) || s.version < 1) throw erro('Versão do save inválida.');
    if (s.version > VERSAO) throw erro('Este save foi criado por uma versão mais nova do wow.games. Atualize a página e tente de novo.');
    while (s.version < VERSAO) { if (!MIGRACOES[s.version]) throw erro('Versão antiga do save não suportada.'); s = MIGRACOES[s.version](s); }
    const st = s.store;
    if (!objeto(st) || !Object.keys(st).length || Object.keys(st).length > 50) throw erro('O save está vazio ou corrompido.');
    for (const k of Object.keys(st)) if (!/^wowgames\.[a-z0-9._-]{1,60}$/.test(k)) throw erro('O save contém dados desconhecidos.');
    const P = st[Perfil.CHAVE];
    if (P !== undefined && !(objeto(P) && Number.isFinite(P.xp) && P.xp >= 0 && typeof P.nome === 'string' && P.nome.length <= 40 && objeto(P.conquistas || {}) && objeto(P.recordes || {}) && objeto(P.jogos || {})))
      throw erro('Os dados do perfil estão corrompidos.');
    for (const k of ['wowgames.premios.v1', 'wowgames.milhao.v1']) if (st[k] !== undefined && !objeto(st[k])) throw erro('Os dados de um jogo estão corrompidos.');
    return s;
  }

  /* ---------- Código de recuperação ---------- */
  async function gerarCodigo() {
    let id = (Perfil.dados().recuperacao || {}).id;
    if (!id) { id = novoId(); Perfil.atualizar(P => { P.recuperacao = { id, criadoEm: new Date().toISOString() }; }); }   // o ID passa a fazer parte do perfil
    const save = montarSave(id), { b: corpo, flag } = await comprimir(bytesDe(JSON.stringify(save)));
    const cab = new Uint8Array(10), dv = new DataView(cab.buffer);
    cab[0] = VERSAO; cab[1] = flag; dv.setUint32(2, corpo.length); dv.setUint32(6, crc32(juntar(bytesDe(id), corpo)));
    return { id, codigo: formatar(id + b32enc(juntar(cab, corpo))) };
  }
  async function lerCodigo(entrada) {
    let t = String(entrada || '').toUpperCase().replace(/[\s\-_.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');   // ignora espaços, hífens e minúsculas
    if (!t) throw erro('Digite o seu código de recuperação.');
    if (!/^[0-9A-HJKMNP-TV-Z]+$/.test(t)) throw erro('Código inválido: há caracteres que não fazem parte do código.');
    if (t.length < ID_TAM + 16) throw erro('Código incompleto. Copie o código inteiro.');
    const id = t.slice(0, ID_TAM), bytes = b32dec(t.slice(ID_TAM)), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes[0] > VERSAO) throw erro('Este código foi criado por uma versão mais nova do wow.games. Atualize a página e tente de novo.');
    if (bytes[0] < 1) throw erro('Código inválido.');
    const len = dv.getUint32(2);
    if (bytes.length < 10 + len) throw erro('Código incompleto. Copie o código inteiro.');
    if (bytes.length > 10 + len) throw erro('Código inválido: há caracteres sobrando.');
    const corpo = bytes.slice(10);
    if (crc32(juntar(bytesDe(id), corpo)) !== dv.getUint32(6)) throw erro('Código inválido ou com erro de digitação. Confira se copiou o código inteiro.');
    let save;
    try { save = JSON.parse(new window.TextDecoder().decode(bytes[1] & 1 ? await descomprimir(corpo) : corpo)); } catch (e) { if (e.amigavel) throw e; throw erro('Os dados do código estão corrompidos.'); }
    save = validar(save);
    if (save.recoveryId !== id) throw erro('Código inválido.');
    return save;
  }

  /* ---------- Arquivo .json ---------- */
  function lerArquivo(texto) {
    let o; try { o = JSON.parse(texto); } catch (e) { throw erro('Arquivo inválido: não é um save em JSON.'); }
    if (!objeto(o)) throw erro('Arquivo inválido.');
    const { crc, ...save } = o;
    if (typeof crc !== 'string' || !objeto(save.store) || crc !== crcHex(save.store)) throw erro('Arquivo corrompido ou alterado: a verificação de integridade falhou.');
    return validar(save);
  }
  function baixarArquivo() {
    const save = montarSave((Perfil.dados().recuperacao || {}).id || null);
    const blob = new Blob([JSON.stringify({ ...save, crc: crcHex(save.store) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `wowgames-save-${Perfil.hoje()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- Aplicar (substitui os dados wowgames.* deste navegador; volta tudo ao normal se algo falhar) ---------- */
  function temDados() {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k || !k.startsWith(PREFIXO) || k === Perfil.CHAVE) continue;
      let v; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { return true; }
      if (!(SEM_PROGRESSO[k] && v && SEM_PROGRESSO[k](v)) && !(k in SEM_PROGRESSO && !v)) return true;
    }
    const P = Perfil.dados();
    return !!(P.xp > 0 || P.partidas > 0 || P.nome !== 'Jogador' || P.avatar !== '🦊' || P.recuperacao || Object.keys(P.conquistas).length);
  }
  function aplicar(save) {
    const antigos = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIXO)) antigos.push([k, localStorage.getItem(k)]); }
    try {
      antigos.forEach(([k]) => localStorage.removeItem(k));
      for (const [k, v] of Object.entries(save.store)) localStorage.setItem(k, objeto(v) && Object.keys(v).length === 1 && '__texto' in v ? String(v.__texto) : JSON.stringify(v));
    } catch (e) {
      antigos.forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch (x) {} });
      throw erro('Não foi possível gravar os dados neste navegador. Seu perfil atual foi mantido.');
    }
  }

  /* ---------- Interface: seção "Seu perfil" dentro da página de Perfil ---------- */
  let msgPendente = null;
  Perfil.montarRecuperacao = function (box, aoMudar) {
    let tela = 'inicio', msg = msgPendente, ocupado = false, mostrar = false, gerado = null, novo = null; msgPendente = null;
    const resumoTxt = r => `${esc(r.nome)}, nível ${r.nivel}, ${r.xp} XP, ${r.conquistas} conquistas`;
    const atual = () => { const P = Perfil.dados(); return { nome: P.nome, xp: P.xp, nivel: Perfil.nivelDe(P.xp), conquistas: Object.keys(P.conquistas).length }; };
    const temId = () => !!(Perfil.dados().recuperacao || {}).id;

    function desenhar() {
      let h;
      if (tela === 'codigo') {
        h = `<h4>🔐 CÓDIGO DE RECUPERAÇÃO</h4>` + (!mostrar
          ? `<p>O código fica escondido para ninguém ver por cima do seu ombro.</p><div class="rc-btns"><button class="btn" data-r="mostrar" ${ocupado ? 'disabled' : ''}>👁️ Mostrar código</button><button class="btn" data-r="voltar">Voltar</button></div>`
          : `<div class="rc-id">${gerado.id.match(/.{4}/g).join('-')}</div>
             <textarea class="rc-area" id="rc-codigo" rows="6" readonly spellcheck="false">${gerado.codigo}</textarea>
             <div class="rc-btns"><button class="btn" data-r="copiar">📋 COPIAR CÓDIGO</button><button class="btn" data-r="voltar">Voltar</button></div>
             <p class="rc-aviso">⚠️ Guarde este código em um local seguro. Ele é usado para recuperar seu progresso, e qualquer pessoa com o código pode abrir uma cópia dele.</p>
             <p><small>O código contém o seu progresso até agora. Depois de jogar mais, gere o código de novo para guardar o progresso novo. As letras iniciais são o ID do seu perfil e não mudam.</small></p>`);
      } else if (tela === 'recuperar') {
        h = `<h4>RECUPERAR PERFIL</h4><label for="rc-entrada"><b>Digite seu código de recuperação:</b></label>
          <textarea class="rc-area" id="rc-entrada" rows="5" spellcheck="false" autocomplete="off" placeholder="W7K9-XP42-8MQL-4R2F-9Z8C-..."></textarea>
          <div class="rc-btns"><button class="btn" data-r="recuperar" ${ocupado ? 'disabled' : ''}>RECUPERAR PERFIL</button><button class="btn" data-r="voltar">Cancelar</button></div>`;
      } else if (tela === 'confirmar') {
        h = `<h4>⚠️ ATENÇÃO</h4><p><b>Você já possui um perfil neste dispositivo.</b><br>Ao recuperar outro perfil, os dados atuais poderão ser substituídos.</p>
          <p>Perfil atual: ${resumoTxt(atual())}<br>Perfil a recuperar: ${resumoTxt(novo.resumo)}</p>
          <div class="rc-btns"><button class="btn" data-r="cancelar">CANCELAR</button><button class="btn rc-perigo" data-r="continuar">CONTINUAR</button></div>`;
      } else {
        h = `<h4>🔐 Seu perfil</h4>` + (temId()
          ? `<p>Seu código de recuperação já foi criado. Use-o para levar seu progresso para outro navegador ou computador.</p>`
          : `<p>✅ Seu perfil está pronto! Você ainda não possui um código de recuperação.</p>`) +
          `<div class="rc-btns">${temId() ? '<button class="btn" data-r="ver">Ver código de recuperação</button>' : '<button class="btn" data-r="gerar">GERAR CÓDIGO</button>'}
            <button class="btn" data-r="tenho">Já tenho um código</button></div>
          <div class="rc-btns"><button class="btn" data-r="exportar">⬇️ Exportar save (.json)</button><button class="btn" data-r="importar">⬆️ Importar save (.json)</button></div>
          <input type="file" id="rc-arq" accept=".json,application/json" hidden>`;
      }
      box.innerHTML = `<div class="rc">${h}${msg ? `<p class="rc-msg ${msg.tipo}">${msg.txt}</p>` : ''}</div>`;
      const e = box.querySelector('#rc-entrada'); if (e && novo && novo.entrada) e.value = novo.entrada;
    }
    const dizer = (tipo, txt) => { msg = { tipo, txt }; };
    const falha = e => { dizer('erro', e && e.amigavel ? e.message : 'Algo deu errado. Tente de novo.'); ocupado = false; desenhar(); };

    function pedirConfirmacao(save) {
      novo = { save, resumo: save.resumo };
      if (temDados()) { tela = 'confirmar'; msg = null; desenhar(); } else concluir(save);
    }
    function concluir(save) {
      try { aplicar(save); } catch (e) { return falha(e); }
      msgPendente = { tipo: 'ok', txt: '✅ Perfil recuperado com sucesso!' };
      Perfil.toast('✅ <b>Perfil recuperado com sucesso!</b><small>Seu progresso voltou.</small>', 'nivel');
      if (aoMudar) aoMudar(); else { tela = 'inicio'; msg = msgPendente; msgPendente = null; desenhar(); }
    }

    box.onclick = async e => {
      const b = e.target.closest('[data-r]'); if (!b || b.disabled) return;
      msg = null;
      switch (b.dataset.r) {
        case 'gerar': case 'ver':
          ocupado = true;
          try { gerado = await gerarCodigo(); tela = 'codigo'; mostrar = false; ocupado = false; if (b.dataset.r === 'gerar') dizer('ok', 'Código criado! Toque em "Mostrar código" para ver.'); desenhar(); } catch (x) { falha(x); }
          return;
        case 'mostrar': mostrar = true; desenhar(); { const t = box.querySelector('#rc-codigo'); if (t) t.focus(); } return;
        case 'copiar': {
          const t = box.querySelector('#rc-codigo'); let ok = false;
          try { await navigator.clipboard.writeText(gerado.codigo); ok = true; } catch (x) { try { t.select(); ok = document.execCommand('copy'); } catch (y) {} }
          dizer(ok ? 'ok' : 'erro', ok ? '✅ Código copiado!' : 'Não consegui copiar sozinho. Selecione o texto acima e copie.'); desenhar(); return;
        }
        case 'voltar': case 'cancelar': tela = 'inicio'; mostrar = false; gerado = null; novo = null; break;
        case 'tenho': tela = 'recuperar'; break;
        case 'recuperar': {
          const entrada = box.querySelector('#rc-entrada').value; ocupado = true;
          try { const save = await lerCodigo(entrada); ocupado = false; return pedirConfirmacao(save); } catch (x) { falha(x); }
          return;
        }
        case 'continuar': return concluir(novo.save);
        case 'exportar': try { baixarArquivo(); dizer('ok', '✅ Arquivo gerado. Guarde-o em um local seguro.'); } catch (x) { dizer('erro', 'Não foi possível gerar o arquivo.'); } break;
        case 'importar': box.querySelector('#rc-arq').click(); return;
      }
      desenhar();
    };
    box.onchange = e => {
      if (e.target.id !== 'rc-arq' || !e.target.files || !e.target.files[0]) return;
      const fr = new FileReader();
      fr.onload = () => { try { pedirConfirmacao(lerArquivo(String(fr.result))); } catch (x) { falha(x); } };
      fr.onerror = () => falha(erro('Não foi possível ler o arquivo.'));
      fr.readAsText(e.target.files[0]);
    };
    desenhar();
  };
  // Para testes e ferramentas: funções puras do sistema de recuperação
  Perfil.recuperacao = { gerarCodigo, lerCodigo, lerArquivo, montarSave, validar, temDados, aplicar, MIGRACOES, SEM_PROGRESSO, VERSAO };
})();
