/* Jogo 7: O Caso #001, O Colar Desaparecido.
   Todo o conteúdo (locais, pistas, suspeitos, teorias, solução) está nos blocos de dados no topo.
   Para criar outro caso, copie este arquivo e troque os dados. */
(function () {
  const K_ESTADO = 'wowgames.caso001.estado', K_NOTAS = 'wowgames.caso001.notas', K_REC = 'wowgames.caso001.recordes';
  const MIN_PISTAS = 8;               // pistas necessárias para liberar a acusação
  const CULPADO = 'daniel', TEORIA_CERTA = 'b';

  /* ---------- DADOS: locais e objetos investigáveis (clue = id da pista, ou null) ---------- */
  const LOCAIS = {
    sala: { icone: '🛋️', nome: 'Sala', desc: 'Música baixa, taças no ar e um bolo ainda intacto. A festa continua, mas o clima mudou.', objs: [
      { id: 'camera', icone: '📷', nome: 'A câmera de Bruno', clue: 'S3', texto: 'Está sobre o aparador, com a tela acesa. Você percorre as fotos: das 21:32 às 22:08 são dezenas, todas do mesmo ponto da sala, com poucos instantes entre uma e outra. Ana, Clara e Eduardo aparecem em todas.' },
      { id: 'mural', icone: '🖼️', nome: 'O mural de fotos', clue: 'S1', texto: 'Bruno imprimiu a foto do brinde, das 21:41, e prendeu no mural. Otávio, Ana, Clara e Eduardo erguem as taças. Ao fundo, o carrinho de bebidas está sem ninguém e o balde de gelo continua cheio.' },
      { id: 'pasta', icone: '💼', nome: 'A pasta de Eduardo', clue: 'S2', texto: 'Está aberta sobre a poltrona. Dentro, uma carta com a proposta de Eduardo para comprar o colar, com um “RECUSADO” escrito à mão por Otávio.' },
      { id: 'sofa', icone: '🛋️', nome: 'O sofá', clue: null, texto: 'Almofadas no lugar e nada entre elas além de um guardanapo. Não há nada de útil aqui.' }
    ] },
    cozinha: { icone: '🍽️', nome: 'Cozinha', desc: 'Louça empilhada e cheiro de baunilha. Marta, a cozinheira, já foi embora.', objs: [
      { id: 'chaves', icone: '🔑', nome: 'O quadro de chaves', clue: 'K1', texto: 'Ganchos etiquetados: despensa, portão, garagem. O gancho “Escritório (reserva)” está vazio.' },
      { id: 'cron', icone: '📋', nome: 'O cronograma da festa', clue: 'K2', texto: 'Preso na geladeira: “21:40 brinde na sala. 21:50 parabéns, todos na sala. Marta folga a partir das 20:30. Serviço e bolo: Daniel.”' },
      { id: 'bolo', icone: '🍰', nome: 'O bolo', clue: null, texto: 'Um bolo de baunilha pronto e uma caixa de velas aberta ao lado. Nada fora do lugar.' }
    ] },
    escritorio: { icone: '📚', nome: 'Escritório', desc: 'Estantes escuras e cheiro de papel antigo. Era aqui que o colar estava.', objs: [
      { id: 'janela', icone: '🪟', nome: 'A janela', clue: 'E1', texto: 'Está aberta, com a cortina balançando. No parapeito há uma marca de terra seca, como se alguém tivesse passado por ali.' },
      { id: 'vaso', icone: '🪴', nome: 'O vaso ao lado da janela', clue: 'E5', texto: 'Uma samambaia. A terra está remexida e falta um punhado num canto. É o mesmo tipo de terra seca que está no parapeito.' },
      { id: 'caixa', icone: '📦', nome: 'A caixa do colar', clue: 'E2', texto: 'Uma caixa de madeira sobre a mesa, vazia. A fechadura está intacta, sem arranhões: foi aberta com a chave. A chave pequena fica na primeira gaveta da mesa, que está entreaberta.' },
      { id: 'porta', icone: '🚪', nome: 'A fechadura da porta', clue: 'E3', texto: 'Otávio contou que a porta estava trancada às 22:10 e que a abriu com a própria chave. A fechadura não tem arranhões nem sinais de força.' },
      { id: 'agenda', icone: '📅', nome: 'A agenda de Otávio', clue: 'E4', texto: 'Aberta no sábado: “21:30 – conferir o colar e trancar o escritório. 21:40 – brinde. 21:50 – parabéns (todos na sala).”' }
    ] },
    quarto: { icone: '🛏️', nome: 'Quarto', desc: 'O quarto de Otávio, arrumado e silencioso.', objs: [
      { id: 'portachaves', icone: '🗝️', nome: 'O porta-chaves da cômoda', clue: 'Q2', texto: 'Tem uma etiqueta escrita por Otávio: “Escritório – só duas chaves: a minha, que não largo, e a reserva, no quadro da cozinha.”' },
      { id: 'bilhete', icone: '✉️', nome: 'O bilhete na mesinha', clue: 'Q1', texto: 'Um bilhete dobrado: “Otávio, preciso falar da minha parte da herança. Estou apertada e você sabe disso. – C.”' },
      { id: 'armario', icone: '👔', nome: 'O armário', clue: null, texto: 'Ternos, caixas de sapato e um cheiro de cedro. Nada que ajude no caso.' }
    ] },
    jardim: { icone: '🌳', nome: 'Jardim', desc: 'Noite fresca, luzes baixas e cheiro de terra molhada.', objs: [
      { id: 'canteiro', icone: '🌱', nome: 'O canteiro sob a janela', clue: 'J1', texto: 'O canteiro logo abaixo da janela do escritório está liso e úmido, com marcas de rastelo. Não há pegadas, nem marca de escada, nem terra revirada.' },
      { id: 'banco', icone: '🪑', nome: 'O banco do jardim', clue: 'J2', texto: 'Há uma taça com marca de batom e um lenço perfumado. O banco fica de frente para a janela do escritório.' },
      { id: 'servico', icone: '🚪', nome: 'A porta de serviço', clue: null, texto: 'Está trancada por dentro, com a chave na fechadura. Ninguém passou por ela.' }
    ] }
  };

  /* ---------- DADOS: pistas (sus = suspeitos relacionados) ---------- */
  const PISTAS = {
    E1: { local: 'escritorio', titulo: 'Janela aberta e marca no parapeito', sus: [], nota: 'A janela do escritório estava aberta, com terra seca no parapeito. Parece que alguém entrou por fora.' },
    E5: { local: 'escritorio', titulo: 'Vaso mexido perto da janela', sus: [], nota: 'A terra do vaso do escritório foi remexida. É igual à terra da marca no parapeito.' },
    J1: { local: 'jardim', titulo: 'Canteiro sem pegadas', sus: [], nota: 'Sob a janela, o canteiro está liso, sem pegadas nem marca de escada.' },
    E2: { local: 'escritorio', titulo: 'Caixa aberta sem arrombamento', sus: ['ana', 'clara', 'daniel'], nota: 'A caixa foi aberta com a chave, que fica numa gaveta da mesa. A gaveta estava entreaberta.' },
    E3: { local: 'escritorio', titulo: 'Porta trancada, sem sinais de força', sus: [], nota: 'A porta estava trancada e a fechadura está intacta. Usaram uma chave.' },
    Q2: { local: 'quarto', titulo: 'Só duas chaves do escritório', sus: [], nota: 'Existem duas chaves do escritório: a de Otávio e a reserva, que fica no quadro da cozinha.' },
    K1: { local: 'cozinha', titulo: 'Chave reserva fora do quadro', sus: ['clara', 'daniel'], nota: 'No quadro de chaves da cozinha, o gancho da chave reserva do escritório está vazio.' },
    E4: { local: 'escritorio', titulo: 'Agenda de Otávio', sus: [], nota: 'Otávio trancou o escritório às 21:30. O brinde era às 21:40 e os parabéns às 21:50, com todos na sala.' },
    K2: { local: 'cozinha', titulo: 'Cronograma da festa', sus: ['daniel'], nota: 'O cronograma da cozinha repete os horários. Marta saiu às 20:30 e só Daniel cuida do serviço.' },
    S3: { local: 'sala', titulo: 'Fotos da câmera de Bruno', sus: ['ana', 'bruno', 'clara', 'eduardo'], nota: 'De 21:32 a 22:08, as fotos mostram Ana, Clara e Eduardo na sala o tempo todo. Bruno fotografava do mesmo ponto.' },
    S1: { local: 'sala', titulo: 'Foto do brinde', sus: ['ana', 'clara', 'daniel', 'eduardo'], nota: 'Na foto das 21:41, o carrinho de bebidas está abandonado e o gelo está cheio.' },
    S2: { local: 'sala', titulo: 'Proposta recusada de Eduardo', sus: ['eduardo'], nota: 'Eduardo tentou comprar o colar e Otávio recusou.' },
    Q1: { local: 'quarto', titulo: 'Bilhete sobre a herança', sus: ['clara'], nota: 'Um bilhete assinado “C.” pede dinheiro a Otávio e fala da herança.' },
    J2: { local: 'jardim', titulo: 'Taça no banco do jardim', sus: ['ana'], nota: 'No banco do jardim há uma taça com o batom de Ana. Ela disse que não saiu da sala.' }
  };
  const N = Object.keys(PISTAS).length;

  /* ---------- DADOS: suspeitos (extras só aparecem depois da pista indicada em req) ---------- */
  const SUSPEITOS = [
    { id: 'ana', nome: 'Ana', papel: 'Amiga da família', desc: 'Conhece a casa há vários anos e foi convidada para a festa.', pers: 'Simpática e aparentemente tranquila.',
      fala: [['Você', 'Onde você estava quando o colar sumiu?'], ['Ana', 'Na sala, conversando com todo mundo. Não saí de lá a noite inteira.'], ['Ana', 'O Otávio é quase da minha família. Eu jamais faria isso.']],
      extras: [{ req: 'J2', t: 'Tá bom, saí um pouco para atender minha irmã no jardim, por volta das 21:15. Voltei às 21:30, antes de trancarem o escritório. Só não quis parecer suspeita.' },
               { req: 'S3', t: 'Pode olhar as fotos: depois que voltei, não saí mais da sala.' }] },
    { id: 'bruno', nome: 'Bruno', papel: 'Fotógrafo contratado', desc: 'Registra a festa e circula pelos cômodos com a câmera.', pers: 'Comunicativo e observador.',
      fala: [['Você', 'O senhor andou bastante pela casa, não?'], ['Bruno', 'É o meu trabalho. Mas desde as 21:30 fico na sala, é onde está a festa.'], ['Bruno', 'Por volta das 21:25 vi o Eduardo no corredor do escritório. Disse que procurava o banheiro.']],
      extras: [{ req: 'S3', t: 'Minhas fotos não mentem. Se eu tivesse saído da sala, haveria um buraco na sequência.' },
               { req: 'S2', t: 'Ouvi o Eduardo comentar que o Otávio recusou uma proposta dele. Ficou irritado, mas riu depois.' }] },
    { id: 'clara', nome: 'Clara', papel: 'Irmã do dono', desc: 'Conhece cada canto da mansão e circula livremente por ela.', pers: 'Reservada.',
      fala: [['Você', 'Onde você estava?'], ['Clara', 'Na sala, quase o tempo todo. Às 21:20 passei pelo corredor para ir ao banheiro. A porta do escritório estava fechada.'], ['Clara', 'Não me peça para fingir que estou chocada. Meu irmão guarda coisas demais.']],
      extras: [{ req: 'Q1', t: 'O bilhete? Pedi ajuda ao meu irmão. É assunto de família, não motivo de crime.' },
               { req: 'S3', t: 'Eu estava na sala, todo mundo me viu. Confira com o fotógrafo.' }] },
    { id: 'daniel', nome: 'Daniel', papel: 'Funcionário da casa', desc: 'Conhece a rotina da mansão e circula por áreas que os convidados não acessam.', pers: 'Educado e discreto.',
      fala: [['Você', 'Como foi a sua noite?'], ['Daniel', 'Servi as bebidas e cuidei do bolo, entre a cozinha e a sala. A Marta saiu cedo, então fiquei sozinho com o serviço.'], ['Daniel', 'Vi o senhor Eduardo no corredor do escritório umas 21:25. Estranhei, mas convidados se perdem.']],
      extras: [{ req: 'S1', t: 'Ah, a foto do brinde? Fui buscar gelo na cozinha. Foi rápido, uns minutos.' },
               { req: 'K1', t: 'O quadro de chaves? Está à vista de quem entra na cozinha. Eu não toquei em nada.' },
               { req: 'K2', t: 'O cronograma? Fui eu que afixei. Fazer a festa andar no horário é o meu trabalho.' },
               { req: 'J1', t: 'Rastelei e reguei os canteiros às 19h, como todo sábado. Depois disso ninguém mexeu ali.' }] },
    { id: 'eduardo', nome: 'Eduardo', papel: 'Empresário convidado', desc: 'Conversou com várias pessoas e não conhece a casa tão bem quanto os outros.', pers: 'Confiante e muito convincente.',
      fala: [['Você', 'O senhor conhece a casa?'], ['Eduardo', 'Pouco. Vim a convite, mal sei onde fica o banheiro.'], ['Eduardo', 'Passei a noite na sala, entre uma conversa e outra. Não tenho nada a esconder.']],
      extras: [{ req: 'S2', t: 'A carta? Fiz uma oferta justa pelo colar e ele recusou. Eu não roubo o que posso comprar.' },
               { req: 'S3', t: 'Estive à vista de todos a noite toda. Pergunte ao fotógrafo.' }] }
  ];

  const TEORIAS = [
    { id: 'a', texto: 'Entrou pela janela, vindo do jardim.' },
    { id: 'b', texto: 'Usou uma chave e o conhecimento da casa durante o brinde, e abriu a janela para simular uma invasão.' },
    { id: 'c', texto: 'Forçou a porta e a caixa no meio da confusão da festa.' },
    { id: 'd', texto: 'Levou o colar antes da festa e só fingiu o desaparecimento depois.' }
  ];

  const SOLUCAO = `
    <p><b>O culpado foi Daniel.</b> O cronograma mostrava que, no brinde e nos parabéns, todos estariam na sala e o escritório ficaria vazio. Enquanto a festa acontecia, ele pegou a chave reserva no quadro da cozinha, abriu a porta, pegou a chave da caixa na gaveta, levou o colar e trancou tudo de novo. Para parecer um roubo vindo de fora, abriu a janela e espalhou terra do vaso no parapeito.</p>
    <h4>Pistas que revelam a verdade</h4>
    <ul>
      <li>A janela era encenação: a terra do parapeito é do vaso do escritório e o canteiro lá fora está intacto, sem pegadas.</li>
      <li>A porta estava trancada e a caixa não foi arrombada, então usaram chaves. Só existem duas chaves do escritório; Otávio estava com a dele, e a reserva sumiu do quadro da cozinha.</li>
      <li>O cronograma e a agenda indicam o momento em que o escritório ficaria vazio.</li>
      <li>Nas fotos todos estavam na sala, menos Daniel. O carrinho ficou abandonado e o gelo intocado, o que contradiz a desculpa dele.</li>
    </ul>
    <h4>Por que os outros não</h4>
    <ul>
      <li><b>Ana</b> mentiu sobre ter ido ao jardim, mas voltou às 21:30, antes do roubo.</li>
      <li><b>Bruno</b> aparece fotografando da sala sem interrupção.</li>
      <li><b>Clara</b> tinha motivo (o bilhete), mas está em todas as fotos.</li>
      <li><b>Eduardo</b> tinha motivo (a proposta recusada) e foi visto no corredor às 21:25, antes de o escritório ser trancado. Também está em todas as fotos.</li>
    </ul>`;

  /* ---------- Utilidades ---------- */
  const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) || padrao; } catch (e) { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const novoEstado = () => ({ fase: 'intro', pistas: [], vistos: [], vistosObj: [], erros: 0, acum: 0, local: 'sala', resultado: null });
  const mmss = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const pts = n => n.toLocaleString('pt-BR');
  const falas = a => a.map(([q, t]) => `<p class="ca-fala"><b>${q}:</b> ${t}</p>`).join('');
  const LOCK = '<div class="ca-lock">🔐 Informação bloqueada<small>Encontre uma pista relacionada a este suspeito para descobrir mais.</small></div>';
  const ABAS = [['investigar', '🔎 Investigar'], ['locais', '📍 Locais'], ['pistas', '📁 Pistas'], ['suspeitos', '👤 Suspeitos'], ['notas', '📝 Anotações'], ['acusacao', '⚖️ Acusação']];

  WowGames.register({
    id: 'caso001', nome: 'O Caso #001', icone: '🔎', cor: '#b9a2ff',
    desc: 'O Colar Desaparecido. Explore a mansão, interrogue os suspeitos e descubra quem roubou.',

    mount(el) {
      let S = Object.assign(novoEstado(), ler(K_ESTADO, {}));
      let aba = 'investigar', sel = null, susSel = null, acSus = null, acTeo = null, errou = false, novaPista = null, iv = 0, t0 = performance.now();
      const decorrido = () => S.acum + (S.fase === 'jogando' ? performance.now() - t0 : 0);
      const guardar = () => { S.acum = decorrido(); t0 = performance.now(); gravar(K_ESTADO, S); };

      /* ---------- Telas ---------- */
      function telaIntro() {
        const r = ler(K_REC, null);
        return `<div class="ca-capa">📁</div><h2>O CASO #001</h2><h3>O Colar Desaparecido</h3>
          <p>Uma festa na mansão de Otávio. Um colar valioso. Cinco suspeitos. Você é o detetive.</p>
          <div class="ca-dialogo">${falas([
            ['Otávio', 'Guardei o colar numa caixa no escritório e tranquei a porta às 21:30.'],
            ['Otávio', 'Às 22:10 fui buscá-lo para mostrar aos convidados. A janela estava aberta e a caixa, vazia.'],
            ['Otávio', 'Ninguém vai embora sem que eu saiba o que aconteceu. Descubra a verdade.']])}</div>
          ${r ? `<p class="ca-rec">🏅 Melhor tempo: <b>${mmss(r.melhorTempo)}</b> | Melhor pontuação: <b>${pts(r.melhorPontos)}</b> | Casos resolvidos: <b>${r.resolvidos}</b></p>` : ''}
          <button class="btn big" data-a="iniciar">🔎 Iniciar investigação</button>`;
      }

      function vInvestigar() {
        const L = LOCAIS[S.local], o = L.objs.find(x => x.id === sel);
        let h = `<p>${L.desc}</p><div class="ca-objs">${L.objs.map(x => {
          const tem = x.clue && S.pistas.includes(x.clue);
          return `<button class="ca-obj ${sel === x.id ? 'sel' : ''} ${S.vistosObj.includes(x.id) ? 'vis' : ''}" data-a="obj" data-v="${x.id}"><span>${x.icone}</span>${x.nome}${tem ? '<small>✓ pista anotada</small>' : ''}</button>`;
        }).join('')}</div>`;
        if (o) {
          const tem = o.clue && S.pistas.includes(o.clue);
          h += `<div class="ca-painel ca-pop ${novaPista === o.clue ? 'nova' : ''}"><p><i>Você examina ${o.nome.charAt(0).toLowerCase() + o.nome.slice(1)}.</i></p><p>${o.texto}</p>` +
            (o.clue ? (tem ? '<p class="ca-ok">✓ Pista adicionada ao caderno</p>' : `<button class="btn" data-a="add" data-v="${o.clue}">📌 Adicionar pista</button>`) : '') + '</div>';
        }
        return h;
      }

      function vLocais() {
        return `<p>Para onde você quer ir?</p><div class="ca-objs">${Object.keys(LOCAIS).map(id => {
          const L = LOCAIS[id], n = L.objs.filter(x => S.vistosObj.includes(x.id)).length;
          return `<button class="ca-obj ${id === S.local ? 'sel' : ''}" data-a="ir" data-v="${id}"><span>${L.icone}</span>${L.nome}<small>${id === S.local ? 'Você está aqui' : n + '/' + L.objs.length + ' examinados'}</small></button>`;
        }).join('')}</div>`;
      }

      function vPistas() {
        const lista = S.pistas.map(id => `<li><b>✓ ${PISTAS[id].titulo}</b> <small>${LOCAIS[PISTAS[id].local].icone}</small><br>${PISTAS[id].nota}</li>`).join('');
        return `<h3>🔎 PISTAS ENCONTRADAS</h3><p>Pistas encontradas: <b>${S.pistas.length}/${N}</b></p>` +
          (lista ? `<ul class="ca-lista">${lista}</ul>` : '<p>Você ainda não encontrou nenhuma pista. Examine objetos nos locais.</p>');
      }

      function vSuspeitos() {
        const s = SUSPEITOS.find(x => x.id === susSel);
        let h = `<div class="ca-objs">${SUSPEITOS.map(x => `<button class="ca-obj ${susSel === x.id ? 'sel' : ''}" data-a="sus" data-v="${x.id}"><span>👤</span>${x.nome}${S.vistos.includes(x.id) ? '' : '<small>não investigado</small>'}</button>`).join('')}</div>`;
        if (!s) return h + '<p>Toque em um suspeito para ver o perfil e o depoimento.</p>';
        const rel = S.pistas.filter(id => PISTAS[id].sus.includes(s.id));
        return h + `<div class="ca-painel ca-pop"><h3>👤 ${s.nome}</h3><p><b>${s.papel}.</b> ${s.desc}</p><p><i>Personalidade: ${s.pers}</i></p>
          <h4>Depoimento</h4>${falas(s.fala)}
          <h4>Informações descobertas</h4>${s.extras.map(x => S.pistas.includes(x.req) ? falas([[s.nome, x.t]]) : LOCK).join('')}
          <h4>Pistas relacionadas</h4>${rel.length ? `<ul class="ca-lista">${rel.map(id => `<li>${PISTAS[id].titulo}</li>`).join('')}</ul>` : '<p>Nenhuma pista relacionada ainda.</p>'}</div>`;
      }

      function vNotas() {
        return '<h3>📝 ANOTAÇÕES</h3><p>Escreva suas teorias. O texto é salvo automaticamente neste navegador.</p><textarea id="ca-notas" class="ca-notas" rows="9" placeholder="Quem esteve onde? O que não bate?"></textarea>';
      }

      function vAcusacao() {
        if (S.pistas.length < MIN_PISTAS) return `<div class="ca-painel"><h3>⚖️ ACUSAÇÃO</h3><p>🔐 Investigue mais antes de acusar alguém. Pistas encontradas: <b>${S.pistas.length}</b> (mínimo de ${MIN_PISTAS}).</p></div>`;
        if (errou) return `<div class="ca-painel ca-pop erro"><h3>❌ ACUSAÇÃO INCORRETA</h3><p>As provas não sustentam essa versão. A investigação ainda não terminou: continue procurando pistas e compare os depoimentos.</p><p>Acusações incorretas: <b>${S.erros}</b>. Cada uma diminui a pontuação.</p><button class="btn" data-a="voltar">Voltar à investigação</button></div>`;
        return `<h3>⚖️ ACUSAÇÃO</h3><p><b>Quem você acredita que roubou o colar?</b></p>
          <div class="ca-objs">${SUSPEITOS.map(s => `<button class="ca-obj ${acSus === s.id ? 'sel' : ''}" data-a="sp" data-v="${s.id}"><span>👤</span>${s.nome}</button>`).join('')}</div>
          <p><b>Como você acredita que o roubo aconteceu?</b></p>
          <div class="ca-teorias">${TEORIAS.map(t => `<button class="ca-teoria ${acTeo === t.id ? 'sel' : ''}" data-a="st" data-v="${t.id}"><b>${t.id.toUpperCase()})</b> ${t.texto}</button>`).join('')}</div>
          <button class="btn big" data-a="acusar" ${acSus && acTeo ? '' : 'disabled'}>⚖️ Acusar</button>
          <p>Acusações incorretas até agora: <b>${S.erros}</b></p>`;
      }

      function telaJogo() {
        const corpo = { investigar: vInvestigar, locais: vLocais, pistas: vPistas, suspeitos: vSuspeitos, notas: vNotas, acusacao: vAcusacao }[aba]();
        const L = LOCAIS[S.local];
        return `<header class="ca-head"><div><small>🔎 O CASO #001</small><h2>O Colar Desaparecido</h2></div>
            <div class="ca-prog"><span>⏱️ <b id="ca-t">${mmss(decorrido())}</b></span><span>🔎 <b>${S.pistas.length}</b>/${N}</span><span>👤 <b>${S.vistos.length}</b>/${SUSPEITOS.length}</span></div></header>
          <p class="ca-loc">📍 Local atual: <b>${L.icone} ${L.nome}</b></p>
          <nav class="ca-abas">${ABAS.map(([id, nome]) => `<button class="ca-aba ${aba === id ? 'on' : ''}" data-a="aba" data-v="${id}">${nome}</button>`).join('')}</nav>
          <div class="ca-corpo ca-fade">${corpo}</div>
          <button class="link" data-a="reiniciar">Reiniciar investigação</button>`;
      }

      function telaFim() {
        const r = S.resultado, rec = ler(K_REC, { resolvidos: 1 });
        return `<div class="ca-capa ca-pop">🔎</div><h2>CASO RESOLVIDO</h2><p>Você descobriu quem roubou o colar!</p>
          <div class="tp-res"><div>⏱️ Tempo<b>${mmss(r.tempo)}</b></div><div>🔎 Pistas<b>${S.pistas.length}/${N}</b></div><div>❌ Erros<b>${S.erros}</b></div></div>
          <p class="ca-estrela">⭐ ${pts(r.pontos)} pontos</p>
          ${WowGames.Pontos ? WowGames.Pontos.html(r.pt) : ''}
          <p class="ca-rec">${r.recTempo ? '🏅 Novo melhor tempo! ' : ''}${r.recPontos ? '🏅 Nova melhor pontuação! ' : ''}Casos resolvidos: <b>${rec.resolvidos}</b></p>
          <div class="ca-painel"><h3>A solução</h3>${SOLUCAO}</div>
          <p>Dá para chegar ao culpado mais rápido e com menos erros. Jogue de novo e tente superar seu recorde.</p>
          <button class="btn big" data-a="novo">Jogar novamente</button>`;
      }

      function render() {
        clearInterval(iv);
        el.innerHTML = `<div class="ca">${S.fase === 'intro' ? telaIntro() : S.fase === 'fim' ? telaFim() : telaJogo()}</div>`;
        novaPista = null;
        if (S.fase === 'jogando') {
          const n = el.querySelector('#ca-notas'); if (n) n.value = ler(K_NOTAS, '');
          iv = setInterval(() => { const t = el.querySelector('#ca-t'); if (t) t.textContent = mmss(decorrido()); }, 500);
        }
      }

      /* ---------- Ações ---------- */
      function reiniciar() {
        S = novoEstado(); gravar(K_ESTADO, S); gravar(K_NOTAS, '');
        aba = 'investigar'; sel = susSel = acSus = acTeo = null; errou = false;
      }

      function acusar() {
        if (!acSus || !acTeo) return false;
        if (acSus !== CULPADO || acTeo !== TEORIA_CERTA) { S.erros++; errou = true; guardar(); return false; }
        S.acum = decorrido(); S.fase = 'fim';
        const pontos = Math.max(0, Math.round(10000 - (S.acum / 1000) * 4 - S.erros * 1000 + S.pistas.length * 50));
        const rec = Object.assign({ melhorTempo: null, melhorPontos: 0, resolvidos: 0 }, ler(K_REC, {}));
        const recTempo = rec.melhorTempo === null || S.acum < rec.melhorTempo, recPontos = pontos > rec.melhorPontos;
        if (recTempo) rec.melhorTempo = S.acum;
        if (recPontos) rec.melhorPontos = pontos;
        rec.resolvidos++;
        S.resultado = { tempo: S.acum, pontos, recTempo, recPontos };
        const rp = WowGames.evento({ jogo: 'caso001', tipo: 'fim', partida: true, tempo: S.acum / 1000, erros: S.erros, pontos, pistas: S.pistas.length });
        if (rp && rp.base > 0) S.resultado.pt = { pontos: rp.pontos, base: rp.base, total: rp.total, reduzido: rp.reduzido };
        gravar(K_REC, rec); gravar(K_ESTADO, S);
        return true;
      }

      el.oninput = e => { if (e.target.id === 'ca-notas') gravar(K_NOTAS, e.target.value); };
      el.onclick = e => {
        const b = e.target.closest('[data-a]');
        if (!b || b.disabled) return;
        const v = b.dataset.v;
        let festa = false;
        switch (b.dataset.a) {
          case 'iniciar': S.fase = 'jogando'; t0 = performance.now(); guardar(); break;
          case 'aba': aba = v; errou = false; break;
          case 'ir': S.local = v; aba = 'investigar'; sel = null; guardar(); break;
          case 'obj': sel = v; if (!S.vistosObj.includes(v)) S.vistosObj.push(v); guardar(); break;
          case 'add': if (!S.pistas.includes(v)) S.pistas.push(v); novaPista = v; guardar(); break;
          case 'sus': susSel = v; if (!S.vistos.includes(v)) S.vistos.push(v); guardar(); break;
          case 'sp': acSus = v; break;
          case 'st': acTeo = v; break;
          case 'acusar': festa = acusar(); break;
          case 'voltar': errou = false; aba = 'investigar'; break;
          case 'novo': reiniciar(); break;
          case 'reiniciar': if (!confirm('Apagar o progresso e começar a investigação do zero?')) return; reiniciar(); break;
        }
        render();
        if (festa) WowGames.confetti(el, ['🔎', '✨', '🎉']);
      };

      render();
      return () => { if (S.fase === 'jogando') guardar(); clearInterval(iv); };
    }
  });
})();
