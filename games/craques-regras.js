/* wow.games: REGRAS do Leilão dos Craques (sem interface e sem desenho).
   Mercado da Copa das Lendas, formações e compatibilidade de posições, escalação automática, sorteio da copa,
   leilão entre dois jogadores e utilitários de sorteio com semente. Tudo trabalha com objetos simples (JSON),
   para poder ser salvo em wowgames.craques.v1 e testado fora do navegador. */
(function () {
  const D = WowGames.CraquesDados || { ATLETAS: [], TIMES: [] };
  const ORCAMENTO = 110, MIN_ELENCO = 11, MAX_ELENCO = 16;

  /* ---------- Sorteio com semente (mesma semente = mesmo resultado) ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const novaSemente = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return Math.floor(Math.random() * 4294967296); } };
  function embaralhar(v, r) { const a = v.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- Atletas ---------- */
  const PORID = {};
  D.ATLETAS.forEach(a => { PORID[a.id] = a; });
  D.TIMES.forEach(t => t.reservas.forEach(r => { if (typeof r === 'object') PORID[r.id] = r; }));
  const atleta = id => PORID[id] || null;
  const POS_NOME = { GOL: 'Goleiro', ZAG: 'Zagueiro', LAT: 'Lateral', VOL: 'Volante', MEI: 'Meia', PON: 'Ponta', ATA: 'Atacante' };
  const SETOR = { GOL: 'gol', ZAG: 'def', LAT: 'def', VOL: 'mei', MEI: 'mei', PON: 'ata', ATA: 'ata' };

  /* ---------- Formações: x = 0 (próprio gol) a 1 (gol adversário); y = 0 a 1 (largura do campo) ---------- */
  const FORMACOES = {
    '4-3-3': [['GOL', .04, .5], ['LAT', .25, .12], ['ZAG', .2, .37], ['ZAG', .2, .63], ['LAT', .25, .88], ['VOL', .36, .5], ['MEI', .47, .28], ['MEI', .47, .72], ['PON', .64, .14], ['ATA', .68, .5], ['PON', .64, .86]],
    '4-4-2': [['GOL', .04, .5], ['LAT', .25, .12], ['ZAG', .2, .37], ['ZAG', .2, .63], ['LAT', .25, .88], ['PON', .46, .13], ['VOL', .4, .4], ['MEI', .43, .6], ['PON', .46, .87], ['ATA', .66, .38], ['ATA', .66, .62]],
    '3-5-2': [['GOL', .04, .5], ['ZAG', .2, .25], ['ZAG', .18, .5], ['ZAG', .2, .75], ['LAT', .42, .09], ['VOL', .36, .5], ['MEI', .47, .32], ['MEI', .47, .68], ['LAT', .42, .91], ['ATA', .66, .38], ['ATA', .66, .62]],
    '4-2-3-1': [['GOL', .04, .5], ['LAT', .25, .12], ['ZAG', .2, .37], ['ZAG', .2, .63], ['LAT', .25, .88], ['VOL', .35, .38], ['VOL', .35, .62], ['PON', .56, .15], ['MEI', .54, .5], ['PON', .56, .85], ['ATA', .7, .5]],
    '5-3-2': [['GOL', .04, .5], ['LAT', .28, .08], ['ZAG', .19, .3], ['ZAG', .17, .5], ['ZAG', .19, .7], ['LAT', .28, .92], ['VOL', .38, .5], ['MEI', .46, .3], ['MEI', .46, .7], ['ATA', .64, .4], ['ATA', .64, .6]]
  };
  const ESTILOS = {
    equilibrado: { nome: 'Equilibrado', desc: 'Sem exageros: ataca e defende na medida.', passe: 0, chute: 0, linha: 0, pressao: 1, avanco: 0 },
    posse: { nome: 'Posse de bola', desc: 'Troca passes curtos e espera a brecha.', passe: .25, chute: -.12, linha: .02, pressao: 1, avanco: -.1 },
    contra: { nome: 'Contra-ataque', desc: 'Recua e sai rápido em passes longos.', passe: -.05, chute: .05, linha: -.06, pressao: 1, avanco: .3 },
    pressao: { nome: 'Pressão alta', desc: 'Marca no campo adversário, mas cansa mais.', passe: 0, chute: .02, linha: .06, pressao: 2, avanco: .05 },
    defensivo: { nome: 'Retranca', desc: 'Linhas baixas e compactas; arrisca pouco.', passe: .05, chute: -.08, linha: -.08, pressao: 1, avanco: -.15 },
    ofensivo: { nome: 'Ofensivo', desc: 'Muita gente na frente e chutes de longe.', passe: -.05, chute: .18, linha: .05, pressao: 1, avanco: .15 }
  };

  /* ---------- Compatibilidade de posição (fator aplicado aos atributos do atleta naquele espaço) ---------- */
  const VIZINHAS = { 'ZAG-LAT': .85, 'ZAG-VOL': .85, 'LAT-VOL': .8, 'LAT-PON': .85, 'LAT-MEI': .75, 'VOL-MEI': .88, 'MEI-PON': .88, 'MEI-ATA': .85, 'PON-ATA': .88, 'VOL-PON': .72, 'VOL-ATA': .7 };
  function compat(a, posEspaco) {
    if (!a) return 0;
    if (a.pos === posEspaco) return 1;
    if ((a.sec || []).includes(posEspaco)) return .95;
    if (a.pos === 'GOL' || posEspaco === 'GOL') return .35;
    return Math.max(...[a.pos].concat(a.sec || []).map(p => VIZINHAS[p + '-' + posEspaco] || VIZINHAS[posEspaco + '-' + p] || .65));
  }
  const nivelCompat = f => f >= 1 ? 'ok' : f >= .9 ? 'sec' : f >= .8 ? 'adapt' : 'ruim';

  /* Escalação automática: preenche os 11 espaços da formação com os melhores atletas compatíveis (com troca de pares para melhorar). */
  function escalarAuto(ids, formacao) {
    const slots = FORMACOES[formacao], lista = ids.map(atleta).filter(Boolean);
    const out = new Array(11).fill(null), usados = new Set();
    const ordem = slots.map((s, i) => i).sort((i, j) => (slots[i][0] === 'GOL' ? -1 : 0) - (slots[j][0] === 'GOL' ? -1 : 0) ||
      lista.filter(a => compat(a, slots[i][0]) >= .95).length - lista.filter(a => compat(a, slots[j][0]) >= .95).length);
    for (const i of ordem) {
      let melhor = null, mv = -1;
      for (const a of lista) { if (usados.has(a.id)) continue; const v = a.nota * compat(a, slots[i][0]); if (v > mv) { mv = v; melhor = a; } }
      if (melhor) { out[i] = melhor.id; usados.add(melhor.id); }
    }
    const val = (id, i) => id ? atleta(id).nota * compat(atleta(id), slots[i][0]) : 0;
    for (let volta = 0; volta < 3; volta++) {                          // melhora com trocas entre titulares e com reservas
      for (let i = 0; i < 11; i++) for (let j = i + 1; j < 11; j++) {
        if (val(out[j], i) + val(out[i], j) > val(out[i], i) + val(out[j], j) + .01) [out[i], out[j]] = [out[j], out[i]];
      }
      for (let i = 0; i < 11; i++) for (const a of lista) {
        if (out.includes(a.id)) continue;
        if (val(a.id, i) > val(out[i], i) + .01) out[i] = a.id;
      }
    }
    return out;
  }
  function analisar(titulares, formacao) {
    const slots = FORMACOES[formacao]; let soma = 0, n = 0; const avisos = [];
    const vistos = new Set();
    titulares.forEach((id, i) => {
      const a = atleta(id), p = slots[i][0];
      if (!a) { avisos.push({ i, tipo: 'vazio', txt: `${POS_NOME[p]} vazio` }); return; }
      if (vistos.has(id)) avisos.push({ i, tipo: 'repetido', txt: `${a.nome} está em dois espaços` }); vistos.add(id);
      const f = compat(a, p); soma += a.nota * f; n++;
      if (f < .9) avisos.push({ i, tipo: 'fora', txt: `${a.nome} (${a.pos}) improvisado como ${POS_NOME[p].toLowerCase()} (${Math.round(f * 100)}%)` });
    });
    const temGoleiro = titulares.some((id, i) => slots[i][0] === 'GOL' && atleta(id) && atleta(id).pos === 'GOL');
    if (!temGoleiro && titulares[0]) avisos.push({ i: 0, tipo: 'goleiro', txt: 'Sem goleiro de verdade no gol: a defesa vai sofrer muito.' });
    return { nota: n ? Math.round(soma / 11 * 10) / 10 : 0, completa: n === 11 && !avisos.some(a => a.tipo === 'repetido'), avisos };
  }

  /* ---------- Mercado da Copa das Lendas ---------- */
  function novaCampanha() {
    return { versao: 1, id: novaSemente().toString(36), criada: new Date().toISOString(), etapa: 'mercado', orcamento: ORCAMENTO,
      elenco: [], formacao: '4-3-3', estilo: 'equilibrado', titulares: new Array(11).fill(null), copa: null, partida: null, enviados: {} };
  }
  function podeComprar(c, id) {
    const a = atleta(id);
    if (!a || !D.ATLETAS.includes(a)) return { ok: false, motivo: 'Atleta não encontrado.' };
    if (c.etapa !== 'mercado') return { ok: false, motivo: 'O mercado fecha quando a copa começa.' };
    if (c.elenco.includes(id)) return { ok: false, motivo: 'Este atleta já está no seu elenco.' };
    if (c.elenco.length >= MAX_ELENCO) return { ok: false, motivo: `Elenco cheio (máximo ${MAX_ELENCO}).` };
    if (a.preco > c.orcamento) return { ok: false, motivo: `Faltam ${a.preco - c.orcamento} para contratar.` };
    return { ok: true };
  }
  function comprar(c, id) {
    const v = podeComprar(c, id); if (!v.ok) return v;
    c.orcamento -= atleta(id).preco; c.elenco.push(id);
    const vaga = c.titulares.findIndex((t, i) => !t && compat(atleta(id), FORMACOES[c.formacao][i][0]) >= .95);
    if (vaga >= 0) c.titulares[vaga] = id;
    return { ok: true };
  }
  function dispensar(c, id) {
    if (c.etapa !== 'mercado' || !c.elenco.includes(id)) return { ok: false, motivo: 'Não é possível dispensar agora.' };
    c.elenco = c.elenco.filter(x => x !== id); c.orcamento += atleta(id).preco;
    c.titulares = c.titulares.map(t => t === id ? null : t);
    return { ok: true };
  }

  /* ---------- Equipes históricas e sorteio da copa ---------- */
  const forcaTime = t => t.titulares.reduce((s, id) => s + atleta(id).nota, 0) / 11;
  const idsDoTime = t => new Set(t.titulares.concat(t.reservas.filter(r => typeof r === 'string')));
  // Monta o time de uma copa: se um titular estiver no seu elenco, entra um reserva do próprio time (ou um reserva genérico).
  function resolverTime(t, proibidos) {
    const reservas = t.reservas.map(r => typeof r === 'string' ? atleta(r) : r).filter(r => r && !proibidos.has(r.id));
    const tit = t.titulares.slice(), subs = [];
    tit.forEach((id, i) => {
      if (!proibidos.has(id)) return;
      const sai = atleta(id), setor = SETOR[sai.pos];
      let k = reservas.findIndex(r => r.pos === sai.pos); if (k < 0) k = reservas.findIndex(r => SETOR[r.pos] === setor); if (k < 0) k = reservas.length ? 0 : -1;
      const entra = k >= 0 ? reservas.splice(k, 1)[0] : { id: `${t.id}g${i}`, nome: `Reserva do ${t.nome}`, pos: sai.pos, sec: [], nota: Math.max(70, sai.nota - 10), atr: escalar(sai.atr, .88), epoca: 'historico', reserva: true };
      if (!PORID[entra.id]) PORID[entra.id] = entra;
      tit[i] = entra.id; subs.push({ sai: sai.nome, entra: entra.nome, extra: k < 0 ? entra : null });
    });
    return { id: t.id, nome: t.nome, formacao: t.formacao, estilo: t.estilo, cor: t.cor, cor2: t.cor2, elenco: tit, titulares: escalarAuto(tit, t.formacao), subs,
      extras: subs.filter(s => s.extra).map(s => s.extra) };
  }
  const escalar = (atr, f) => Object.fromEntries(Object.entries(atr).map(([k, v]) => [k, Math.round(v * f)]));
  function sortearCopa(seed, elencoUsuario) {
    const r = rng(seed), proibidos = new Set(elencoUsuario);
    const ord = D.TIMES.slice().sort((a, b) => forcaTime(a) - forcaTime(b)), n = ord.length, t3 = Math.floor(n / 3);
    const faixas = [ord.slice(0, t3), ord.slice(t3, n - t3), ord.slice(n - t3)], quer = [2, 3, 2];   // acessíveis, médios, difíceis
    let escolhidos = null;
    for (let tent = 0; tent < 400 && !escolhidos; tent++) {
      const lista = [], usados = new Set();
      let ok = true;
      faixas.forEach((f, k) => {
        for (const t of embaralhar(f, r)) {
          if (lista.filter(x => x.faixa === k).length >= quer[k]) break;
          const ids = idsDoTime(t);
          if ([...ids].some(id => usados.has(id))) continue;          // um atleta não pode estar em dois times da mesma copa
          ids.forEach(id => usados.add(id)); lista.push({ t, faixa: k });
        }
        if (lista.filter(x => x.faixa === k).length < quer[k]) ok = false;
      });
      if (ok) escolhidos = lista;
    }
    if (!escolhidos) escolhidos = embaralhar(D.TIMES, r).slice(0, 7).map(t => ({ t, faixa: 1 }));   // segurança (não deve acontecer)
    const times = escolhidos.map(x => Object.assign(resolverTime(x.t, proibidos), { faixa: x.faixa }));
    const ordem = embaralhar(['voce'].concat(times.map(t => t.id)), r);   // chaveamento: 1×2, 3×4, 5×6, 7×8
    return { semente: seed, times, chave: ordem, rodadas: [[], [], []], fase: 0, eliminado: false, campeao: false };
  }
  const FASES = ['Quartas de final', 'Semifinal', 'Final'];
  // Confrontos de uma fase, a partir da chave e dos vencedores da fase anterior
  function confrontos(copa, fase) {
    let vivos = copa.chave.slice();
    for (let f = 0; f < fase; f++) vivos = copa.rodadas[f].map(j => j.vencedor);
    const out = []; for (let i = 0; i < vivos.length; i += 2) out.push([vivos[i], vivos[i + 1]]);
    return out;
  }

  /* ---------- Leilão entre Amigos ---------- */
  // Fila equilibrada: goleiros, defensores, meio-campistas e atacantes suficientes para os dois montarem times.
  function filaLeilao(seed, tamanho) {
    const r = rng(seed), por = s => embaralhar(D.ATLETAS.filter(a => SETOR[a.pos] === s), r);
    const cota = { gol: 4, def: Math.round(tamanho * .3), mei: Math.round(tamanho * .28), ata: 0 };
    cota.ata = tamanho - cota.gol - cota.def - cota.mei;
    let fila = [];
    Object.keys(cota).forEach(s => { fila = fila.concat(por(s).slice(0, cota[s]).map(a => a.id)); });
    return embaralhar(fila, r);
  }
  function novoLeilao(seed, tamanho, nomes) {
    const fila = filaLeilao(seed, tamanho);
    return { versao: 1, semente: seed, etapa: 'leilao', fila, devolvidos: [], naoVendidos: [], vendidos: 0, loteN: 0,
      jog: [0, 1].map(k => ({ nome: nomes[k] || ('Jogador ' + (k + 1)), saldo: ORCAMENTO, elenco: [], formacao: '4-3-3', estilo: 'equilibrado', titulares: new Array(11).fill(null), pronto: false })),
      lote: null, historico: [], partida: null, enviados: {} };
  }
  function abrirLote(L) {
    if (L.lote || !L.fila.length) return L.lote;
    const id = L.fila.shift(), abre = L.loteN % 2;                    // quem abre alterna a cada atleta
    L.loteN++;
    L.lote = { id, lance: 0, lider: null, vez: abre, abriu: abre, passes: 0, lances: [] };
    return L.lote;
  }
  const vagasMinimas = j => Math.max(0, MIN_ELENCO - j.elenco.length);
  // Maior lance possível: guarda 1 moeda para cada vaga que ainda falta até 11 atletas (para ninguém ficar sem time).
  function maxLance(L, k) {
    const j = L.jog[k];
    if (j.elenco.length >= MAX_ELENCO) return 0;
    return Math.max(0, j.saldo - Math.max(0, vagasMinimas(j) - 1));
  }
  function validarLance(L, k, valor) {
    const lt = L.lote;
    if (!lt) return 'Não há atleta em leilão.';
    if (lt.vez !== k) return 'Não é a sua vez.';
    if (!Number.isInteger(valor)) return 'O lance precisa ser um número inteiro.';
    if (valor < 1) return 'O lance mínimo é 1.';
    if (valor <= lt.lance) return `O lance precisa ser maior que ${lt.lance}.`;
    if (L.jog[k].elenco.length >= MAX_ELENCO) return `Elenco cheio (${MAX_ELENCO} atletas).`;
    if (valor > L.jog[k].saldo) return `Saldo insuficiente: você tem ${L.jog[k].saldo}.`;
    const mx = maxLance(L, k);
    if (valor > mx) return `Lance máximo agora: ${mx}. Guarde 1 para cada vaga que ainda falta até 11 atletas.`;
    return null;
  }
  function darLance(L, k, valor) {
    const erro = validarLance(L, k, valor); if (erro) return { ok: false, erro };
    const lt = L.lote; lt.lance = valor; lt.lider = k; lt.vez = 1 - k; lt.passes = 0;
    lt.lances.push({ k, valor }); L.historico.push({ tipo: 'lance', k, id: lt.id, valor });
    return { ok: true };
  }
  function desistir(L, k) {
    const lt = L.lote; if (!lt || lt.vez !== k) return { ok: false, erro: 'Não é a sua vez.' };
    if (lt.lider !== null) {                                            // quem desistiu deixa o outro levar pelo último lance
      const v = lt.lider, j = L.jog[v];
      if (lt.lance > j.saldo) return { ok: false, erro: 'Saldo do vencedor inválido.' };   // nunca acontece: o lance já foi validado
      j.saldo -= lt.lance; j.elenco.push(lt.id); L.vendidos++;
      L.historico.push({ tipo: 'compra', k: v, id: lt.id, valor: lt.lance }); L.lote = null;
      const vaga = j.titulares.findIndex((t, i) => !t && compat(atleta(lt.id), FORMACOES[j.formacao][i][0]) >= .95); if (vaga >= 0) j.titulares[vaga] = lt.id;
      return { ok: true, compra: { k: v, id: lt.id, valor: lt.lance } };
    }
    lt.passes++; L.historico.push({ tipo: 'passou', k, id: lt.id });
    if (lt.passes >= 2) {                                               // os dois passaram: ninguém compra
      if (!L.devolvidos.includes(lt.id)) { L.devolvidos.push(lt.id); L.fila.push(lt.id); L.historico.push({ tipo: 'fimdafila', id: lt.id }); }
      else { L.naoVendidos.push(lt.id); L.historico.push({ tipo: 'semcomprador', id: lt.id }); }
      L.lote = null; return { ok: true, semComprador: true };
    }
    lt.vez = 1 - k; return { ok: true };
  }
  const podeEncerrar = L => !L.lote && L.jog.every(j => j.elenco.length >= MIN_ELENCO);
  // Se a fila acabou e alguém tem menos de 11, completa com juvenis (nota 62, custo 0) para não travar a partida.
  function completarComJuvenis(L) {
    L.jog.forEach((j, k) => {
      let n = 0; const posicoes = ['GOL', 'ZAG', 'ZAG', 'LAT', 'LAT', 'VOL', 'MEI', 'MEI', 'PON', 'ATA', 'ATA'];
      while (j.elenco.length < MIN_ELENCO) {
        const precisa = posicoes.find(p => !j.elenco.some(id => atleta(id) && atleta(id).pos === p)) || 'MEI';
        const id = `juvenil${k}${n++}`;
        PORID[id] = { id, nome: `Juvenil ${n} (${j.nome})`, pos: precisa, sec: [], nota: 62, epoca: 'atual', reserva: true,
          atr: precisa === 'GOL' ? { vel: 40, pas: 45, chu: 25, def: 30, con: 40, gol: 62 } : { vel: 62, pas: 58, chu: 55, def: 55, con: 58, gol: 8 } };
        (L.juvenis = L.juvenis || {})[id] = PORID[id];
        j.elenco.push(id);
      }
    });
  }
  function restaurarJuvenis(L) { if (L && L.juvenis) Object.values(L.juvenis).forEach(a => { PORID[a.id] = a; }); }
  function restaurarExtras(copa) { if (copa) copa.times.forEach(t => (t.extras || []).forEach(a => { PORID[a.id] = a; })); }

  WowGames.CraquesRegras = { ORCAMENTO, MIN_ELENCO, MAX_ELENCO, FORMACOES, ESTILOS, POS_NOME, SETOR, FASES,
    rng, novaSemente, embaralhar, atleta, compat, nivelCompat, escalarAuto, analisar, novaCampanha, podeComprar, comprar, dispensar,
    forcaTime, sortearCopa, confrontos, filaLeilao, novoLeilao, abrirLote, maxLance, validarLance, darLance, desistir, podeEncerrar,
    completarComJuvenis, restaurarJuvenis, restaurarExtras, vagasMinimas };
})();
