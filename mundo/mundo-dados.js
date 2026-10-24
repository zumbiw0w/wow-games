/* wow.world — DADOS ESTÁTICOS (regiões, pontos de interesse, registros, missões, segredos e mapas das áreas).
   Só conteúdo: nada aqui altera o estado do jogador. As regras ficam em mundo-estado.js. */
(function () {
  /* ---------- Regiões do mapa (x/y em % do mapa ilustrado) ---------- */
  const REGIOES = [
    { id: 'praca', nome: 'Praça dos Portais', icone: '🏛️', cor: '#ffc933', x: 50, y: 56, principal: 'torre',
      desc: 'O coração do mundo. Daqui partem os portais para todos os jogos, e a Torre cresce junto com as suas descobertas.' },
    { id: 'floresta', nome: 'Floresta dos Sussurros', icone: '🌲', cor: '#3ddc97', x: 20, y: 34, principal: 'arvoremae',
      desc: 'Árvores antigas que falam baixinho. Pedras com símbolos e um portão de raízes guardam um caminho escondido.' },
    { id: 'provas', nome: 'Distrito das Provas', icone: '⚔️', cor: '#ff5d73', x: 79, y: 30, principal: 'portaoantigos',
      desc: 'Arenas onde os antigos testavam reflexos e raciocínio. Os portais levam aos jogos de reflexo, números, sequências e perguntas.' },
    { id: 'ilhas', nome: 'Ilhas Elementais', icone: '🔥', cor: '#4da3ff', x: 22, y: 78, principal: 'altar',
      desc: 'Ilhotas flutuantes com cristais adormecidos. Eles despertam com a energia de reações descobertas no wow.elements.' },
    { id: 'observatorio', nome: 'Observatório Esquecido', icone: '🔭', cor: '#b9a2ff', x: 80, y: 77, principal: 'telescopio',
      desc: 'Uma torre de pedra coberta de símbolos. Registros misteriosos e uma câmara selada esperam por quem reunir ecos suficientes.' }
  ];

  /* ---------- Pontos de interesse de cada região (x/y em % da cena) ----------
     tipo: lore (lê um registro) | npc (conversa) | portal (abre um jogo) | area (entra com personagem) | mural | torre |
           portao-floresta | portao-antigos | cristais | estrelas | camara */
  const PONTOS = {
    praca: [
      { id: 'torre', tipo: 'torre', nome: 'Torre dos Portais', icone: '🗼', x: 50, y: 34 },
      { id: 'mural', tipo: 'mural', nome: 'Mural de missões', icone: '📜', x: 22, y: 58 },
      { id: 'lume', tipo: 'npc', nome: 'Guardiã Lume', icone: '🧙‍♀️', x: 76, y: 60 },
      { id: 'anel', tipo: 'portal', nome: 'Anel de Portais', icone: '🌀', x: 50, y: 76, jogos: 'todos' },
      { id: 'entrarpraca', tipo: 'area', nome: 'Caminhar pela praça', icone: '🚶', x: 84, y: 84, area: 'praca' }
    ],
    floresta: [
      { id: 'arvoremae', tipo: 'lore', nome: 'Árvore-Mãe', icone: '🌳', x: 48, y: 30, registro: 'arvoremae' },
      { id: 'coruja', tipo: 'npc', nome: 'Coruja Sábia', icone: '🦉', x: 76, y: 38 },
      { id: 'portaoraizes', tipo: 'portao-floresta', nome: 'Portão de Raízes', icone: '🌿', x: 24, y: 58 },
      { id: 'entrarfloresta', tipo: 'area', nome: 'Entrar na trilha', icone: '🚶', x: 62, y: 80, area: 'floresta' }
    ],
    provas: [
      { id: 'portaoantigos', tipo: 'portao-antigos', nome: 'Portão dos Antigos', icone: '🚪', x: 50, y: 28 },
      { id: 'estatua', tipo: 'lore', nome: 'Estátua do Primeiro Juiz', icone: '🗿', x: 18, y: 36, registro: 'estatua' },
      { id: 'pReflexo', tipo: 'portal', nome: 'Portal dos Reflexos', icone: '⚡', x: 22, y: 72, jogos: ['botao', 'tempo', 'cor'] },
      { id: 'pNumeros', tipo: 'portal', nome: 'Portal dos Números', icone: '🧮', x: 42, y: 78, jogos: ['matematica', 'peso'] },
      { id: 'pSequencia', tipo: 'portal', nome: 'Portal das Sequências', icone: '🔢', x: 62, y: 78, jogos: ['sequencia', 'caso001'] },
      { id: 'pPerguntas', tipo: 'portal', nome: 'Portal das Perguntas', icone: '🎤', x: 82, y: 70, jogos: ['show'] }
    ],
    ilhas: [
      { id: 'altar', tipo: 'cristais', nome: 'Altar dos Cristais', icone: '💎', x: 50, y: 40 },
      { id: 'pElementos', tipo: 'portal', nome: 'Portal do Laboratório', icone: '🧪', x: 20, y: 70, jogos: ['elementos'] },
      { id: 'pedravulcao', tipo: 'lore', nome: 'Pedra do Vulcão Calmo', icone: '🌋', x: 80, y: 68, registro: 'vulcao' }
    ],
    observatorio: [
      { id: 'telescopio', tipo: 'lore', nome: 'Grande Telescópio', icone: '🔭', x: 50, y: 24, registro: 'telescopio' },
      { id: 'placa', tipo: 'lore', nome: 'Placa partida', icone: '🪨', x: 18, y: 52, registro: 'placa' },
      { id: 'mapaestelar', tipo: 'estrelas', nome: 'Mapa estelar', icone: '✨', x: 80, y: 50 },
      { id: 'camara', tipo: 'camara', nome: 'Câmara do Primeiro Eco', icone: '🔒', x: 50, y: 78 }
    ]
  };

  /* ---------- Registros (história do mundo, aparecem no diário depois de lidos) ---------- */
  const REGISTROS = {
    arvoremae: { titulo: 'O que a Árvore-Mãe lembra', texto: 'Antes dos portais, os mundos eram ilhas que não se conheciam. Os Antigos plantaram minhas raízes para que elas atravessassem o vazio e costurassem os caminhos. Ainda hoje, quem escuta com atenção ouve os passos deles.' },
    estatua: { titulo: 'Inscrição do Primeiro Juiz', texto: '“Nenhum portão se abre para quem só observa. Prove que sabe contar, ordenar ou desvendar, e as portas dos Antigos reconhecerão seu nome.”' },
    vulcao: { titulo: 'A pedra morna', texto: 'Esta pedra já foi lava. Os Antigos diziam que tudo o que esfria guarda um pouco do fogo que foi, e que os cristais das ilhas dormem esperando essa lembrança.' },
    telescopio: { titulo: 'Diário do último astrônomo', texto: 'Noite 312: as estrelas antigas formaram de novo o desenho do sol, da lua e da estrela-guia. Desconfio que a floresta conhece a ordem certa. Se alguém a encontrar, que a repita no mapa estelar.' },
    placa: { titulo: 'A placa partida', texto: 'Metade da placa sumiu. O que restou diz: “...a câmara guarda o Primeiro Eco, a voz do mundo antes dos portais. Ela só se abre para quem reuniu ecos de descobertas...”' },
    clareira: { titulo: 'O caderno da clareira', texto: 'Na clareira escondida há um caderno de capa de musgo. A última página traz um desenho da Torre dos Portais muito mais alta do que hoje, com uma luz no topo. Abaixo, alguém escreveu: “ela cresce com quem explora”.' },
    eco: { titulo: 'O Primeiro Eco', texto: 'Dentro da câmara, uma esfera de luz repete baixinho os sons de todos os jogos ao mesmo tempo: cliques, cronômetros, dados e risadas. O Primeiro Eco era a soma de todas as brincadeiras. Enquanto alguém jogar, ele não se apaga.' },
    ponte: { titulo: 'A ponte de cristal', texto: 'Com os três cristais acesos, uma ponte de luz liga as ilhas. Gravado nela: “fogo, água e vida, juntos, mantêm os portais abertos”.' }
  };

  /* ---------- Símbolos da floresta (missão 2) ---------- */
  const SIMBOLOS = {
    sol: { icone: '☀️', nome: 'Sol', frase: '“Eu sou o primeiro a acordar.”' },
    lua: { icone: '🌙', nome: 'Lua', frase: '“Depois que o sol nasce, eu descanso.”' },
    estrela: { icone: '⭐', nome: 'Estrela', frase: '“Eu guio quem chega por último.”' }
  };
  const ORDEM_PORTAO = ['sol', 'lua', 'estrela'];

  /* ---------- Cristais das Ilhas (missão 3): cada um desperta com um grupo de reações do wow.elements ---------- */
  const CRISTAIS = [
    { id: 'fogo', nome: 'Cristal do Fogo', icone: '🔥', cor: '#ff7a45', reacoes: ['madeira', 'oleo', 'planta', 'lava_acende'] },
    { id: 'agua', nome: 'Cristal da Névoa', icone: '💧', cor: '#4da3ff', reacoes: ['apagar', 'solidificar', 'esfriar'] },
    { id: 'vida', nome: 'Cristal da Vida', icone: '🌱', cor: '#3ddc97', reacoes: ['germinar', 'umedecer'] }
  ];
  const REACOES = {                                                    // mesmos ids do wow.elements (games/elements.js)
    apagar: 'Água apaga o fogo', madeira: 'Madeira pega fogo', oleo: 'Óleo em chamas', planta: 'Planta queima', germinar: 'Semente germina',
    solidificar: 'Lava vira pedra na água', umedecer: 'Terra absorve água', lava_acende: 'Lava acende combustível', esfriar: 'Lava esfria'
  };

  /* ---------- Desafios aceitos pelo Portão dos Antigos (missão 4) ---------- */
  const PROVAS = { matematica: 'Matemática Relâmpago', sequencia: 'Complete a Sequência', caso001: 'O Caso #001' };

  /* ---------- Mapa estelar (segredo 3) ---------- */
  const ESTRELAS = [
    { id: 'lua', icone: '🌙', x: 22, y: 30 }, { id: 'cometa', icone: '☄️', x: 50, y: 18 }, { id: 'sol', icone: '☀️', x: 78, y: 32 },
    { id: 'estrela', icone: '⭐', x: 30, y: 72 }, { id: 'planeta', icone: '🪐', x: 70, y: 70 }, { id: 'diamante', icone: '💠', x: 50, y: 52 }
  ];

  /* ---------- Missões ---------- */
  const MISSOES = [
    { id: 'm1', nome: 'Um mundo a descobrir', icone: '🧭', desc: 'Visite as cinco regiões e conheça o ponto principal de cada uma.',
      objetivo: 'Em cada região, visite e examine o ponto principal (marcado com ★).', recompensa: 'Lanternas na Praça + conquista “Andarilho do wow.world”.' },
    { id: 'm2', nome: 'O código da floresta', icone: '🌿', desc: 'Três pedras da Floresta dos Sussurros guardam símbolos. Juntas, elas dizem como abrir o Portão de Raízes.',
      objetivo: 'Encontre as três pedras na trilha da floresta e abra o Portão de Raízes com a ordem certa.', recompensa: 'Passagem para a clareira escondida + conquista “Decifrador de Raízes”.' },
    { id: 'm3', nome: 'Energia adormecida', icone: '💎', desc: 'Os cristais das Ilhas Elementais dormem. Uma reação descoberta no wow.elements pode acordá-los.',
      objetivo: 'Descubra uma reação no wow.elements e use-a para despertar um cristal no Altar das Ilhas.', recompensa: 'Cristal aceso + bandeirolas na Praça + conquista “Despertador de Cristais”.' },
    { id: 'm4', nome: 'O teste dos antigos', icone: '🚪', desc: 'O Portão dos Antigos só se abre para quem conclui uma prova de raciocínio.',
      objetivo: 'Termine uma partida de Matemática Relâmpago, Complete a Sequência ou O Caso #001.', recompensa: 'Portão dos Antigos aberto + conquista “Aprovado pelos Antigos”.' },
    { id: 'm5', nome: 'O primeiro eco', icone: '🔮', desc: 'A Câmara do Observatório guarda o Primeiro Eco. Ela reconhece quem reuniu ecos de descobertas pelo mundo.',
      objetivo: 'Reúna 6 ecos (descobertas) e abra a Câmara do Primeiro Eco no Observatório.', recompensa: 'A Câmara se abre, a Torre ganha sua luz + conquista “Ouvinte do Primeiro Eco”.' }
  ];
  const ECOS_NECESSARIOS = 6;

  /* ---------- Segredos ---------- */
  const SEGREDOS = [
    { id: 'raiz', nome: 'A raiz que canta', icone: '🍄', pista: '“Onde o riacho faz a curva, três chapéus vermelhos escutam a raiz.” (Coruja Sábia)',
      recompensa: 'A raiz brilha na trilha e flores cantantes aparecem na Praça.' },
    { id: 'sino', nome: 'O sino que responde', icone: '🔔', pista: '“O sino da praça só toca para quem parou o tempo a menos de 0,15 s do alvo.” (Guardiã Lume)',
      recompensa: 'O sino fica dourado e toca sempre que você passa por ele.' },
    { id: 'constelacao', nome: 'A constelação esquecida', icone: '🌌', pista: '“As estrelas antigas seguem a mesma ordem dos símbolos da floresta.” (Diário do último astrônomo)',
      recompensa: 'A constelação se acende no Observatório e no céu do mapa.' }
  ];

  /* ---------- Áreas com personagem: mapas em grade (cada caractere é um quadrado) ----------
     # muro/sebe  T árvore  ~ água  . chão  , trilha  = ponte  S início do personagem
     Objetos (sólidos e interativos): letras abaixo. Decorações que surgem com o progresso: minúsculas não sólidas. */
  const AREAS = {
    praca: {
      nome: 'Praça dos Portais', chao: '#e9d9b0', mapa: [
        '####################',
        '#..l....l....l....l#',
        '#...######.......f.#',
        '#...#tttt#.........#',
        '#...#tttt#...g.....#',
        '#.f.##..##.........#',
        '#..........b.......#',
        '#..m...........P...#',
        '#........~~~.......#',
        '#..f.....~~~.....f.#',
        '#....S.........n...#',
        '####################'],
      objetos: {
        t: { id: 'torre', nome: 'Torre dos Portais' }, g: { id: 'lume', nome: 'Guardiã Lume' }, b: { id: 'sino', nome: 'Sino da praça' },
        m: { id: 'mural', nome: 'Mural de missões' }, P: { id: 'portal', nome: 'Portal de volta ao mapa' }, n: { id: 'placaPraca', nome: 'Placa da praça' }
      },
      decoracoes: { l: 'lanterna', f: 'flor' }
    },
    floresta: {
      nome: 'Floresta dos Sussurros', chao: '#5aa36b', mapa: [
        'TTTTTTTTTTTTTTTTTTTT',
        'T,,,,,TT....T...c..T',
        'T,TT,,,,..1.T......T',
        'T,TT,TT,,,,,T......T',
        'T,,,,TT,TT,,TTTGTTTT',
        'TT~~,,,,TT,,,,,,,TTT',
        'T,,~~,MMM,,o,,,,,,,T',
        'T,TT~~,,,,TT,,TT,2,T',
        'T,TT,~~=~~TT,,TT,,,T',
        'T,3,,,,,,~~~~~TT,,,T',
        'T,,,TT,S,,,,,,,,,,,T',
        'TTTTTTTTTTTTTTTTTTTT'],
      objetos: {
        1: { id: 'pedra_sol', nome: 'Pedra com símbolo', simbolo: 'sol' }, 2: { id: 'pedra_lua', nome: 'Pedra com símbolo', simbolo: 'lua' },
        3: { id: 'pedra_estrela', nome: 'Pedra com símbolo', simbolo: 'estrela' }, G: { id: 'portao', nome: 'Portão de Raízes' },
        c: { id: 'caderno', nome: 'Caderno de musgo' }, M: { id: 'cogumelos', nome: 'Cogumelos vermelhos' }, o: { id: 'coruja', nome: 'Coruja Sábia' }
      },
      decoracoes: {}
    }
  };

  WowGames.MundoDados = { versao: 1, REGIOES, PONTOS, REGISTROS, SIMBOLOS, ORDEM_PORTAO, CRISTAIS, REACOES, PROVAS, ESTRELAS, MISSOES, SEGREDOS, ECOS_NECESSARIOS, AREAS };
})();
