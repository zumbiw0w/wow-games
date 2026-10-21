/* Jogo 11: wow.elements (Laboratório de Elementos): sandbox 2D de partículas, materiais e reações.
   O arquivo tem 3 camadas independentes:
     1) MOTOR: a simulação (grade com arrays tipados, sem nenhuma tela). Exposto em WowGames.ElementosMotor para poder ser testado sozinho.
     2) ARMAZENAMENTO: mundos salvos num formato versionado e comprimido, numa chave exclusiva do localStorage.
     3) INTERFACE: canvas, controles, painéis de mundos e modelos, e a ligação com o perfil (XP e conquistas).
   Para criar um material novo: acrescente uma linha em MATERIAIS e, se ele tiver comportamento próprio, uma função no passo() do motor. */
(function () {
  'use strict';

  /* ================================================================== CONFIGURAÇÃO */
  const GRADE_W = 240, GRADE_H = 135;                    // tamanho lógico do mundo (o canvas é escalado por CSS, sempre em 16:9)
  const PASSOS_POR_SEG = 30;                             // velocidade 1x da simulação
  const VELOCIDADES = [0.5, 1, 2, 3];                    // multiplicadores disponíveis (limitados: nunca aceleram sem controle)
  const MAX_PASSOS_QUADRO = 4;                           // no máximo 4 passos por quadro, mesmo se a aba ficar lenta
  const PINCEIS = [{ nome: 'Fino', lado: 1, r: 0 }, { nome: 'Médio', lado: 3, r: 1 }, { nome: 'Grande', lado: 7, r: 3 }, { nome: 'Enorme', lado: 11, r: 5 }];
  const MAX_DESFAZER = 15;                               // cada ponto de desfazer guarda 2 arrays de ~32 KB
  const AUTOSAVE_MS = 2500;                              // espera após a última alteração antes de salvar automaticamente
  const ID_JOGO = 'elementos';
  const CHAVE = 'wowgames.elementos.v1';                 // chave exclusiva (as outras chaves do site não são tocadas)
  const VERSAO = 1, SLOTS = 5, NOME_MAX = 24, MAX_STORE = 2000000;   // 2 milhões de caracteres (~4 MB em UTF-16): abaixo da cota usual de 5 MB do localStorage, que também é dividida com o resto do site

  /* Parâmetros das regras. Probabilidades são "por passo da simulação"; [a, b] sorteia um valor inteiro entre a e b. */
  const R = {
    vidaFogoLivre: [24, 42], vidaFumaca: [70, 130], vidaVapor: [60, 120],
    apagar: 0.6, aguaFerve: 0.35,                                      // água perto do fogo: apaga o fogo (vira vapor) e às vezes ferve
    acenderMadeira: 0.05, atrasoMadeira: [18, 40], vidaFogoMadeira: [70, 130],   // madeira pega fogo depois de um atraso e queima por muito tempo
    acenderOleo: 0.25, vidaFogoOleo: [28, 52],
    acenderPlanta: 0.10, vidaFogoPlanta: [20, 36],
    fumacaFogo: 0.035, chamaProp: 0.12, chamaMinPai: 16, vidaChama: [10, 18],   // chamas novas sempre vivem menos que o fogo-pai: o espalhamento no ar para sozinho
    lavaAgua: 0.5, lavaAguaVapor: 0.5, lavaAcende: 0.08, lavaFogo: 0.003, lavaEsfria: 0.0008, lavaVisc: 0.3,
    terraAbsorve: 0.05, terraUmida: 120, terraSeca: 0.02, terraEspalhaMin: 110, terraEspalha: 0.01, terraEspalhaPerda: 50,
    germina: 0.04, germinaCusto: 60, crescimento: [6, 14], plantaCresce: 0.05, plantaDesenhada: 3,
    gasSobe: 0.85
  };

  /* ================================================================== MATERIAIS (definições centrais) */
  const ID = { AREIA: 1, AGUA: 2, PEDRA: 3, MADEIRA: 4, FOGO: 5, FUMACA: 6, OLEO: 7, VAPOR: 8, TERRA: 9, SEMENTE: 10, PLANTA: 11, LAVA: 12 };
  // dens: quem é mais denso afunda (e empurra) os mais leves. mover: tipo de comportamento. pincel: chance de cada célula do pincel ser preenchida.
  const MATERIAIS = [
    { id: 1, chave: 'areia', nome: 'Areia', estado: 'Pó', cor: '#e3c46b', dens: 5, mover: 'po', pincel: 0.65, inflamavel: false,
      desc: 'Grãos que caem e formam montes.', regras: ['Cai pela gravidade e desliza pelas laterais, formando montes.', 'Afunda na água e no óleo.', 'Não queima.'] },
    { id: 2, chave: 'agua', nome: 'Água', estado: 'Líquido', cor: '#3b82f6', dens: 2, mover: 'liquido', disp: 4, visc: 1, pincel: 0.6, inflamavel: false,
      desc: 'Flui e se espalha pelos lados.', regras: ['Cai e se espalha lateralmente até nivelar.', 'Apaga o fogo e vira vapor ao encostar nele.', 'Transforma lava em pedra.', 'A terra seca absorve um pouco de água e fica úmida.'] },
    { id: 3, chave: 'pedra', nome: 'Pedra', estado: 'Sólido', cor: '#8d90a0', dens: 9, mover: 'fixo', pincel: 1, inflamavel: false,
      desc: 'Bloco firme que não se move.', regras: ['É sólida e não se move.', 'Não queima. Também nasce quando a lava esfria.'] },
    { id: 4, chave: 'madeira', nome: 'Madeira', estado: 'Sólido', cor: '#b07a3f', dens: 9, mover: 'madeira', pincel: 1, inflamavel: true,
      desc: 'Sólida e combustível.', regras: ['É sólida e não se move.', 'Perto do fogo ou da lava, esquenta por um tempo e então pega fogo.', 'Queima por bastante tempo e solta fumaça.'] },
    { id: 5, chave: 'fogo', nome: 'Fogo', estado: 'Fogo', cor: '#ff8a1f', dens: 1, mover: 'fogo', pincel: 0.4, inflamavel: false,
      desc: 'Chama de duração limitada.', regras: ['Dura pouco se não tiver combustível por perto.', 'Acende madeira, óleo e plantas vizinhas.', 'Solta fumaça e pequenas chamas.', 'Água o apaga e gera vapor.'] },
    { id: 6, chave: 'fumaca', nome: 'Fumaça', estado: 'Gás', cor: '#9a9cab', dens: 0.2, mover: 'gas', pincel: 0.4, inflamavel: false,
      desc: 'Sobe e some aos poucos.', regras: ['Sobe e se dissipa gradualmente.', 'Escapa pelo topo do mundo.'] },
    { id: 7, chave: 'oleo', nome: 'Óleo', estado: 'Líquido', cor: '#6b5a22', dens: 1.2, mover: 'liquido', disp: 2, visc: 1, pincel: 0.6, inflamavel: true,
      desc: 'Líquido leve e inflamável.', regras: ['Flui, mas se espalha menos que a água.', 'Flutua sobre a água.', 'Pega fogo rápido e sustenta o fogo.'] },
    { id: 8, chave: 'vapor', nome: 'Vapor', estado: 'Gás', cor: '#d7ecf7', dens: 0.1, mover: 'gas', pincel: 0.4, inflamavel: false,
      desc: 'Gás quente que sobe e some.', regras: ['Sobe, inclusive através da água.', 'Se dissipa gradualmente.'] },
    { id: 9, chave: 'terra', nome: 'Terra', estado: 'Sólido', cor: '#5a3a24', dens: 9, mover: 'terra', pincel: 1, inflamavel: false,
      desc: 'Terreno firme que pode ficar úmido.', regras: ['É sólida e não se move.', 'Absorve água vizinha e fica úmida por um tempo.', 'Sementes só germinam ao lado de terra úmida.'] },
    { id: 10, chave: 'semente', nome: 'Semente', estado: 'Pó', cor: '#c5d86d', dens: 4, mover: 'semente', pincel: 0.35, inflamavel: false,
      desc: 'Cai como areia e pode germinar.', regras: ['Cai e desliza como areia.', 'Ao lado de terra úmida, pode germinar e virar planta.'] },
    { id: 11, chave: 'planta', nome: 'Planta', estado: 'Sólido', cor: '#2fb44a', dens: 9, mover: 'planta', pincel: 0.8, inflamavel: true,
      desc: 'Cresce devagar e queima.', regras: ['Cresce aos poucos para cima (até um limite).', 'Pega fogo com facilidade.'] },
    { id: 12, chave: 'lava', nome: 'Lava', estado: 'Líquido', cor: '#ff4d1a', dens: 4, mover: 'liquido', disp: 1, visc: R.lavaVisc, pincel: 0.6, inflamavel: false,
      desc: 'Líquido muito quente e lento.', regras: ['Flui devagar.', 'Acende madeira, óleo e plantas encostados nela.', 'Ao tocar a água vira pedra e gera vapor.', 'Esfria e vira pedra lentamente no ar.'] }
  ];
  const DEF = [null]; MATERIAIS.forEach(m => { DEF[m.id] = m; });
  const N_TIPOS = MATERIAIS.length + 1;

  // Reações que o jogador pode descobrir (cada tipo conta uma vez, não importa quantas vezes aconteça)
  const REACOES = [
    { id: 'apagar', nome: 'Água apaga o fogo', desc: 'A água apagou o fogo e gerou vapor.' },
    { id: 'madeira', nome: 'Madeira pega fogo', desc: 'O fogo incendiou a madeira.' },
    { id: 'oleo', nome: 'Óleo em chamas', desc: 'O óleo pegou fogo.' },
    { id: 'planta', nome: 'Planta queima', desc: 'O fogo queimou uma planta.' },
    { id: 'germinar', nome: 'Semente germina', desc: 'Uma semente virou planta na terra úmida.' },
    { id: 'solidificar', nome: 'Lava vira pedra na água', desc: 'A lava encontrou a água, virou pedra e gerou vapor.' },
    { id: 'umedecer', nome: 'Terra absorve água', desc: 'A terra absorveu água e ficou úmida.' },
    { id: 'lava_acende', nome: 'Lava acende combustível', desc: 'A lava incendiou algo inflamável.' },
    { id: 'esfriar', nome: 'Lava esfria', desc: 'A lava esfriou e virou pedra.' }
  ];
  const RX = {}; REACOES.forEach((r, i) => { RX[r.id] = i; });

  /* ================================================================== MOTOR */
  function criarMotor(w, h, semente) {
    const n = w * h;
    const t = new Uint8Array(n), v = new Uint8Array(n), mv = new Uint8Array(n);   // tipo, estado auxiliar (vida/contagem), marca "já processado neste passo"
    let tick = 0, rs = (semente >>> 0) || 2463534242;
    const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
    const rint = r => r[0] + Math.floor(rnd() * (r[1] - r[0] + 1));
    const contagem = new Uint32Array(REACOES.length), novas = [];
    const reagir = k => { if (++contagem[k] === 1) novas.push(k); };

    const FLUIDO = new Uint8Array(N_TIPOS), DENS = new Float32Array(N_TIPOS);
    MATERIAIS.forEach(m => { DENS[m.id] = m.dens; FLUIDO[m.id] = (m.mover === 'liquido' || m.mover === 'gas') ? 1 : 0; });
    const cabe = (c, d) => d === 0 || (FLUIDO[d] === 1 && DENS[d] < DENS[c]);          // c pode ocupar o lugar de d (vazio ou fluido mais leve)
    const podeSubir = (c, d) => d === 0 || (FLUIDO[d] === 1 && DENS[d] > DENS[c]);

    const nb = new Int32Array(4);
    function viz(i, x, y) { let k = 0; if (y > 0) nb[k++] = i - w; if (y < h - 1) nb[k++] = i + w; if (x > 0) nb[k++] = i - 1; if (x < w - 1) nb[k++] = i + 1; return k; }
    function trocar(i, j) { const a = t[i], b = v[i]; t[i] = t[j]; v[i] = v[j]; t[j] = a; v[j] = b; mv[i] = tick; mv[j] = tick; }
    function criar(j, tipo, vida) { t[j] = tipo; v[j] = vida; mv[j] = tick; }

    function po(i, x, y) {                                   // areia e semente: cai e desliza na diagonal
      if (y >= h - 1) return false;
      const c = t[i], b = i + w;
      if (cabe(c, t[b])) { trocar(i, b); return true; }
      const a = rnd() < 0.5 ? -1 : 1;
      if (x + a >= 0 && x + a < w && cabe(c, t[b + a])) { trocar(i, b + a); return true; }
      if (x - a >= 0 && x - a < w && cabe(c, t[b - a])) { trocar(i, b - a); return true; }
      return false;
    }
    function liquido(i, x, y, c) {
      const D = DEF[c];
      if (D.visc < 1 && rnd() > D.visc) return;              // lava: só age de vez em quando (mais lenta)
      if (y < h - 1) {
        const b = i + w;
        if (cabe(c, t[b])) { trocar(i, b); return; }
        const a = rnd() < 0.5 ? -1 : 1;
        if (x + a >= 0 && x + a < w && cabe(c, t[b + a])) { trocar(i, b + a); return; }
        if (x - a >= 0 && x - a < w && cabe(c, t[b - a])) { trocar(i, b - a); return; }
      }
      const s = rnd() < 0.5 ? -1 : 1;                        // espalha pelos lados, até D.disp casas, para o lado sorteado primeiro
      for (let q = 0; q < 2; q++) {
        const dir = q ? -s : s; let alvo = -1;
        for (let k = 1; k <= D.disp; k++) { const xx = x + dir * k; if (xx < 0 || xx >= w) break; if (t[i + dir * k] === 0) alvo = i + dir * k; else break; }
        if (alvo >= 0) { trocar(i, alvo); return; }
      }
    }
    function gas(i, x, y, c) {
      if (v[i] <= 1 || y === 0) { t[i] = 0; v[i] = 0; return; }   // a vida acabou, ou escapou pelo topo
      v[i]--;
      const a = rnd() < 0.5 ? -1 : 1;
      if (rnd() < R.gasSobe) {
        const up = i - w;
        if (podeSubir(c, t[up])) { trocar(i, up); return; }
        if (x + a >= 0 && x + a < w && podeSubir(c, t[up + a])) { trocar(i, up + a); return; }
        if (x - a >= 0 && x - a < w && podeSubir(c, t[up - a])) { trocar(i, up - a); return; }
      }
      if (x + a >= 0 && x + a < w && t[i + a] === 0) trocar(i, i + a);   // balança de lado
    }
    function fogo(i, x, y) {
      const vida = v[i];
      if (vida <= 1) { t[i] = 0; v[i] = 0; return; }         // o fogo sempre acaba: a vida só diminui
      v[i] = vida - 1;
      const k = viz(i, x, y);
      for (let q = 0; q < k; q++) {
        const j = nb[q], tj = t[j];
        if (tj === ID.AGUA) {
          if (rnd() < R.apagar) {
            criar(i, ID.VAPOR, rint(R.vidaVapor));
            if (rnd() < R.aguaFerve) criar(j, ID.VAPOR, rint(R.vidaVapor));
            reagir(RX.apagar); return;
          }
        } else if (tj === ID.MADEIRA) { if (v[j] === 0 && rnd() < R.acenderMadeira) v[j] = rint(R.atrasoMadeira); }   // só começa a esquentar: pega fogo depois do atraso
        else if (tj === ID.OLEO) { if (rnd() < R.acenderOleo) { criar(j, ID.FOGO, rint(R.vidaFogoOleo)); reagir(RX.oleo); } }
        else if (tj === ID.PLANTA) { if (rnd() < R.acenderPlanta) { criar(j, ID.FOGO, rint(R.vidaFogoPlanta)); reagir(RX.planta); } }
      }
      if (y > 0 && t[i - w] === 0) {
        if (rnd() < R.fumacaFogo) criar(i - w, ID.FUMACA, rint(R.vidaFumaca));
        else if (vida > R.chamaMinPai && rnd() < R.chamaProp) criar(i - w, ID.FOGO, rint(R.vidaChama));
      }
    }
    function madeira(i) {                                    // contagem do atraso: 0 = intacta; >0 = esquentando
      if (v[i] > 0 && --v[i] === 0) { criar(i, ID.FOGO, rint(R.vidaFogoMadeira)); reagir(RX.madeira); }
    }
    function terra(i, x, y) {
      const vv = v[i];
      if (vv > 0 && rnd() < R.terraSeca) v[i] = vv - 1;
      const k = viz(i, x, y);
      if (vv === 0) {                                        // terra seca pode absorver uma água vizinha (uma vez por ciclo)
        for (let q = 0; q < k; q++) { const j = nb[q]; if (t[j] === ID.AGUA && rnd() < R.terraAbsorve) { t[j] = 0; v[j] = 0; v[i] = R.terraUmida; reagir(RX.umedecer); break; } }
      } else if (vv >= R.terraEspalhaMin && rnd() < R.terraEspalha && k > 0) {   // a umidade se espalha pouco: cada salto perde força
        const j = nb[Math.floor(rnd() * k)];
        if (t[j] === ID.TERRA && v[j] === 0) v[j] = vv - R.terraEspalhaPerda;
      }
    }
    function semente(i, x, y) {
      const k = viz(i, x, y);
      for (let q = 0; q < k; q++) {
        const j = nb[q];
        if (t[j] === ID.TERRA && v[j] > 0) {
          if (rnd() < R.germina) { criar(i, ID.PLANTA, rint(R.crescimento)); v[j] = v[j] > R.germinaCusto ? v[j] - R.germinaCusto : 0; reagir(RX.germinar); }
          return;
        }
      }
    }
    function planta(i, x, y) {                               // v = quanto ainda pode crescer; cada nova célula tem v-1, então o crescimento sempre termina
      if (v[i] === 0 || rnd() >= R.plantaCresce) return;
      if (y === 0) { v[i] = 0; return; }
      const a = rnd() < 0.5 ? -1 : 1, up = i - w;
      const ordem = rnd() < 0.6 ? [0, a, -a] : [a, 0, -a];
      for (const d of ordem) {
        if (x + d < 0 || x + d >= w) continue;
        const j = up + d;
        if (t[j] === 0) { criar(j, ID.PLANTA, v[i] - 1); v[i] = 0; return; }
      }
    }
    function lava(i, x, y) {
      const k = viz(i, x, y);
      for (let q = 0; q < k; q++) {
        const j = nb[q], tj = t[j];
        if (tj === ID.AGUA) {
          if (rnd() < R.lavaAgua) {
            criar(i, ID.PEDRA, 0);
            if (rnd() < R.lavaAguaVapor) criar(j, ID.VAPOR, rint(R.vidaVapor));
            reagir(RX.solidificar); return;
          }
        } else if (tj === ID.MADEIRA) { if (v[j] === 0 && rnd() < R.lavaAcende) { v[j] = rint(R.atrasoMadeira); reagir(RX.lava_acende); } }
        else if (tj === ID.OLEO) { if (rnd() < R.lavaAcende) { criar(j, ID.FOGO, rint(R.vidaFogoOleo)); reagir(RX.lava_acende); } }
        else if (tj === ID.PLANTA) { if (rnd() < R.lavaAcende) { criar(j, ID.FOGO, rint(R.vidaFogoPlanta)); reagir(RX.lava_acende); } }
      }
      if (y > 0 && t[i - w] === 0) {                         // superfície exposta ao ar: às vezes solta fogo, e esfria devagar
        if (rnd() < R.lavaFogo) criar(i - w, ID.FOGO, rint(R.vidaChama));
        else if (rnd() < R.lavaEsfria) { criar(i, ID.PEDRA, 0); reagir(RX.esfriar); return; }
      }
      liquido(i, x, y, ID.LAVA);
    }

    // Um passo da simulação: UMA varredura de baixo para cima. A marca mv impede processar a mesma partícula duas vezes no passo,
    // e a direção horizontal alterna entre linhas e passos para não haver viés para um lado.
    function passo() {
      tick = (tick % 250) + 1; if (tick === 1) mv.fill(0);
      for (let y = h - 1; y >= 0; y--) {
        const dir = ((y + tick) & 1) === 0, lin = y * w;
        for (let k = 0; k < w; k++) {
          const x = dir ? k : w - 1 - k, i = lin + x, c = t[i];
          if (c === 0 || mv[i] === tick) continue;
          switch (c) {
            case ID.AREIA: po(i, x, y); break;
            case ID.AGUA: case ID.OLEO: liquido(i, x, y, c); break;
            case ID.LAVA: lava(i, x, y); break;
            case ID.FOGO: fogo(i, x, y); break;
            case ID.FUMACA: case ID.VAPOR: gas(i, x, y, c); break;
            case ID.MADEIRA: madeira(i); break;
            case ID.TERRA: terra(i, x, y); break;
            case ID.SEMENTE: if (!po(i, x, y)) semente(i, x, y); break;
            case ID.PLANTA: planta(i, x, y); break;
            default: break;                                   // pedra e tipos desconhecidos: não fazem nada
          }
        }
      }
    }

    function vidaInicial(id) {
      switch (id) {
        case ID.FOGO: return rint(R.vidaFogoLivre);
        case ID.FUMACA: return rint(R.vidaFumaca);
        case ID.VAPOR: return rint(R.vidaVapor);
        case ID.PLANTA: return R.plantaDesenhada;
        default: return 0;
      }
    }
    // Pincel: id 0 = borracha. Só preenche casas vazias (nunca sobrescreve outro material). Devolve quantas células mudaram.
    function pintar(cx, cy, r, id, dens) {
      let mud = 0; const r2 = r * r + r, dd = r <= 1 ? 1 : dens;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (id === 0) { if (t[i]) { t[i] = 0; v[i] = 0; mud++; } }
        else if (t[i] === 0 && (dd >= 1 || rnd() < dd)) { t[i] = id; v[i] = vidaInicial(id); mv[i] = tick; mud++; }
      }
      return mud;
    }
    const limpar = () => { t.fill(0); v.fill(0); mv.fill(0); };
    const copiar = () => ({ t: t.slice(), v: v.slice() });
    const restaurar = s => { t.set(s.t); v.set(s.v); mv.fill(0); };
    function vazio() { for (let i = 0; i < n; i++) if (t[i]) return false; return true; }
    return { w, h, t, v, passo, pintar, limpar, copiar, restaurar, vazio, contagem, novas, vidaInicial, rnd, rint };
  }

  /* ---------- Compactação do mundo (RLE de pares tipo+estado, em base64) ---------- */
  function codificar(t, v) {
    const out = []; let i = 0; const n = t.length;
    while (i < n) { const a = t[i], b = v[i]; let r = 1; while (i + r < n && r < 255 && t[i + r] === a && v[i + r] === b) r++; out.push(r, a, b); i += r; }
    let s = ''; for (let k = 0; k < out.length; k += 8192) s += String.fromCharCode.apply(null, out.slice(k, k + 8192));
    return btoa(s);
  }
  // Valida TUDO antes de devolver (tamanho, tipos, soma das corridas). Lança Error com mensagem compreensível se algo estiver errado.
  function decodificar(d, w, h) {
    if (typeof d !== 'string') throw new Error('os dados do mundo estão ausentes');
    const n = w * h;
    if (d.length > n * 4 + 16) throw new Error('os dados do mundo são grandes demais');
    let bin; try { bin = atob(d); } catch (e) { throw new Error('os dados do mundo estão corrompidos'); }
    if (bin.length % 3 !== 0 || bin.length > n * 3) throw new Error('os dados do mundo estão corrompidos');
    const t = new Uint8Array(n), v = new Uint8Array(n); let p = 0;
    for (let k = 0; k < bin.length; k += 3) {
      const r = bin.charCodeAt(k), a = bin.charCodeAt(k + 1), b = bin.charCodeAt(k + 2);
      if (r < 1 || a >= N_TIPOS || p + r > n) throw new Error('os dados do mundo contêm valores inválidos');
      t.fill(a, p, p + r); v.fill(b, p, p + r); p += r;
    }
    if (p !== n) throw new Error('os dados do mundo estão incompletos');
    return { t, v };
  }

  /* ================================================================== ARMAZENAMENTO */
  const objeto = o => o && typeof o === 'object' && !Array.isArray(o);
  const dadosVazios = () => ({ v: VERSAO, slots: new Array(SLOTS).fill(null), auto: null, desc: { mat: [], rea: [] } });
  const Store = {
    // Lê sem NUNCA alterar o que está salvo. estado: 'vazio' | 'ok' | 'invalido' | 'versao' | 'erro'
    ler() {
      let raw;
      try { raw = localStorage.getItem(CHAVE); } catch (e) { return { estado: 'erro' }; }
      if (raw === null) return { estado: 'vazio', dados: dadosVazios() };
      let d; try { d = JSON.parse(raw); } catch (e) { return { estado: 'invalido', raw }; }
      if (!objeto(d) || !Number.isInteger(d.v) || d.v < 1) return { estado: 'invalido', raw };
      if (d.v > VERSAO) return { estado: 'versao', raw, versao: d.v };            // salvamento de uma versão futura: só leitura, preservado
      if (!Array.isArray(d.slots)) return { estado: 'invalido', raw };
      while (d.slots.length < SLOTS) d.slots.push(null);
      if (!objeto(d.desc)) d.desc = { mat: [], rea: [] };
      d.desc.mat = Array.isArray(d.desc.mat) ? d.desc.mat.filter(x => typeof x === 'string').slice(0, 50) : [];
      d.desc.rea = Array.isArray(d.desc.rea) ? d.desc.rea.filter(x => typeof x === 'string').slice(0, 50) : [];
      return { estado: 'ok', dados: d };
    },
    gravar(dados) {
      try {
        const s = JSON.stringify(dados);
        if (s.length > MAX_STORE) return { ok: false, motivo: 'tamanho' };
        localStorage.setItem(CHAVE, s);                      // se falhar, o valor anterior continua intacto
        return { ok: true, bytes: s.length };
      } catch (e) {
        const quota = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
        return { ok: false, motivo: quota ? 'espaco' : 'erro' };
      }
    }
  };
  // Confere um mundo salvo (slot ou auto) sem decodificar a grade inteira. Devolve {ok, nome, quando} ou {ok:false, erro}.
  function conferirMundo(s) {
    if (s === null || s === undefined) return { vazio: true };
    if (!objeto(s) || typeof s.d !== 'string') return { ok: false, erro: 'dados ausentes' };
    if (s.w !== GRADE_W || s.h !== GRADE_H) return { ok: false, erro: 'tamanho de mundo incompatível (' + String(s.w).slice(0, 6) + '×' + String(s.h).slice(0, 6) + ')' };
    try { decodificar(s.d, GRADE_W, GRADE_H); } catch (e) { return { ok: false, erro: e.message.replace(/^os dados do mundo /, '') }; }   // confere de verdade (barato): slot danificado já aparece como tal
    const quando = typeof s.t === 'string' && isFinite(Date.parse(s.t)) ? s.t : null;
    return { ok: true, nome: typeof s.nome === 'string' ? s.nome.slice(0, NOME_MAX) : '', quando };
  }
  const MSG_ARMAZ = {
    espaco: 'Sem espaço no navegador para salvar. Exclua um mundo salvo e tente de novo. Seus salvamentos anteriores continuam intactos.',
    tamanho: 'O espaço reservado para os mundos salvos está cheio. Exclua um mundo salvo e tente de novo. Seus salvamentos anteriores continuam intactos.',
    erro: 'Não foi possível salvar (o navegador bloqueou o armazenamento). Seus salvamentos anteriores continuam intactos.'
  };

  /* ================================================================== MODELOS PRONTOS */
  function modeloIlha(m) {
    const { w, h } = m, nivel = 88, chao = h - 8, cx = 120;
    for (let y = nivel; y < h; y++) for (let x = 0; x < w; x++) m.t[y * w + x] = ID.AGUA;                       // mar
    for (let y = h - 4; y < h; y++) for (let x = 0; x < w; x++) m.t[y * w + x] = ID.AREIA;                       // fundo de areia
    for (let x = 52; x <= 188; x++) {                                                                             // a ilha: uma cúpula de terra com praia de areia
      const u = (x - cx) / 68, alt = Math.floor(26 * (1 - u * u)); if (alt <= 0) continue;
      for (let y = nivel - alt; y < h - 4; y++) {
        const i = y * w + x, borda = Math.abs(x - cx) > 48, topo = y < nivel - alt + 3;
        m.t[i] = (borda || (topo && alt < 14)) ? ID.AREIA : ID.TERRA;
      }
    }
  }
  function modeloVulcao(m) {
    const { w, h } = m, base = h - 10;
    for (let y = base; y < h; y++) for (let x = 0; x < w; x++) m.t[y * w + x] = ID.PEDRA;                        // chão
    for (let y = 38; y < base; y++) { const meia = Math.floor((y - 38) * 0.85) + 6; for (let x = 120 - meia; x <= 120 + meia; x++) m.t[y * w + x] = ID.PEDRA; }   // cone
    for (let y = 38; y < base; y++) for (let x = 114; x <= 126; x++) m.t[y * w + x] = y >= 46 ? ID.LAVA : 0;     // chaminé com lava
    for (let y = base - 14; y < base; y++) { m.t[y * w + 10] = ID.PEDRA; m.t[y * w + 64] = ID.PEDRA; for (let x = 11; x < 64; x++) if (y >= base - 9) m.t[y * w + x] = ID.AGUA; }   // lago
    for (let y = base - 8; y < base; y++) { m.t[y * w + 190] = ID.PEDRA; m.t[y * w + 218] = ID.PEDRA; for (let x = 191; x < 218; x++) if (y >= base - 5) m.t[y * w + x] = ID.AGUA; }   // poça
  }
  function modeloJardim(m) {
    const { w, h } = m, topo = 104;
    for (let y = topo; y < h; y++) for (let x = 0; x < w; x++) m.t[y * w + x] = ID.TERRA;                        // canteiro de terra
    for (let y = topo; y < topo + 12; y++) for (let x = 18; x < 72; x++) m.t[y * w + x] = y < topo + 2 ? 0 : ID.AGUA;   // lago
    for (let y = topo; y < topo + 4; y++) for (let x = 84; x < 216; x++) m.v[y * w + x] = 90 + ((x * 7 + y * 3) % 50);    // faixa de terra já úmida
    for (let x = 90; x <= 210; x += 10) { m.t[(topo - 1) * w + x] = ID.SEMENTE; m.t[(topo - 1) * w + x + 3] = ID.SEMENTE; }   // sementes
    for (let y = topo - 10; y < topo; y++) { m.t[y * w + 6] = ID.MADEIRA; m.t[y * w + 230] = ID.MADEIRA; }     // estacas de madeira
  }
  function modeloCaixa(m) {
    const { w, h } = m;
    for (let y = h - 3; y < h; y++) for (let x = 36; x <= 203; x++) m.t[y * w + x] = ID.PEDRA;                   // fundo
    for (let y = 44; y < h; y++) for (let k = 0; k < 3; k++) { m.t[y * w + 36 + k] = ID.PEDRA; m.t[y * w + 201 + k] = ID.PEDRA; }   // paredes
    for (let y = h - 28; y < h - 3; y++) { const meia = Math.floor((y - (h - 28)) * 1.4) + 2; for (let x = 120 - meia; x <= 120 + meia; x++) m.t[y * w + x] = ID.AREIA; }   // montinho
  }
  const MODELOS = [
    { id: 'ilha', nome: 'Ilha', desc: 'Uma ilha de terra e areia cercada de água.', fazer: modeloIlha },
    { id: 'vulcao', nome: 'Vulcão', desc: 'Pedra, lava no fundo e água por perto.', fazer: modeloVulcao },
    { id: 'jardim', nome: 'Jardim', desc: 'Terra, sementes e um lago para regar.', fazer: modeloJardim },
    { id: 'caixa', nome: 'Caixa de Areia', desc: 'Paredes de pedra e espaço livre.', fazer: modeloCaixa }
  ];

  WowGames.ElementosMotor = { criar: criarMotor, codificar, decodificar, MATERIAIS, REACOES, ID, R, GRADE_W, GRADE_H, MODELOS, CHAVE };

  /* ================================================================== INTERFACE */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hora = iso => { try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // Paleta de cores: 16 tons por material (0 a 7 = normal, 8 a 15 = estados especiais). Gerada a partir de cor base.
  const BG = '#15162a';
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const misturar = (a, b, f) => a.map((x, i) => Math.round(x + (b[i] - x) * f));
  const abgr = c => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
  function montarPaleta() {
    const pal = new Uint32Array(N_TIPOS * 16), bg = hexRgb(BG);
    const claro = [255, 255, 255], escuro = [0, 0, 0];
    MATERIAIS.forEach(m => {
      const base = hexRgb(m.cor);
      for (let s = 0; s < 8; s++) {
        let c;
        if (m.id === ID.FOGO) c = hexRgb(['#a31a0a', '#cf2e0c', '#ef4a0e', '#ff6a12', '#ff8a1f', '#ffa927', '#ffc83a', '#ffe36a'][s]);
        else if (m.id === ID.LAVA) c = hexRgb(['#a3170a', '#c1200c', '#d92d10', '#ef3e14', '#ff4d1a', '#ff6a1f', '#ff8a2a', '#ffb347'][s]);
        else if (m.mover === 'gas') c = misturar(bg, base, 0.18 + 0.82 * s / 7);       // gás fica mais apagado conforme a vida acaba
        else c = s < 4 ? misturar(base, escuro, (4 - s) * 0.07) : misturar(base, claro, (s - 3) * 0.06);
        pal[m.id * 16 + s] = abgr(c);
      }
      for (let s = 0; s < 8; s++) {                                                      // estados especiais (8 a 15)
        let c = hexRgb(m.cor);
        if (m.id === ID.MADEIRA) c = misturar(hexRgb('#b3321a'), hexRgb('#ff8a1f'), s / 7);      // madeira esquentando: brasa
        else if (m.id === ID.TERRA) c = misturar(hexRgb('#2c1b10'), hexRgb('#3b2415'), s / 7);   // terra úmida: mais escura
        else if (m.id === ID.PLANTA) c = misturar(hexRgb('#7be26c'), hexRgb('#c6f58a'), s / 7);  // ponta que ainda cresce
        pal[m.id * 16 + 8 + s] = abgr(c);
      }
    });
    return pal;
  }

  function montar(el) {
    const canvas0 = document.createElement('canvas');
    if (!canvas0.getContext || !canvas0.getContext('2d')) throw new Error('Este navegador não suporta o Canvas 2D.');
    const motor = criarMotor(GRADE_W, GRADE_H, (Date.now() & 0xffffff) + 1);
    const PAL = montarPaleta(), FUNDO = abgr(hexRgb(BG)), RUIDO = new Uint8Array(GRADE_W * GRADE_H);
    for (let i = 0; i < RUIDO.length; i++) RUIDO[i] = ((i * 2654435761) >>> 13) & 7;       // textura fixa: cada célula tem sempre o mesmo tom

    let pausado = false, velIdx = 1, pincelIdx = 1, ferramenta = ID.AREIA;                  // ferramenta: id do material, 0 = borracha, -1 = inspecionar
    let sujo = false, slotAtual = null, bloqueado = null, autoTimer = 0, autoPendente = false, raf = 0, acc = 0, ultimoTs = 0, precisa = true, quadro = 0;
    let desfazerPilha = [], refazerPilha = [], traco = null, ativo = null, inspec = null, painel = null;
    let desc = { mat: [], rea: [] }, jaJogou = false, msgTimer = 0, avisoSalvo = '';

    el.innerHTML = `
      <div class="el-wrap">
        <p class="el-desc"><b>wow.elements</b>: desenhe materiais, veja as partículas se mexerem e experimente reações. Sem fases, tempo ou pontos: é só brincar.</p>
        <div class="el-barra" role="toolbar" aria-label="Controles da simulação">
          <button type="button" class="btn small" data-a="pausar" id="el-pausar" aria-pressed="false">⏸ Pausar</button>
          <button type="button" class="btn small" data-a="passo" id="el-passo" disabled>⏭ Passo</button>
          <span class="el-grupo" role="group" aria-label="Velocidade"><span class="el-rot">Velocidade</span>${VELOCIDADES.map((x, i) => `<button type="button" class="el-op" data-a="vel" data-v="${i}" aria-pressed="false">${String(x).replace('.', ',')}×</button>`).join('')}</span>
          <button type="button" class="btn small" data-a="desfazer" id="el-desfazer">↶ Desfazer</button>
          <button type="button" class="btn small" data-a="refazer" id="el-refazer">↷ Refazer</button>
          <button type="button" class="btn small stop" data-a="limpar">🗑 Limpar</button>
          <button type="button" class="btn small" data-a="painel" data-v="mundos" id="el-bt-mundos" aria-expanded="false">💾 Mundos</button>
          <button type="button" class="btn small" data-a="painel" data-v="modelos" id="el-bt-modelos" aria-expanded="false">🧪 Modelos</button>
        </div>
        <div class="el-corpo">
          <div class="el-palco"><canvas id="el-canvas" width="${GRADE_W}" height="${GRADE_H}" tabindex="0" aria-label="Área de simulação. Arraste para desenhar com o material escolhido."></canvas></div>
          <aside class="el-lateral">
            <h3 class="el-tit">Materiais</h3><div id="el-paleta" class="el-paleta"></div>
            <h3 class="el-tit">Pincel</h3><div id="el-pincel" class="el-pincel" role="group" aria-label="Tamanho do pincel"></div>
            <div id="el-info" class="el-info" aria-live="polite"></div>
          </aside>
        </div>
        <div class="el-status"><span id="el-salvo" class="el-salvo"></span><span id="el-msg" class="el-msg" role="status" aria-live="polite"></span></div>
        <section class="el-painel" id="el-p-mundos" hidden></section>
        <section class="el-painel" id="el-p-modelos" hidden></section>
        <p class="el-dica">Dica: clique com o botão direito (ou use 🔍 Inspecionar) para ver as propriedades de um ponto do mundo.</p>
      </div>`;
    const $ = s => el.querySelector(s), canvas = $('#el-canvas'), ctx = canvas.getContext('2d');
    const img = ctx.createImageData(GRADE_W, GRADE_H), buf = new Uint32Array(img.data.buffer);

    /* ---------- mensagens e indicador de salvamento ---------- */
    function msg(txt, tipo) {
      const m = $('#el-msg'); if (!m) return;
      m.textContent = txt; m.className = 'el-msg ' + (tipo || '');
      clearTimeout(msgTimer); if (txt && tipo !== 'erro') msgTimer = setTimeout(() => { m.textContent = ''; m.className = 'el-msg'; }, 6000);
    }
    function indicador() {
      const s = $('#el-salvo'); if (!s) return;
      const partes = [];
      if (bloqueado) partes.push('⚠️ Salvamento desativado: ' + bloqueado);
      else if (autoPendente) partes.push('💾 Salvando...');
      else if (avisoSalvo) partes.push(avisoSalvo);
      if (sujo) partes.push('● alterações não salvas em um mundo');
      s.textContent = partes.join(' | ');
    }

    /* ---------- descobertas e perfil (XP e conquistas passam pelo sistema existente) ---------- */
    function persistirDesc() {
      if (bloqueado) return;
      const st = Store.ler(); if (st.estado !== 'ok' && st.estado !== 'vazio') return;
      const d = st.dados;
      d.desc.mat = Array.from(new Set(d.desc.mat.concat(desc.mat))); d.desc.rea = Array.from(new Set(d.desc.rea.concat(desc.rea)));
      desc.mat = d.desc.mat; desc.rea = d.desc.rea;
      Store.gravar(d);
    }
    function evento(ev) { try { return WowGames.evento(Object.assign({ jogo: ID_JOGO }, ev)); } catch (e) { console.error('[wow.games] Erro ao avisar o perfil:', e); } }
    function usouMaterial(def) {
      if (!jaJogou) { jaJogou = true; evento({ tipo: 'primeiro', partida: true }); }     // uma única vez: conta como jogo experimentado
      if (desc.mat.includes(def.chave)) return;
      desc.mat.push(def.chave); persistirDesc();
      evento({ tipo: 'material', material: def.chave, materiais: desc.mat.length, reacoes: desc.rea.length });
      msg(`🧪 Material experimentado: ${def.nome} (${desc.mat.length}/${MATERIAIS.length})`, 'ok'); atualizarInfo();
    }
    function descobriuReacao(k) {
      const r = REACOES[k]; if (!r || desc.rea.includes(r.id)) return;
      desc.rea.push(r.id); persistirDesc();
      evento({ tipo: 'reacao', reacao: r.id, reacoes: desc.rea.length, materiais: desc.mat.length });
      msg(`🔬 Nova reação descoberta: ${r.nome} (${desc.rea.length}/${REACOES.length})`, 'ok'); atualizarInfo();
    }

    /* ---------- salvamento ---------- */
    const mundoAtual = nome => ({ nome, t: new Date().toISOString(), w: GRADE_W, h: GRADE_H, d: codificar(motor.t, motor.v) });
    function lerStoreOuAvisar(avisar) {
      const st = Store.ler();
      if (st.estado === 'invalido') bloqueado = 'dados danificados';
      else if (st.estado === 'versao') bloqueado = 'versão mais nova';
      else if (st.estado === 'erro') bloqueado = 'armazenamento indisponível';
      else bloqueado = null;
      if (avisar && bloqueado) msg(bloqueado === 'versão mais nova'
        ? 'Os mundos salvos foram criados por uma versão mais nova do jogo. Eles foram preservados, e o salvamento fica desativado nesta versão para não sobrescrevê-los.'
        : bloqueado === 'dados danificados'
          ? 'Os dados salvos do Laboratório não puderam ser lidos. Eles foram preservados (não foram apagados) e o salvamento ficou desativado para não sobrescrevê-los.'
          : 'O navegador não permite acessar o armazenamento. Você pode jogar, mas não conseguirá salvar.', 'erro');
      return st;
    }
    function salvarAuto() {
      clearTimeout(autoTimer); autoTimer = 0;
      if (!autoPendente) return;
      autoPendente = false;
      if (bloqueado) { indicador(); return; }
      const st = Store.ler(); if (st.estado !== 'ok' && st.estado !== 'vazio') { lerStoreOuAvisar(true); indicador(); return; }
      if (st.estado === 'vazio' && motor.vazio()) { avisoSalvo = ''; indicador(); return; }       // não cria a chave só por causa de um mundo em branco
      st.dados.auto = Object.assign(mundoAtual('Salvamento automático'), { slot: slotAtual, sujo });
      const g = Store.gravar(st.dados);
      avisoSalvo = g.ok ? '✅ Salvo automaticamente às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      if (!g.ok) msg('⚠️ O salvamento automático falhou. ' + MSG_ARMAZ[g.motivo], 'erro');
      indicador();
    }
    function agendarAuto() { autoPendente = true; clearTimeout(autoTimer); autoTimer = setTimeout(salvarAuto, AUTOSAVE_MS); indicador(); }

    function slotInfo(st) { return st.dados.slots.map(conferirMundo); }
    function salvarSlot(n) {
      const st = lerStoreOuAvisar(true); if (bloqueado) return;
      const atual = st.dados.slots[n], conf = conferirMundo(atual);
      if (!conf.vazio) {
        const q = conf.ok ? `Substituir o mundo "${conf.nome || 'Mundo ' + (n + 1)}" (salvo em ${hora(conf.quando)}) pelo mundo atual?` : `O salvamento do slot ${n + 1} está danificado (${conf.erro}). Substituir mesmo assim? Os dados danificados serão perdidos.`;
        if (!confirm(q)) return;
      }
      st.dados.slots[n] = mundoAtual(conf.ok && conf.nome ? conf.nome : 'Mundo ' + (n + 1));
      const g = Store.gravar(st.dados);
      if (!g.ok) { msg(MSG_ARMAZ[g.motivo], 'erro'); return; }
      slotAtual = n; sujo = false; msg(`💾 Mundo salvo no slot ${n + 1}.`, 'ok'); agendarAuto(); desenharPaineis(); indicador();
    }
    function mundoVazio() { return motor.vazio(); }
    function confirmarPerda(oque) { return !sujo || mundoVazio() || confirm(`Há alterações não salvas no mundo atual. ${oque} Continuar?`); }
    function carregarSlot(n) {
      const st = lerStoreOuAvisar(true); if (bloqueado) return;
      const conf = conferirMundo(st.dados.slots[n]);
      if (conf.vazio) { msg('Este slot está vazio.', 'erro'); return; }
      if (!conf.ok) { msg(`Este mundo não pôde ser carregado: ${conf.erro}. Os dados foram preservados.`, 'erro'); return; }
      let m; try { m = decodificar(st.dados.slots[n].d, GRADE_W, GRADE_H); } catch (e) { msg(`Este mundo não pôde ser carregado: ${e.message}. Os dados foram preservados.`, 'erro'); return; }
      if (!confirmarPerda('Carregar outro mundo substitui o atual.')) return;
      empurrar(motor.copiar()); motor.t.set(m.t); motor.v.set(m.v); motor.restaurar({ t: motor.t, v: motor.v });
      slotAtual = n; sujo = false; precisa = true; msg(`📂 Mundo "${conf.nome || 'Mundo ' + (n + 1)}" carregado.`, 'ok'); agendarAuto(); desenharPaineis(); atualizarBotoes();
    }
    function excluirSlot(n) {
      const st = lerStoreOuAvisar(true); if (bloqueado) return;
      const conf = conferirMundo(st.dados.slots[n]); if (conf.vazio) return;
      if (!confirm(`Excluir o mundo salvo no slot ${n + 1}${conf.ok && conf.nome ? ` ("${conf.nome}")` : ''}? Isso não pode ser desfeito.`)) return;
      st.dados.slots[n] = null;
      const g = Store.gravar(st.dados); if (!g.ok) { msg(MSG_ARMAZ[g.motivo], 'erro'); return; }
      if (slotAtual === n) slotAtual = null; msg(`🗑 Slot ${n + 1} excluído.`, 'ok'); desenharPaineis();
    }
    function renomearSlot(n, nome) {
      const st = lerStoreOuAvisar(true); if (bloqueado) return;
      const s = st.dados.slots[n]; if (!objeto(s)) return;
      s.nome = String(nome).replace(/[\u0000-\u001f]/g, '').trim().slice(0, NOME_MAX) || 'Mundo ' + (n + 1);
      const g = Store.gravar(st.dados); msg(g.ok ? 'Nome atualizado.' : MSG_ARMAZ[g.motivo], g.ok ? 'ok' : 'erro'); desenharPaineis();
    }
    // Restaura o salvamento automático ao abrir o jogo. Se estiver danificado, avisa e preserva (não apaga nada).
    function restaurarAuto() {
      const st = lerStoreOuAvisar(true);
      if (st.estado !== 'ok') return;
      desc.mat = st.dados.desc.mat.slice(); desc.rea = st.dados.desc.rea.slice();
      const a = st.dados.auto; if (a === null || a === undefined) return;
      const conf = conferirMundo(a);
      if (!conf.ok) { msg(`O salvamento automático não pôde ser restaurado (${conf.erro}). Ele foi preservado.`, 'erro'); return; }
      try { const m = decodificar(a.d, GRADE_W, GRADE_H); motor.t.set(m.t); motor.v.set(m.v); }
      catch (e) { msg(`O salvamento automático não pôde ser restaurado (${e.message}). Ele foi preservado.`, 'erro'); return; }
      slotAtual = Number.isInteger(a.slot) && a.slot >= 0 && a.slot < SLOTS ? a.slot : null; sujo = a.sujo === true;
      avisoSalvo = '✅ Mundo restaurado do salvamento automático'; msg('Seu mundo foi restaurado de onde você parou.', 'ok');
    }

    /* ---------- desfazer / refazer (instantâneos tirados só ao começar uma ação, nunca por quadro) ---------- */
    function empurrar(snap) { desfazerPilha.push(snap); if (desfazerPilha.length > MAX_DESFAZER) desfazerPilha.shift(); refazerPilha = []; }
    function desfazer() { if (!desfazerPilha.length) return; refazerPilha.push(motor.copiar()); motor.restaurar(desfazerPilha.pop()); aposMudanca(); }
    function refazer() { if (!refazerPilha.length) return; desfazerPilha.push(motor.copiar()); motor.restaurar(refazerPilha.pop()); aposMudanca(); }
    function aposMudanca() { sujo = true; precisa = true; agendarAuto(); atualizarBotoes(); }

    /* ---------- desenho com o ponteiro ---------- */
    function pos(e) {
      const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return null;
      return { x: clamp(Math.floor((e.clientX - r.left) * GRADE_W / r.width), 0, GRADE_W - 1), y: clamp(Math.floor((e.clientY - r.top) * GRADE_H / r.height), 0, GRADE_H - 1) };
    }
    function pintarEm(p) {
      const dens = ferramenta > 0 ? DEF[ferramenta].pincel : 1;
      const mud = motor.pintar(p.x, p.y, PINCEIS[pincelIdx].r, ferramenta, dens);
      if (!mud) return;
      if (!traco.confirmado) { empurrar(traco.snap); traco.confirmado = true; atualizarBotoes(); }
      traco.mud += mud; precisa = true;
      if (ferramenta > 0) usouMaterial(DEF[ferramenta]);
    }
    function linha(a, b) {                                                                    // preenche os pontos entre dois eventos do ponteiro
      const dx = b.x - a.x, dy = b.y - a.y, n = Math.max(Math.abs(dx), Math.abs(dy));
      for (let s = 1; s <= n; s++) pintarEm({ x: Math.round(a.x + dx * s / n), y: Math.round(a.y + dy * s / n) });
    }
    function fimTraco() {
      if (!traco) return;
      if (traco.confirmado) { sujo = true; agendarAuto(); atualizarBotoes(); }
      traco = null; ativo = null;
    }
    function inspecionar(p) { inspec = p; atualizarInfo(); }
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;                                // botão direito: contextmenu inspeciona
      const p = pos(e); if (!p) return;
      e.preventDefault();
      if (ferramenta === -1) { inspecionar(p); return; }
      if (ativo !== null) return;                                                             // ignora o segundo dedo
      ativo = e.pointerId;
      try { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch (x) { /* sem captura: continua funcionando */ }
      traco = { snap: motor.copiar(), confirmado: false, mud: 0, ultimo: p };
      pintarEm(p);
    });
    canvas.addEventListener('pointermove', e => {
      if (ativo === null || e.pointerId !== ativo || !traco) return;
      const p = pos(e); if (!p) return;
      linha(traco.ultimo, p); traco.ultimo = p;
    });
    const soltar = e => { if (ativo !== null && e.pointerId === ativo) fimTraco(); };
    canvas.addEventListener('pointerup', soltar); canvas.addEventListener('pointercancel', soltar); canvas.addEventListener('lostpointercapture', soltar);
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); const p = pos(e); if (p) inspecionar(p); });

    /* ---------- ações dos botões ---------- */
    function limpar() {
      if (!confirm('Limpar o mundo? Todo o conteúdo do mundo atual será apagado (você ainda poderá desfazer).')) return;
      if (motor.vazio()) return;
      empurrar(motor.copiar()); motor.limpar(); aposMudanca(); msg('Mundo limpo.', 'ok');
    }
    function carregarModelo(id) {
      const mo = MODELOS.find(x => x.id === id); if (!mo) return;
      if (!confirmarPerda(`O modelo "${mo.nome}" substitui o mundo atual.`)) return;
      empurrar(motor.copiar()); motor.limpar(); mo.fazer(motor);
      slotAtual = null; sujo = false; precisa = true; agendarAuto(); atualizarBotoes(); msg(`🧪 Modelo "${mo.nome}" carregado.`, 'ok');
    }
    function alternarPainel(nome) {
      painel = painel === nome ? null : nome; desenharPaineis();
      ['mundos', 'modelos'].forEach(n => { $('#el-bt-' + n).setAttribute('aria-expanded', String(painel === n)); });
    }
    el.onclick = e => {
      const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      const a = b.dataset.a, v = b.dataset.v;
      switch (a) {
        case 'pausar': pausado = !pausado; acc = 0; atualizarBotoes(); break;
        case 'passo': if (pausado) { motor.passo(); precisa = true; } break;
        case 'vel': velIdx = Number(v); acc = 0; atualizarBotoes(); break;
        case 'desfazer': desfazer(); break;
        case 'refazer': refazer(); break;
        case 'limpar': limpar(); break;
        case 'painel': alternarPainel(v); break;
        case 'mat': ferramenta = Number(v); inspec = null; atualizarBotoes(); atualizarInfo(); break;
        case 'pincel': pincelIdx = Number(v); atualizarBotoes(); break;
        case 'modelo': carregarModelo(v); break;
        case 'salvar': salvarSlot(Number(v)); break;
        case 'carregar': carregarSlot(Number(v)); break;
        case 'excluir': excluirSlot(Number(v)); break;
        case 'salvarAtual': if (slotAtual !== null) salvarSlot(slotAtual); else { if (painel !== 'mundos') alternarPainel('mundos'); msg('Escolha um slot para salvar este mundo.', ''); } break;
      }
    };
    el.onchange = e => { const i = e.target.closest('[data-nome]'); if (i) renomearSlot(Number(i.dataset.nome), i.value); };

    /* ---------- desenhar a interface ---------- */
    function atualizarBotoes() {
      $('#el-pausar').textContent = pausado ? '▶ Continuar' : '⏸ Pausar'; $('#el-pausar').setAttribute('aria-pressed', String(pausado));
      $('#el-passo').disabled = !pausado; $('#el-desfazer').disabled = !desfazerPilha.length; $('#el-refazer').disabled = !refazerPilha.length;
      el.querySelectorAll('[data-a="vel"]').forEach(b => { const on = Number(b.dataset.v) === velIdx; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $('#el-paleta').innerHTML = MATERIAIS.map(m => `<button type="button" class="el-mat ${ferramenta === m.id ? 'on' : ''}" data-a="mat" data-v="${m.id}" aria-pressed="${ferramenta === m.id}" title="${esc(m.desc)}"><i style="background:${m.cor}"></i>${m.nome}</button>`).join('') +
        `<button type="button" class="el-mat ferr ${ferramenta === 0 ? 'on' : ''}" data-a="mat" data-v="0" aria-pressed="${ferramenta === 0}"><i class="bor"></i>Borracha</button>` +
        `<button type="button" class="el-mat ferr ${ferramenta === -1 ? 'on' : ''}" data-a="mat" data-v="-1" aria-pressed="${ferramenta === -1}"><i class="lupa">🔍</i>Inspecionar</button>`;
      $('#el-pincel').innerHTML = PINCEIS.map((p, i) => `<button type="button" class="el-op ${pincelIdx === i ? 'on' : ''}" data-a="pincel" data-v="${i}" aria-pressed="${pincelIdx === i}" title="${p.lado}×${p.lado} células">${p.nome}</button>`).join('');
      indicador();
    }
    function estadoCelula(c, vv) {
      switch (c) {
        case ID.MADEIRA: return vv > 0 ? `Esquentando: pega fogo em ~${vv} passos.` : 'Intacta.';
        case ID.TERRA: return vv > 0 ? 'Úmida: sementes ao lado podem germinar.' : 'Seca.';
        case ID.PLANTA: return vv > 0 ? `Ainda pode crescer ${vv} célula(s).` : 'Totalmente crescida.';
        case ID.FOGO: return `Vai durar mais ~${vv} passos.`;
        case ID.FUMACA: case ID.VAPOR: return `Some em ~${vv} passos.`;
        default: return '';
      }
    }
    function atualizarInfo() {
      const box = $('#el-info'); if (!box) return;
      let c = ferramenta > 0 ? ferramenta : 0, titulo = '', extra = '';
      if (inspec) {
        const i = inspec.y * GRADE_W + inspec.x; c = motor.t[i];
        titulo = `Ponto (${inspec.x}, ${inspec.y})`; extra = c ? estadoCelula(c, motor.v[i]) : '';
      }
      const d = DEF[c];
      const reacoes = REACOES.map(r => desc.rea.includes(r.id) ? `<li class="ok">${esc(r.nome)}</li>` : '<li class="nao">???</li>').join('');
      box.innerHTML = (d ? `<h3 class="el-tit"><i class="el-sw" style="background:${d.cor}"></i>${titulo ? esc(titulo) + ': ' : ''}${esc(d.nome)} <small>(${esc(d.estado)})</small></h3><p>${esc(d.desc)}</p>${extra ? `<p class="el-estado">${esc(extra)}</p>` : ''}<ul>${d.regras.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`
        : ferramenta === 0 ? '<h3 class="el-tit">Borracha</h3><p>Apaga o que estiver sob o pincel.</p>' : `<h3 class="el-tit">${titulo ? esc(titulo) + ': vazio' : 'Inspecionar'}</h3><p>${titulo ? 'Não há nada neste ponto.' : 'Toque ou clique em um ponto do mundo para ver o material e o estado dele.'}</p>`) +
        `<details class="el-diario"><summary>Reações descobertas: ${desc.rea.length}/${REACOES.length} | materiais: ${desc.mat.length}/${MATERIAIS.length}</summary><ul>${reacoes}</ul></details>`;
    }
    function desenharPaineis() {
      const pm = $('#el-p-mundos'), pd = $('#el-p-modelos');
      pm.hidden = painel !== 'mundos'; pd.hidden = painel !== 'modelos';
      if (painel === 'modelos') pd.innerHTML = `<h3 class="el-tit">Modelos prontos</h3><div class="el-modelos">${MODELOS.map(m => `<button type="button" class="el-modelo" data-a="modelo" data-v="${m.id}"><b>${esc(m.nome)}</b><span>${esc(m.desc)}</span></button>`).join('')}</div><p class="el-nota">Carregar um modelo substitui o mundo atual (você confirma antes se houver alterações não salvas, e ainda pode desfazer).</p>`;
      if (painel === 'mundos') {
        const st = Store.ler(); let linhas = '', aviso = '';
        if (st.estado === 'invalido' || st.estado === 'versao' || st.estado === 'erro') aviso = `<p class="el-aviso">⚠️ ${st.estado === 'versao' ? 'Os mundos salvos são de uma versão mais nova do jogo e foram preservados.' : st.estado === 'invalido' ? 'Os dados salvos não puderam ser lidos. Eles foram preservados e o salvamento está desativado.' : 'O armazenamento do navegador não está disponível.'}</p>`;
        else for (let n = 0; n < SLOTS; n++) {
          const conf = conferirMundo(st.dados.slots[n]);
          const nomeCampo = conf.ok ? `<input class="el-nome" data-nome="${n}" maxlength="${NOME_MAX}" value="${esc(conf.nome || 'Mundo ' + (n + 1))}" aria-label="Nome do mundo no slot ${n + 1}">` : `<span class="el-nome vazio">${conf.vazio ? 'Slot vazio' : '⚠️ Salvamento danificado'}</span>`;
          linhas += `<li class="el-slot ${slotAtual === n ? 'atual' : ''}"><b>${n + 1}</b>${nomeCampo}<small>${conf.ok ? esc(hora(conf.quando)) : conf.vazio ? '' : esc(conf.erro)}</small>
            <span class="el-slotbt"><button type="button" class="btn small" data-a="salvar" data-v="${n}">Salvar aqui</button>${conf.ok ? `<button type="button" class="btn small" data-a="carregar" data-v="${n}">Carregar</button>` : ''}${conf.vazio ? '' : `<button type="button" class="btn small stop" data-a="excluir" data-v="${n}">Excluir</button>`}</span></li>`;
        }
        pm.innerHTML = `<h3 class="el-tit">Mundos salvos</h3>${aviso}<ul class="el-slots">${linhas}</ul><p class="el-nota">${slotAtual !== null ? `Mundo atual vindo do slot ${slotAtual + 1}.` : 'O mundo atual ainda não está ligado a um slot.'} O jogo também salva automaticamente para você continuar de onde parou.</p>`;
      }
    }

    /* ---------- renderização e laço principal (um único requestAnimationFrame) ---------- */
    function desenhar() {
      const t = motor.t, v = motor.v; quadro++;
      for (let i = 0; i < t.length; i++) {
        const c = t[i]; if (c === 0) { buf[i] = FUNDO; continue; }
        let s = RUIDO[i], base = c << 4;
        switch (c) {
          case ID.FOGO: s = (v[i] + i + quadro) & 7; break;
          case ID.LAVA: s = (i * 3 + (quadro >> 2)) & 7; if (i >= GRADE_W && t[i - GRADE_W] === 0) s = 7; break;
          case ID.FUMACA: case ID.VAPOR: s = Math.min(7, v[i] >> 4); break;
          case ID.AGUA: case ID.OLEO: if (i >= GRADE_W && t[i - GRADE_W] === 0) s = 7; break;
          case ID.MADEIRA: if (v[i] > 0) { base += 8; s = (v[i] + quadro) & 7; } break;
          case ID.TERRA: if (v[i] > 0) { base += 8; s = RUIDO[i]; } break;
          case ID.PLANTA: if (v[i] > 0) { base += 8; s = RUIDO[i]; } break;
        }
        buf[i] = PAL[base + s];
      }
      ctx.putImageData(img, 0, 0);
    }
    function laco(ts) {
      raf = requestAnimationFrame(laco);
      const dt = Math.min(250, ts - (ultimoTs || ts)); ultimoTs = ts;
      if (!pausado) {
        acc += dt; const ms = 1000 / (PASSOS_POR_SEG * VELOCIDADES[velIdx]); let n = 0;
        while (acc >= ms && n < MAX_PASSOS_QUADRO) { motor.passo(); acc -= ms; n++; }
        if (n === MAX_PASSOS_QUADRO) acc = 0;                                                  // se não deu conta, descarta o atraso em vez de acumular
        if (n) precisa = true;
      }
      if (motor.novas.length) while (motor.novas.length) descobriuReacao(motor.novas.shift());
      if (precisa) { desenhar(); precisa = false; if (inspec && quadro % 15 === 0) atualizarInfo(); }     // o painel de inspeção atualiza ~4x por segundo, não a cada quadro
    }

    /* ---------- encerramento seguro ---------- */
    const aoSair = () => { if (autoPendente) salvarAuto(); };
    const aoOcultar = () => { if (document.hidden) aoSair(); };
    window.addEventListener('pagehide', aoSair); document.addEventListener('visibilitychange', aoOcultar);

    /* ---------- início ---------- */
    jaJogou = !!(WowGames.Perfil && WowGames.Perfil.dados().jogos[ID_JOGO]);
    restaurarAuto();
    if (desc.mat.length || desc.rea.length) evento({ tipo: 'sync', materiais: desc.mat.length, reacoes: desc.rea.length, ids: desc.rea.slice(), usados: desc.mat.slice() });   // reconcilia o perfil com o que já foi descoberto
    atualizarBotoes(); atualizarInfo(); indicador(); desenhar();
    raf = requestAnimationFrame(laco);

    return () => {                                                                             // desmontar: nada pode continuar rodando
      cancelAnimationFrame(raf); raf = 0;
      clearTimeout(msgTimer); aoSair(); clearTimeout(autoTimer);
      window.removeEventListener('pagehide', aoSair); document.removeEventListener('visibilitychange', aoOcultar);
      el.onclick = null; el.onchange = null;
    };
  }

  WowGames.register({
    id: ID_JOGO, nome: 'Laboratório de Elementos', icone: '🧪', cor: '#ff9f5a',
    desc: 'wow.elements: um sandbox 2D em que você desenha materiais, observa partículas em movimento e experimenta reações.',
    mount(el) {
      try { return montar(el); }
      catch (e) {
        console.error('[wow.games] Erro ao iniciar o Laboratório de Elementos:', e);
        el.innerHTML = `<div class="big-emoji">🧪</div><h2>Não foi possível iniciar o Laboratório</h2><p>${esc(e && e.message ? e.message : 'Erro inesperado.')}</p><p>Seus outros jogos e dados não foram afetados.</p><a class="btn" href="#/">Voltar ao início</a>`;
        return () => {};
      }
    }
  });
})();
