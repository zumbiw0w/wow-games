/* wow.calm — DADOS E BALANCEAMENTO (tudo centralizado aqui; nada de DOM).
   A "serenidade" é um recurso interno do jogo: não é moeda do site, não compra nada na Loja e não vale fora do wow.calm.
   Cada item: id estável, etapa (1 a 5), categoria, custo, crescimento por nível, nível máximo (1 = compra única),
   efeito na produção, se é essencial para avançar de etapa, requisitos e o que muda no quarto/som.
   Efeitos: clique (+ por clique, por nível) | auto (+ por segundo, por nível) | mult (+% em tudo) | multClique | multAuto | multBebidas.
   Os valores foram ajustados com simulações de três estilos de jogo (resultados em docs/wow-calm.md). */
(function () {
  const ETAPAS = [
    { n: 1, nome: 'Um cantinho vazio', desc: 'Um núcleo de luz, uma luminária, uma caneca e uma almofada.' },
    { n: 2, nome: 'Pequenos confortos', desc: 'Chá, livros, cobertor e os primeiros confortos que trabalham sozinhos.' },
    { n: 3, nome: 'O mundo fica mais silencioso', desc: 'Chuva na janela, sons do ambiente e luzes quentes.' },
    { n: 4, nome: 'Seu próprio refúgio', desc: 'Plantas, cantinho de leitura, aquário, lareira e uma cozinha tranquila.' },
    { n: 5, nome: 'Refúgio completo', desc: 'O último ambiente, a bebida da casa e a Lanterna do Refúgio.' }
  ];
  const CATEGORIAS = { conforto: 'Conforto', som: 'Sons e atmosferas', bebida: 'Bebidas e pausas', experiencia: 'Experiências', producao: 'Produção' };

  const I = (o) => Object.assign({ max: 1, cresc: 1, efeito: {}, essencial: false, requer: [], opcional: false }, o);
  const ITENS = [
    /* ---------- Etapa 1 ---------- */
    I({ id: 'luminaria', ordem: 1, etapa: 1, cat: 'conforto', icone: '💡', nome: 'Luminária de luz quente', desc: 'Uma luz amarelinha acende no canto.', custo: 10, efeito: { auto: .4 }, essencial: true }),
    I({ id: 'nucleo', ordem: 2, etapa: 1, cat: 'producao', icone: '✨', nome: 'Núcleo de serenidade', desc: 'O núcleo de luz fica mais forte a cada nível.', custo: 15, cresc: 1.55, max: 15, efeito: { clique: 1 }, essencial: true }),
    I({ id: 'caneca', ordem: 3, etapa: 1, cat: 'conforto', icone: '☕', nome: 'Caneca quentinha', desc: 'Uma caneca fumegante na mesinha.', custo: 30, efeito: { clique: 1 }, essencial: true, som: 'despejar' }),
    I({ id: 'respiro', ordem: 4, etapa: 1, cat: 'producao', icone: '🌬️', nome: 'Respiração calma', desc: 'Um ritmo tranquilo que traz serenidade sozinho.', custo: 25, cresc: 1.16, max: 30, efeito: { auto: .5 } }),
    I({ id: 'almofada', ordem: 5, etapa: 1, cat: 'conforto', icone: '🛋️', nome: 'Almofada macia', desc: 'Uma almofada fofinha no chão.', custo: 60, efeito: { auto: 1 }, essencial: true }),

    /* ---------- Etapa 2 ---------- */
    I({ id: 'cha', ordem: 10, etapa: 2, cat: 'bebida', icone: '🍵', nome: 'Chá simples', desc: 'Uma chaleira que sempre tem chá. Produz sozinho.', custo: 155, cresc: 1.15, max: 25, efeito: { auto: 2 }, essencial: true, som: 'despejar' }),
    I({ id: 'livros', ordem: 11, etapa: 2, cat: 'conforto', icone: '📚', nome: 'Livros na mesa', desc: 'Uma pilha de livros favoritos.', custo: 310, efeito: { clique: 3 }, essencial: true }),
    I({ id: 'paginas', ordem: 12, etapa: 2, cat: 'som', icone: '📖', nome: 'Páginas virando', desc: 'Libera o som suave de páginas de livro.', custo: 530, efeito: { auto: 3 }, requer: ['livros'], som: 'paginas' }),
    I({ id: 'cobertor', ordem: 13, etapa: 2, cat: 'conforto', icone: '🧶', nome: 'Cobertor confortável', desc: 'Um cobertor xadrez dobrado. +15% em tudo.', custo: 630, efeito: { mult: .15 }, essencial: true }),
    I({ id: 'chaverde', ordem: 14, etapa: 2, cat: 'bebida', icone: '🫖', nome: 'Chá verde', desc: 'Um bule de chá verde que produz sozinho.', custo: 980, cresc: 1.16, max: 20, efeito: { auto: 7 }, requer: ['cha'] }),

    /* ---------- Etapa 3 ---------- */
    I({ id: 'janela', ordem: 20, etapa: 3, cat: 'experiencia', icone: '🪟', nome: 'Janela com chuva', desc: 'Uma janela grande com gotas de chuva escorrendo. Libera a atmosfera de chuva.', custo: 3000, efeito: { auto: 8 }, essencial: true }),
    I({ id: 'chuvafraca', ordem: 21, etapa: 3, cat: 'som', icone: '🌧️', nome: 'Chuva fraca na janela', desc: 'Libera o som de chuva leve.', custo: 4400, efeito: { auto: 12 }, requer: ['janela'], essencial: true, som: 'chuva' }),
    I({ id: 'despejar', ordem: 22, etapa: 3, cat: 'som', icone: '🫗', nome: 'Água na xícara', desc: 'O som de água quente enchendo a xícara a cada compra de bebida.', custo: 3600, efeito: { clique: 8 } }),
    I({ id: 'chocolate', ordem: 23, etapa: 3, cat: 'bebida', icone: '🍫', nome: 'Chocolate quente', desc: 'Uma panelinha de chocolate que produz sozinha.', custo: 5000, cresc: 1.17, max: 20, efeito: { auto: 16 } }),
    I({ id: 'ruido', ordem: 24, etapa: 3, cat: 'som', icone: '🌫️', nome: 'Ruído ambiente suave', desc: 'Libera um som de fundo bem baixinho, como um quarto silencioso.', custo: 6400, efeito: { auto: 18 }, essencial: true, som: 'ruido' }),
    I({ id: 'luzes', ordem: 25, etapa: 3, cat: 'conforto', icone: '🏮', nome: 'Luzinhas quentes', desc: 'Um varal de luzes na parede. +20% em tudo.', custo: 8400, efeito: { mult: .2 }, essencial: true }),
    I({ id: 'estacao', ordem: 26, etapa: 3, cat: 'producao', icone: '📻', nome: 'Estação de sons ambientes', desc: 'Um rádio antigo que mistura sons calmos. Produz sozinho.', custo: 7600, cresc: 1.18, max: 20, efeito: { auto: 22 } }),
    I({ id: 'asmr', ordem: 27, etapa: 3, cat: 'som', icone: '🎧', nome: 'Toques suaves (ASMR)', desc: 'Libera toques sintetizados de objetos de madeira e cerâmica.', custo: 12000, efeito: { auto: 30 }, som: 'asmr' }),
    I({ id: 'chuvaforte', ordem: 28, etapa: 3, cat: 'som', icone: '⛈️', nome: 'Chuva mais intensa (opcional)', desc: 'Uma opção de chuva mais forte para a atmosfera.', custo: 14000, efeito: { auto: 10 }, requer: ['chuvafraca'], opcional: true, som: 'chuvaforte' }),

    /* ---------- Etapa 4 ---------- */
    I({ id: 'plantas', ordem: 30, etapa: 4, cat: 'conforto', icone: '🪴', nome: 'Pequena coleção de plantas', desc: 'Vasinhos verdes no parapeito.', custo: 24000, efeito: { auto: 45 }, essencial: true }),
    I({ id: 'poltrona', ordem: 31, etapa: 4, cat: 'conforto', icone: '🪑', nome: 'Poltrona de leitura', desc: 'Uma poltrona funda perto da janela.', custo: 31000, efeito: { clique: 40 }, essencial: true }),
    I({ id: 'leitura', ordem: 32, etapa: 4, cat: 'experiencia', icone: '📗', nome: 'Cantinho de leitura', desc: 'Um livro aberto cujas páginas viram devagar.', custo: 38500, efeito: { auto: 60 }, requer: ['poltrona'], essencial: true }),
    I({ id: 'tapete', ordem: 33, etapa: 4, cat: 'conforto', icone: '🟫', nome: 'Tapete macio', desc: 'Um tapete redondo e felpudo. +25% em tudo.', custo: 43000, efeito: { mult: .25 } }),
    I({ id: 'jardim', ordem: 34, etapa: 4, cat: 'producao', icone: '🌿', nome: 'Jardim contemplativo', desc: 'Um jardim interno que cresce a cada nível.', custo: 29000, cresc: 1.18, max: 15, efeito: { auto: 55 }, requer: ['plantas'] }),
    I({ id: 'aquario', ordem: 35, etapa: 4, cat: 'experiencia', icone: '🐠', nome: 'Mini aquário', desc: 'Peixinhos nadando devagar entre plantas.', custo: 53000, efeito: { auto: 90 }, essencial: true }),
    I({ id: 'lareira', ordem: 36, etapa: 4, cat: 'experiencia', icone: '🔥', nome: 'Pequena lareira', desc: 'Uma lareira com chamas animadas. Libera o som de lenha estalando.', custo: 62500, efeito: { auto: 110 }, essencial: true, som: 'lareira' }),
    I({ id: 'bule', ordem: 37, etapa: 4, cat: 'bebida', icone: '🏺', nome: 'Bule automático', desc: 'Prepara as bebidas sozinho: dobra a produção de todas as bebidas.', custo: 57500, efeito: { multBebidas: 1 }, requer: ['cha'] }),
    I({ id: 'culinaria', ordem: 38, etapa: 4, cat: 'experiencia', icone: '🍜', nome: 'Cantinho de culinária', desc: 'Uma cozinha pequena onde a personagem prepara e saboreia uma tigela de lámen.', custo: 77000, efeito: { auto: 140 }, essencial: true }),

    /* ---------- Etapa 5 ---------- */
    I({ id: 'musica', ordem: 40, etapa: 5, cat: 'som', icone: '🎶', nome: 'Música ambiente', desc: 'Libera uma música suave gerada no navegador. +25% em tudo.', custo: 154000, efeito: { mult: .25 }, essencial: true, som: 'musica' }),
    I({ id: 'especial', ordem: 41, etapa: 5, cat: 'bebida', icone: '🧋', nome: 'Bebida especial da casa', desc: 'Uma receita só sua, servida numa xícara de cerâmica.', custo: 196000, efeito: { auto: 320 }, essencial: true }),
    I({ id: 'chuvaatm', ordem: 42, etapa: 5, cat: 'producao', icone: '🌦️', nome: 'Chuva que alimenta a atmosfera', desc: 'A chuva deixa tudo mais calmo: +40% na produção automática.', custo: 224000, efeito: { multAuto: .4 }, requer: ['chuvafraca'] }),
    I({ id: 'claraboia', ordem: 43, etapa: 5, cat: 'experiencia', icone: '🌌', nome: 'Claraboia estrelada', desc: 'O último ambiente: uma janela no teto para o céu noturno.', custo: 308000, efeito: { auto: 400 }, essencial: true }),
    I({ id: 'lanterna', ordem: 44, etapa: 5, cat: 'experiencia', icone: '🏮', nome: 'Lanterna do Refúgio', desc: 'O item especial. Completa o refúgio e acende tudo de uma vez.', custo: 448000, efeito: { mult: .5 }, essencial: true, final: true, requer: ['claraboia', 'especial', 'musica'] }),

    /* ---------- Depois da conclusão (opcionais, para colecionar) ---------- */
    I({ id: 'gato', ordem: 50, etapa: 5, cat: 'conforto', icone: '🐈', nome: 'Gatinho sonolento', desc: 'Um gato que dorme enrolado na almofada.', custo: 336000, efeito: { auto: 150 }, requer: ['lanterna'], opcional: true }),
    I({ id: 'mobile', ordem: 51, etapa: 5, cat: 'conforto', icone: '🌙', nome: 'Móbile de estrelas', desc: 'Estrelinhas que giram devagar no teto.', custo: 504000, efeito: { auto: 200 }, requer: ['lanterna'], opcional: true }),
    I({ id: 'canecas', ordem: 52, etapa: 5, cat: 'bebida', icone: '🫖', nome: 'Coleção de canecas', desc: 'Uma prateleira com canecas de todas as cores.', custo: 700000, efeito: { auto: 260 }, requer: ['lanterna'], opcional: true })
  ];

  /* Cores da parede (personalização): liberadas ao alcançar cada etapa */
  const PAREDES = [
    { id: 'creme', nome: 'Creme', etapa: 1, cor: '#f6ead6', chao: '#c9a27a' }, { id: 'lavanda', nome: 'Lavanda', etapa: 2, cor: '#e4dcf3', chao: '#b9926c' },
    { id: 'azul', nome: 'Azul acinzentado', etapa: 3, cor: '#d7e2ea', chao: '#a98a6a' }, { id: 'salvia', nome: 'Sálvia', etapa: 4, cor: '#dde7d6', chao: '#b08b64' },
    { id: 'madeira', nome: 'Madeira quente', etapa: 5, cor: '#e8cfae', chao: '#8f6a4c' }
  ];
  /* Atmosferas: mudam a luz do quarto e quais sons ambientes tocam */
  const ATMOSFERAS = [
    { id: 'tarde', nome: 'Tarde clara', requer: [], sons: [] },
    { id: 'chuva', nome: 'Chuva fraca', requer: ['chuvafraca'], sons: ['chuva'] },
    { id: 'temporal', nome: 'Chuva intensa', requer: ['chuvaforte'], sons: ['chuvaforte'] },
    { id: 'lareira', nome: 'Noite de lareira', requer: ['lareira'], sons: ['lareira'] },
    { id: 'estrelas', nome: 'Noite estrelada', requer: ['claraboia'], sons: [] }
  ];

  /* ---------- Regras puras da economia (usadas pelo jogo e pelas simulações) ---------- */
  const PORID = Object.fromEntries(ITENS.map(i => [i.id, i]));
  const custo = (it, nivel) => Math.round(it.custo * Math.pow(it.cresc, nivel || 0));
  function producao(niv) {
    let clique = 1, multC = 0, multA = 0, mult = 0, multB = 0, auto = 0, autoB = 0;
    ITENS.forEach(it => {
      const n = niv[it.id] || 0; if (!n) return; const e = it.efeito;
      clique += (e.clique || 0) * n; multC += (e.multClique || 0); multA += (e.multAuto || 0); mult += (e.mult || 0); multB += (e.multBebidas || 0);
      if (it.cat === 'bebida') autoB += (e.auto || 0) * n; else auto += (e.auto || 0) * n;
    });
    return { clique: clique * (1 + multC) * (1 + mult), auto: (auto + autoB * (1 + multB)) * (1 + multA) * (1 + mult) };
  }
  const essenciais = etapa => ITENS.filter(i => i.etapa === etapa && i.essencial);
  function etapaAtual(niv) {
    let e = 1;
    while (e < 5 && essenciais(e).every(i => niv[i.id] > 0)) e++;
    return e;
  }
  function disponivel(it, niv) {
    return it.etapa <= etapaAtual(niv) && it.requer.every(r => niv[r] > 0);
  }
  const concluido = niv => !!niv.lanterna;
  function progresso(niv) {                                             // % da jornada principal (itens essenciais)
    const ess = ITENS.filter(i => i.essencial);
    return ess.filter(i => niv[i.id] > 0).length / ess.length;
  }
  function proxima(niv) {                                               // próxima recompensa essencial ainda não comprada
    const e = etapaAtual(niv);
    return ITENS.filter(i => i.essencial && !niv[i.id] && i.etapa <= e && disponivel(i, niv)).sort((a, b) => custo(a, 0) - custo(b, 0))[0]
      || ITENS.filter(i => i.essencial && !niv[i.id]).sort((a, b) => a.ordem - b.ordem)[0] || null;
  }
  function fmt(n) {                                                     // números legíveis: 1.234 · 12,3 mil · 1,2 mi
    n = Math.floor(n);
    if (n < 10000) return n.toLocaleString('pt-BR');
    if (n < 1e6) return (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: n < 1e5 ? 1 : 0 }) + ' mil';
    return (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
  }
  const fmtTaxa = n => n < 10 ? n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : fmt(n);

  const api = { versao: 1, ETAPAS, CATEGORIAS, ITENS, PORID, PAREDES, ATMOSFERAS, custo, producao, etapaAtual, disponivel, concluido, progresso, proxima, essenciais, fmt, fmtTaxa };
  if (typeof WowGames !== 'undefined') WowGames.CalmDados = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
