/* wow.world — INTERFACE: mapa ilustrado, cenas das regiões, mecanismos, missões, diário e as duas áreas com personagem.
   Página interna #/mundo (WowGames.registerPage), como Perfil, Conquistas e Placar. Banner na página inicial: WowGames.Mundo.bannerHtml().
   Toda regra e todo salvamento ficam em mundo-estado.js; aqui só se mostra o estado e se chamam as ações validadas. */
(function () {
  const MD = WowGames.MundoDados, E = WowGames.MundoEstado, AR = WowGames.MundoAreas;
  if (!MD || !E || !AR) { console.error('[wow.world] arquivos de dados/estado/áreas não carregados.'); return; }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const regiao = id => MD.REGIOES.find(r => r.id === id);
  const todosPontos = () => Object.values(MD.PONTOS).flat();
  let handler = null;                                                  // tela aberta que quer saber das novidades
  E.aoMudar((rotulo, novidades) => { if (handler) handler(rotulo, novidades); });

  const TXT_NOVIDADE = {
    simbolo: n => `Símbolo descoberto: ${MD.SIMBOLOS[n.id].icone} ${MD.SIMBOLOS[n.id].nome}`, portao: () => '🌿 O Portão de Raízes se abriu!',
    cristal: n => `${MD.CRISTAIS.find(c => c.id === n.id).icone} ${MD.CRISTAIS.find(c => c.id === n.id).nome} despertou!`, antigos: () => '🚪 O Portão dos Antigos se abriu!',
    segredo: n => `🗝️ Segredo encontrado: ${MD.SEGREDOS.find(s => s.id === n.id).nome}!`, camara: () => '🔮 A Câmara do Primeiro Eco se abriu!',
    reacao: n => `⚗️ Nova energia elemental: ${MD.REACOES[n.id]}`, prova: n => `⚔️ Prova registrada: ${MD.PROVAS[n.id]}`, tempo: () => '⏱️ O sino da praça parece atento a você…',
    missao: n => `🗺️ Missão concluída: ${n.nome}`, segredos: () => '🗝️ Você encontrou todos os segredos!'
  };

  /* ---------- Banner da página inicial ---------- */
  function bannerHtml() {
    const ms = E.missoes(), feitas = ms.filter(m => m.estado === 'concluida').length, visit = Object.keys(E.dados().visitadas).length;
    return `<section class="wow-world-banner"><div class="wow-world-banner-arte" aria-hidden="true">🏝️🌲🔭</div>
      <div><small>NOVO · EXPLORAÇÃO</small><h2>wow.world</h2><p>Um mundo de fantasia que liga os jogos do site. ${visit ? `Missões: <b>${feitas}/${ms.length}</b> · Ecos: <b>${E.nEcos()}</b>` : 'Explore cinco regiões, descubra segredos e abra a câmara esquecida.'}</p></div>
      <a class="btn" href="#/mundo">${visit ? 'Continuar explorando' : 'Explorar'}</a></section>`;
  }

  /* ---------- Página ---------- */
  function pagina(el) {
    let tela = 'mapa', reg = null, sel = null, msg = null, areaCtl = null, areaId = null, dialogo = null, seqPortao = [], seqEstrelas = [], flashTo = 0;
    const av = E.aviso(); if (av) msg = { ok: false, txt: av };

    function topo() {
      const ms = E.missoes(), feitas = ms.filter(m => m.estado === 'concluida').length, erro = E.erro();
      return `<header class="wow-world-topo">
        <div class="wow-world-titulo"><span aria-hidden="true">🗺️</span><div><h2>wow.world</h2><small>Missões ${feitas}/${ms.length} · Ecos ${E.nEcos()} · Torre nível ${E.nivelTorre()}</small></div></div>
        <nav class="wow-world-abas" aria-label="Seções do wow.world">
          <button class="wow-world-aba ${tela === 'mapa' || tela === 'regiao' ? 'on' : ''}" data-w="mapa">🗺️ Mapa</button>
          <button class="wow-world-aba ${tela === 'missoes' ? 'on' : ''}" data-w="missoes">📜 Missões</button>
          <button class="wow-world-aba ${tela === 'diario' ? 'on' : ''}" data-w="diario">📖 Diário</button>
        </nav></header>
        ${erro ? `<p class="wow-world-msg erro" role="alert">⚠️ ${esc(erro)}</p>` : ''}
        ${msg ? `<p class="wow-world-msg ${msg.ok ? 'ok' : 'erro'}" role="status">${esc(msg.txt)}</p>` : ''}
        <div class="wow-world-flash" id="ww-flash" role="status" aria-live="polite" hidden></div>`;
    }
    function render() {
      if (areaCtl && tela !== 'area') { areaCtl.destruir(); areaCtl = null; }
      const corpo = tela === 'mapa' ? mapaHtml() : tela === 'regiao' ? regiaoHtml() : tela === 'missoes' ? missoesHtml() : tela === 'diario' ? diarioHtml() : '';
      el.innerHTML = `<div class="wow-world">${topo()}${corpo}</div>`;
      msg = null;
    }
    function flash(lista) {
      const box = el.querySelector('#ww-flash'); if (!box || !lista.length) return;
      box.innerHTML = lista.map(n => `<span>✨ ${esc((TXT_NOVIDADE[n.tipo] || (() => 'Nova descoberta!'))(n))}</span>`).join('');
      box.hidden = false; box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
      clearTimeout(flashTo); flashTo = setTimeout(() => { const b = el.querySelector('#ww-flash'); if (b) b.hidden = true; }, 3200);
    }
    let pendentes = [], agendado = 0;
    handler = (rotulo, novidades) => {                                 // atualiza depois do clique atual, para o aviso não se perder
      pendentes = pendentes.concat(novidades || []);
      if (tela === 'area') { if (areaCtl) areaCtl.atualizarFundo(); atualizarHudArea(); }
      clearTimeout(agendado);
      agendado = setTimeout(() => { if (tela !== 'area') render(); flash(pendentes); pendentes = []; }, 0);
    };

    /* ======================= MAPA ======================= */
    function mapaHtml() {
      const s = E.dados(), conste = !!s.segredos.constelacao;
      return `<section class="wow-world-mapa" aria-label="Mapa do mundo">
        <svg class="wow-world-mapa-arte" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">
          <defs><radialGradient id="ww-mar" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#7fd1ff"/><stop offset="1" stop-color="#3a6fd8"/></radialGradient>
            <radialGradient id="ww-ilha" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#c5f08a"/><stop offset="1" stop-color="#5aa36b"/></radialGradient></defs>
          <rect width="100" height="70" fill="url(#ww-mar)"/>
          ${[[12, 8], [30, 5], [60, 6], [88, 10], [70, 3], [45, 11]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".45" fill="#fff" opacity=".85"/>`).join('')}
          ${conste ? '<polyline points="30,5 60,6 88,10" fill="none" stroke="#ffe14d" stroke-width=".35" stroke-dasharray="1 .6"/>' : ''}
          <path d="M50 39 Q35 30 20 24 M50 39 Q65 30 79 21 M50 39 Q35 48 22 54 M50 39 Q66 47 80 54" fill="none" stroke="#fff3c4" stroke-width="1.1" stroke-dasharray="2 1.4" opacity=".9"/>
          <ellipse cx="50" cy="40" rx="15" ry="9" fill="url(#ww-ilha)" stroke="#1c1840" stroke-width=".5"/>
          <ellipse cx="20" cy="24" rx="15" ry="10" fill="#3f9a5c" stroke="#1c1840" stroke-width=".5"/>
          ${[[13, 21], [18, 18], [24, 20], [27, 26], [15, 28], [21, 27]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.1" fill="#24663a"/>`).join('')}
          <path d="M66 26 L92 26 L90 13 L68 13 Z" fill="#e9b2a0" stroke="#1c1840" stroke-width=".5"/>
          ${[70, 76, 82, 88].map(x => `<rect x="${x}" y="15" width="1.6" height="9" fill="#fff3e8" stroke="#1c1840" stroke-width=".25"/>`).join('')}
          ${[[14, 56, 7], [25, 50, 5], [28, 60, 4]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .6}" fill="#b9e3ff" stroke="#1c1840" stroke-width=".5"/>`).join('')}
          ${MD.CRISTAIS.map((c, i) => `<polygon points="${13 + i * 6},${53 - (i % 2) * 3} ${14.5 + i * 6},${49 - (i % 2) * 3} ${16 + i * 6},${53 - (i % 2) * 3}" fill="${s.cristais[c.id] ? c.cor : '#9aa3b5'}" stroke="#1c1840" stroke-width=".25"/>`).join('')}
          ${s.marcos.ponte ? '<path d="M18 55 Q22 50 26 52" stroke="#ffe14d" stroke-width=".8" fill="none"/>' : ''}
          <ellipse cx="80" cy="56" rx="13" ry="8" fill="#8b84b8" stroke="#1c1840" stroke-width=".5"/>
          <rect x="76" y="44" width="8" height="10" fill="#d8d2f0" stroke="#1c1840" stroke-width=".4"/><path d="M75 45 Q80 38 85 45 Z" fill="#5b4a8a" stroke="#1c1840" stroke-width=".4"/>
          <rect x="47" y="${33 - E.nivelTorre()}" width="6" height="${7 + E.nivelTorre()}" fill="#e9d9b0" stroke="#1c1840" stroke-width=".4"/>
          <path d="M46 ${33 - E.nivelTorre()} L50 ${28 - E.nivelTorre()} L54 ${33 - E.nivelTorre()} Z" fill="#5b4a8a" stroke="#1c1840" stroke-width=".4"/>
          ${E.nivelTorre() >= 5 ? `<circle cx="50" cy="${26.5 - E.nivelTorre()}" r="1.2" fill="#ffe14d"/>` : ''}
        </svg>
        ${MD.REGIOES.map(r => {
          const vis = !!s.visitadas[r.id], prin = !!s.pontos[r.principal];
          return `<button class="wow-world-regiao ${vis ? 'visitada' : ''}" data-w="regiao" data-id="${r.id}" style="left:${r.x}%;top:${r.y}%;--c:${r.cor}" aria-label="${esc(r.nome)}${vis ? ' (visitada)' : ''}">
            <span class="wow-world-reg-ico" aria-hidden="true">${r.icone}</span><b>${esc(r.nome)}</b>${vis ? `<small>${prin ? '✓ explorada' : '★ ponto principal pendente'}</small>` : '<small>não visitada</small>'}</button>`;
        }).join('')}
      </section>
      <p class="wow-world-dica">Toque numa região para visitá-la. Todas estão abertas desde o início; algumas portas e câmaras se abrem com as descobertas.</p>`;
    }

    /* ======================= REGIÃO ======================= */
    function estadoPonto(p) {
      const s = E.dados();
      if (p.tipo === 'portao-floresta') return s.marcos.portaoFloresta ? 'aberto' : 'fechado';
      if (p.tipo === 'portao-antigos') return s.marcos.portaoAntigos ? 'aberto' : 'fechado';
      if (p.tipo === 'camara') return s.marcos.camara ? 'aberto' : 'fechado';
      if (p.tipo === 'cristais') return Object.keys(s.cristais).length ? 'aceso' : '';
      if (p.tipo === 'estrelas') return s.segredos.constelacao ? 'aceso' : '';
      return '';
    }
    function regiaoHtml() {
      const r = regiao(reg), s = E.dados(), pts = MD.PONTOS[reg];
      return `<section class="wow-world-regiao-tela">
        <div class="wow-world-reg-topo"><button class="btn small wow-world-sec" data-w="mapa">← Voltar ao mapa</button><h3>${r.icone} ${esc(r.nome)}</h3></div>
        <p class="wow-world-reg-desc">${esc(r.desc)}</p>
        <div class="wow-world-cena wow-world-cena-${reg}" style="--c:${r.cor}">
          ${cenaArte(reg)}
          ${pts.map(p => {
            const est = estadoPonto(p), prin = p.id === r.principal && !s.pontos[p.id], ico = p.tipo === 'camara' && s.marcos.camara ? '🔓' : p.tipo === 'portao-antigos' && s.marcos.portaoAntigos ? '🏛️' : p.icone;
            return `<button class="wow-world-ponto ${est} ${sel === p.id ? 'sel' : ''} ${s.pontos[p.id] ? 'wow-world-visto' : 'wow-world-novo'}" data-w="ponto" data-id="${p.id}" style="left:${p.x}%;top:${p.y}%" aria-pressed="${sel === p.id}">
              <span aria-hidden="true">${ico}</span><b>${esc(p.nome)}${prin ? ' ★' : ''}</b></button>`;
          }).join('')}
        </div>
        <div class="wow-world-painel" id="ww-painel" aria-live="polite">${sel ? painelPonto(todosPontos().find(p => p.id === sel)) : '<p class="wow-world-dica">Escolha um ponto da cena para examinar. O ponto principal da região está marcado com ★.</p>'}</div>
      </section>`;
    }
    function cenaArte(id) {
      const s = E.dados(), nv = E.nivelTorre();
      const svg = {
        praca: `<rect x="0" y="62" width="100" height="38" fill="#e9d9b0"/><circle cx="50" cy="80" r="11" fill="#7fd1ff" stroke="#1c1840" stroke-width=".6"/>
          <rect x="43" y="${30 - nv * 2}" width="14" height="${34 + nv * 2}" fill="#d9c49a" stroke="#1c1840" stroke-width=".6"/><path d="M40 ${30 - nv * 2} L50 ${14 - nv * 3} L60 ${30 - nv * 2} Z" fill="#5b4a8a" stroke="#1c1840" stroke-width=".6"/>
          ${nv >= 5 ? `<circle cx="50" cy="${10 - nv * 3 + 8}" r="3" fill="#ffe14d"><animate attributeName="r" values="2.5;3.4;2.5" dur="2s" repeatCount="indefinite"/></circle>` : ''}
          ${s.recompensas.m1 ? [12, 30, 70, 88].map(x => `<rect x="${x}" y="55" width="1" height="8" fill="#5a4630"/><circle cx="${x + .5}" cy="55" r="1.8" fill="#ffd96b"/>`).join('') : ''}
          ${s.recompensas.m3 ? `<path d="M5 18 Q50 26 95 18" stroke="#1c1840" stroke-width=".3" fill="none"/>${[10, 20, 30, 40, 60, 70, 80, 90].map((x, i) => `<path d="M${x - 2} ${19 + Math.sin(x / 15) * 2} L${x + 2} ${19 + Math.sin(x / 15) * 2} L${x} ${23 + Math.sin(x / 15) * 2} Z" fill="${['#ff5d73', '#ffc933', '#3ddc97', '#4da3ff'][i % 4]}"/>`).join('')}` : ''}
          ${s.segredos.raiz ? [8, 16, 84, 92].map(x => `<circle cx="${x}" cy="94" r="1.6" fill="#ff5d73"/><circle cx="${x + 2}" cy="92" r="1.3" fill="#ffc933"/>`).join('') : ''}
          ${s.segredos.sino ? '<text x="72" y="40" font-size="7">🔔</text>' : ''}${s.marcos.camara ? '<text x="25" y="38" font-size="6" opacity=".9">🔮</text>' : ''}`,
        floresta: `${[[8, 20], [20, 12], [34, 18], [62, 14], [86, 22], [92, 50], [6, 52], [40, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#24663a" opacity=".9"/><rect x="${x - 1}" y="${y + 7}" width="2" height="8" fill="#6b4520"/>`).join('')}
          <path d="M0 88 Q30 70 55 82 T100 76" stroke="#c9a86b" stroke-width="7" fill="none"/>
          <circle cx="48" cy="30" r="15" fill="#2d7a46" stroke="#1c1840" stroke-width=".5"/><rect x="45" y="40" width="6" height="16" fill="#6b4520"/>
          ${s.marcos.portaoFloresta ? '<path d="M17 66 Q24 50 31 66" stroke="#9be15d" stroke-width="2.5" fill="none"/>' : '<path d="M17 66 Q24 50 31 66 M20 66 L24 54 L28 66" stroke="#6b4520" stroke-width="2.2" fill="none"/>'}
          ${s.segredos.raiz ? '<path d="M60 92 Q70 84 80 92" stroke="#ffe14d" stroke-width="1.2" fill="none"><animate attributeName="opacity" values=".4;1;.4" dur="2s" repeatCount="indefinite"/></path>' : ''}`,
        provas: `<rect x="0" y="58" width="100" height="42" fill="#f2c4b8"/>${[12, 30, 70, 88].map(x => `<rect x="${x - 3}" y="18" width="6" height="42" fill="#fff3e8" stroke="#1c1840" stroke-width=".5"/>`).join('')}
          <path d="M38 50 L38 18 Q50 6 62 18 L62 50 Z" fill="${s.marcos.portaoAntigos ? '#ffe9a8' : '#8c7454'}" stroke="#1c1840" stroke-width=".6"/>
          ${s.marcos.portaoAntigos ? '<path d="M41 50 L41 22 Q50 12 59 22 L59 50 Z" fill="#fffbe0"/>' : '<line x1="50" y1="14" x2="50" y2="50" stroke="#1c1840" stroke-width=".6"/>'}`,
        ilhas: `${[[18, 70, 14], [50, 52, 18], [82, 72, 12]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .45}" fill="#b9e3ff" stroke="#1c1840" stroke-width=".5"/><path d="M${x - r * .8} ${y} Q${x} ${y + r} ${x + r * .8} ${y}" fill="#8a7a6a"/>`).join('')}
          ${MD.CRISTAIS.map((c, i) => `<polygon points="${42 + i * 8},50 ${45 + i * 8},${34 - (i % 2) * 4} ${48 + i * 8},50" fill="${s.cristais[c.id] ? c.cor : '#9aa3b5'}" stroke="#1c1840" stroke-width=".5">${s.cristais[c.id] ? '<animate attributeName="opacity" values=".7;1;.7" dur="1.8s" repeatCount="indefinite"/>' : ''}</polygon>`).join('')}
          ${s.marcos.ponte ? '<path d="M30 68 Q40 56 48 58 M62 58 Q72 58 74 70" stroke="#ffe14d" stroke-width="1.6" fill="none"/>' : ''}`,
        observatorio: `${[[10, 10], [24, 6], [40, 12], [62, 8], [78, 14], [92, 6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".7" fill="#fff"/>`).join('')}
          <rect x="38" y="30" width="24" height="48" fill="#d8d2f0" stroke="#1c1840" stroke-width=".6"/><path d="M34 32 Q50 10 66 32 Z" fill="#5b4a8a" stroke="#1c1840" stroke-width=".6"/>
          <rect x="44" y="64" width="12" height="14" rx="6" fill="${s.marcos.camara ? '#ffe14d' : '#4b4372'}" stroke="#1c1840" stroke-width=".6"/>
          ${s.segredos.constelacao ? '<polyline points="78,32 22,30 30,72" stroke="#ffe14d" stroke-width=".6" fill="none" stroke-dasharray="1.5 1"/>' : ''}`
      }[id];
      const calmo = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
      return `<svg class="wow-world-cena-arte" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${calmo ? svg.replace(/<animate[^>]*\/>/g, '') : svg}</svg>`;
    }

    /* ---------- Conteúdo de cada ponto ---------- */
    function painelPonto(p) {
      const s = E.dados();
      const cab = `<h4>${p.icone} ${esc(p.nome)}</h4>`;
      if (p.tipo === 'lore') { const g = MD.REGISTROS[p.registro]; return `${cab}<blockquote class="wow-world-registro"><b>${esc(g.titulo)}</b><p>${esc(g.texto)}</p></blockquote><p class="wow-world-dica">📖 Registrado no diário.</p>`; }
      if (p.tipo === 'npc') return `${cab}${falas(p.id).map(f => `<p class="wow-world-fala">“${esc(f)}”</p>`).join('')}`;
      if (p.tipo === 'portal') {
        const jogos = (WowGames.jogos ? WowGames.jogos() : []).filter(j => p.jogos === 'todos' || p.jogos.includes(j.id));
        return `${cab}<p>O portal brilha e mostra ${jogos.length === 1 ? 'um destino' : 'vários destinos'}:</p><div class="wow-world-portais">${jogos.map(j => `<a class="wow-world-portal" href="#/${esc(j.id)}" style="--c:${j.cor}"><span>${j.icone}</span>${esc(j.nome)}</a>`).join('')}</div>`;
      }
      if (p.tipo === 'area') return `${cab}<p>Entre com seu personagem para caminhar, conversar e procurar coisas escondidas.</p><p class="wow-world-dica">Setas ou WASD para andar · E para interagir · também há botões na tela.</p><button class="btn big" data-w="entrar" data-id="${p.area}">🚶 Entrar</button>`;
      if (p.tipo === 'mural') return `${cab}${missoesLista(true)}<button class="btn small" data-w="missoes">Ver todas as missões</button>`;
      if (p.tipo === 'torre') {
        const nv = E.nivelTorre();
        return `${cab}<p>A Torre dos Portais está no <b>nível ${nv} de 5</b>. Ela ganha um andar a cada missão concluída e, no nível 5, acende uma luz no topo.</p>
          <ul class="wow-world-lista">${E.missoes().map(m => `<li class="${m.estado}">${m.estado === 'concluida' ? '✅' : '⬜'} ${esc(m.nome)}</li>`).join('')}</ul>`;
      }
      if (p.tipo === 'portao-floresta') {
        if (s.marcos.portaoFloresta) return `${cab}<p>🌿 O portão está aberto. A passagem leva à clareira escondida, dentro da trilha da floresta.</p><button class="btn small" data-w="entrar" data-id="floresta">🚶 Ir para a trilha</button>`;
        const n = Object.keys(s.simbolos).length;
        if (n < 3) return `${cab}<p>Raízes grossas fecham a passagem. Há três encaixes em forma de símbolos, ${n ? `e você já conhece ${n}` : 'todos desconhecidos'}.</p><p class="wow-world-dica">As pedras com símbolos estão espalhadas pela trilha da floresta.</p>`;
        return `${cab}${portaoPuzzle()}`;
      }
      if (p.tipo === 'portao-antigos') {
        if (s.marcos.portaoAntigos) return `${cab}<p>🏛️ O portão está aberto. Lá dentro, os nomes de quem passou nas provas brilham na parede, inclusive o seu.</p>`;
        const pr = Object.keys(s.provas);
        return `${cab}<p>Uma inscrição: “Conclua uma prova de números, ordem ou investigação”.</p>
          <ul class="wow-world-lista">${Object.entries(MD.PROVAS).map(([k, v]) => `<li class="${s.provas[k] ? 'concluida' : ''}">${s.provas[k] ? '✅' : '⬜'} ${esc(v)} <a href="#/${k}">jogar</a></li>`).join('')}</ul>
          <button class="btn" data-w="antigos" ${pr.length ? '' : 'disabled'}>✋ Tocar o portão</button>${pr.length ? '' : '<p class="wow-world-dica">Termine uma partida de um desses jogos e volte aqui.</p>'}`;
      }
      if (p.tipo === 'cristais') {
        const conhecidas = Object.keys(s.reacoes);
        return `${cab}<p>Três cristais adormecidos. Cada um desperta com um tipo de energia descoberta no wow.elements.</p>
          <div class="wow-world-cristais">${MD.CRISTAIS.map(c => {
            const ativo = s.cristais[c.id], ops = conhecidas.filter(r => c.reacoes.includes(r));
            return `<div class="wow-world-cristal ${ativo ? 'aceso' : ''}" style="--c:${c.cor}"><span class="wow-world-cr-ico" aria-hidden="true">${c.icone}</span><b>${esc(c.nome)}</b>
              ${ativo ? `<small>✨ Desperto com “${esc(MD.REACOES[ativo])}”</small>` : conhecidas.length ? `<label>Energia <select data-cristal="${c.id}">${conhecidas.map(r => `<option value="${r}">${esc(MD.REACOES[r])}</option>`).join('')}</select></label><button class="btn small" data-w="cristal" data-id="${c.id}">Canalizar</button>${ops.length ? '' : '<small>Nenhuma energia conhecida combina com este cristal ainda.</small>'}` : '<small>Adormecido</small>'}</div>`;
          }).join('')}</div>
          ${conhecidas.length ? `<p class="wow-world-dica">Energias conhecidas: ${conhecidas.map(r => esc(MD.REACOES[r])).join(', ')}.</p>` : `<p>Você ainda não trouxe nenhuma energia. Descubra uma reação no <a href="#/elementos">wow.elements</a> (por exemplo, água apagando fogo).</p><p class="wow-world-dica">Se você já descobriu reações antes, basta abrir o wow.elements uma vez para que elas sejam reconhecidas aqui.</p>`}
          ${s.marcos.ponte ? `<blockquote class="wow-world-registro"><b>${esc(MD.REGISTROS.ponte.titulo)}</b><p>${esc(MD.REGISTROS.ponte.texto)}</p></blockquote>` : ''}`;
      }
      if (p.tipo === 'estrelas') {
        if (s.segredos.constelacao) return `${cab}<p>🌌 A constelação esquecida brilha no céu: ☀️ → 🌙 → ⭐.</p>`;
        return `${cab}<p>Um mapa estelar de bronze com seis estrelas que se acendem ao toque. Elas parecem esperar uma ordem.</p>
          <div class="wow-world-estrelas">${MD.ESTRELAS.map(e => `<button class="wow-world-estrela ${seqEstrelas.includes(e.id) ? 'on' : ''}" data-w="estrela" data-id="${e.id}" style="left:${e.x}%;top:${e.y}%" aria-label="Estrela ${e.id}">${e.icone}</button>`).join('')}</div>
          <p class="wow-world-dica">Selecionadas: ${seqEstrelas.length ? seqEstrelas.map(id => MD.ESTRELAS.find(e => e.id === id).icone).join(' → ') : 'nenhuma'} ${seqEstrelas.length ? '<button class="link" data-w="estrelas-limpar">recomeçar</button>' : ''}</p>`;
      }
      if (p.tipo === 'camara') {
        if (s.marcos.camara) return `${cab}<p>🔓 A câmara está aberta.</p><blockquote class="wow-world-registro eco"><b>${esc(MD.REGISTROS.eco.titulo)}</b><p>${esc(MD.REGISTROS.eco.texto)}</p></blockquote>`;
        const ec = E.ecos(), n = ec.filter(x => x.ok).length;
        return `${cab}<p>Uma porta redonda sem fechadura. No centro, ${MD.ECOS_NECESSARIOS} marcas em círculo: ${'●'.repeat(Math.min(n, MD.ECOS_NECESSARIOS))}${'○'.repeat(Math.max(0, MD.ECOS_NECESSARIOS - n))}</p>
          <p><b>${n} de ${MD.ECOS_NECESSARIOS} ecos reunidos.</b> Ecos são descobertas feitas pelo mundo. Onde ainda há ecos:</p>
          <ul class="wow-world-lista">${ec.filter(x => !x.ok && !x.segredo).map(x => `<li>⬜ ${esc(x.nome)} <small>(${esc(x.onde)})</small></li>`).join('')}${ec.some(x => !x.ok && x.segredo) ? `<li>❔ ${ec.filter(x => !x.ok && x.segredo).length} segredo(s) ainda escondido(s)</li>` : ''}</ul>
          <button class="btn" data-w="camara" ${n >= MD.ECOS_NECESSARIOS ? '' : 'disabled'}>🔮 Abrir a câmara</button>`;
      }
      return cab;
    }
    function portaoPuzzle(dentroDaArea) {
      return `<p>Os três encaixes esperam os símbolos na ordem certa. Toque nos símbolos para encaixá-los:</p>
        <div class="wow-world-simbolos">${Object.entries(MD.SIMBOLOS).map(([k, v]) => `<button class="btn ${seqPortao.includes(k) ? 'usado' : ''}" data-w="simbolo" data-id="${k}" ${seqPortao.includes(k) ? 'disabled' : ''}>${v.icone} ${v.nome}</button>`).join('')}</div>
        <p class="wow-world-encaixes" aria-live="polite">${[0, 1, 2].map(i => `<span>${seqPortao[i] ? MD.SIMBOLOS[seqPortao[i]].icone : '◯'}</span>`).join('')}</p>
        <p class="wow-world-dica">Frases das pedras: ${Object.entries(MD.SIMBOLOS).filter(([k]) => E.dados().simbolos[k]).map(([, v]) => `${v.icone} ${esc(v.frase)}`).join(' · ')}</p>
        ${seqPortao.length ? `<button class="link" data-w="portao-limpar"${dentroDaArea ? ' data-area="1"' : ''}>recomeçar</button>` : ''}`;
    }
    function falas(id) {
      const s = E.dados(), ms = E.missoes(), f = [];
      if (id === 'lume') {
        f.push('Bem-vinda, bem-vindo à Praça dos Portais! Cada missão que você concluir faz a Torre crescer.');
        const prox = ms.find(m => m.estado !== 'concluida'); if (prox) f.push(`Um bom próximo passo: “${prox.nome}”. ${prox.objetivo}`);
        f.push(s.segredos.sino ? 'O sino ainda canta seu nome. Que relógio interno!' : 'Dizem que o sino da praça só toca para quem parou o tempo a menos de 0,15 s do alvo, lá no Pare no Tempo.');
        if (!s.marcos.camara) f.push(`O Observatório guarda uma câmara que ouve ecos. Você já reuniu ${E.nEcos()} de ${MD.ECOS_NECESSARIOS}.`);
      } else {
        f.push('Uhu! Três pedras desta trilha guardam símbolos: uma perto da Árvore-Mãe, outra do outro lado do riacho, a leste, e a última na curva sudoeste.');
        f.push(s.segredos.raiz ? 'A raiz ainda canta. Obrigada por ouvi-la.' : 'Onde o riacho faz a curva, três chapéus vermelhos escutam a raiz…');
        if (Object.keys(s.simbolos).length === 3 && !s.marcos.portaoFloresta) f.push('Você já tem os três símbolos. As frases das pedras dizem a ordem em que o dia acontece.');
      }
      return f;
    }

    /* ======================= MISSÕES ======================= */
    function missoesLista(compacta) {
      return `<ul class="wow-world-missoes ${compacta ? 'compacta' : ''}">${E.missoes().map(m => `<li class="wow-world-missao ${m.estado}">
        <div class="wow-world-m-cab"><span aria-hidden="true">${m.icone}</span><b>${esc(m.nome)}</b><em>${m.estado === 'concluida' ? '✅ Concluída' : m.estado === 'andamento' ? '⏳ Em andamento' : '🟢 Disponível'}</em></div>
        ${compacta ? '' : `<p>${esc(m.desc)}</p><p><b>Objetivo:</b> ${esc(m.objetivo)}</p><p><b>Recompensa:</b> ${esc(m.recompensa)}</p>`}
        <div class="wow-world-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${m.total}" aria-valuenow="${Math.min(m.progresso, m.total)}"><i style="width:${Math.min(100, m.progresso / m.total * 100)}%"></i></div><small>${Math.min(m.progresso, m.total)}/${m.total}</small></li>`).join('')}</ul>`;
    }
    const missoesHtml = () => `<section class="wow-world-sec-box"><h3>📜 Missões</h3>${missoesLista(false)}</section>`;

    /* ======================= DIÁRIO ======================= */
    function diarioHtml() {
      const s = E.dados(), ms = E.missoes();
      const pistaVista = { raiz: !!s.pontos.coruja, sino: !!s.pontos.lume, constelacao: !!s.registros.telescopio };
      const proximos = ms.filter(m => m.estado !== 'concluida').map(m => m.objetivo);
      return `<section class="wow-world-diario">
        <div class="wow-world-sec-box"><h3>🧭 Regiões</h3><ul class="wow-world-lista">${MD.REGIOES.map(r => `<li class="${s.visitadas[r.id] ? 'concluida' : ''}">${s.visitadas[r.id] ? '✅' : '⬜'} ${r.icone} ${esc(r.nome)} ${s.pontos[r.principal] ? '<small>(ponto principal visto)</small>' : ''}</li>`).join('')}</ul></div>
        <div class="wow-world-sec-box"><h3>📜 Missões</h3>${missoesLista(true)}</div>
        <div class="wow-world-sec-box"><h3>🗝️ Segredos <small>${Object.keys(s.segredos).length}/${MD.SEGREDOS.length}</small></h3><ul class="wow-world-lista">${MD.SEGREDOS.map(g => s.segredos[g.id]
          ? `<li class="concluida">${g.icone} <b>${esc(g.nome)}</b><small>${esc(g.recompensa)}</small></li>`
          : `<li>❔ <b>Segredo desconhecido</b>${pistaVista[g.id] ? `<small>Pista anotada: ${esc(g.pista)}</small>` : '<small>Ainda sem pista. Converse e leia tudo pelo caminho.</small>'}</li>`).join('')}</ul></div>
        <div class="wow-world-sec-box"><h3>🔣 Símbolos da floresta</h3><p class="wow-world-simbolos-diario">${Object.entries(MD.SIMBOLOS).map(([k, v]) => s.simbolos[k] ? `<span title="${esc(v.frase)}">${v.icone} ${v.nome}<small>${esc(v.frase)}</small></span>` : '<span class="nao">❔<small>não encontrado</small></span>').join('')}</p></div>
        <div class="wow-world-sec-box"><h3>📖 Registros <small>${Object.keys(s.registros).length}/${Object.keys(MD.REGISTROS).length}</small></h3>${Object.keys(s.registros).length
          ? Object.keys(MD.REGISTROS).filter(k => s.registros[k]).map(k => `<details class="wow-world-reg-item"><summary>${esc(MD.REGISTROS[k].titulo)}</summary><p>${esc(MD.REGISTROS[k].texto)}</p></details>`).join('')
          : '<p class="wow-world-dica">Nenhum registro ainda. Examine lugares marcados nas regiões.</p>'}</div>
        <div class="wow-world-sec-box"><h3>🔮 Ecos <small>${E.nEcos()} encontrados · a câmara pede ${MD.ECOS_NECESSARIOS}</small></h3><ul class="wow-world-lista">${E.ecos().filter(e => e.ok).map(e => `<li class="concluida">✨ ${esc(e.nome)}</li>`).join('') || '<li>Nenhum eco ainda.</li>'}</ul></div>
        <div class="wow-world-sec-box"><h3>➡️ Próximos objetivos</h3>${proximos.length ? `<ul class="wow-world-lista">${proximos.map(t => `<li>• ${esc(t)}</li>`).join('')}</ul>` : '<p>Você concluiu todas as missões da versão 1.0 do wow.world! 🎉</p>'}</div>
      </section>`;
    }

    /* ======================= ÁREA COM PERSONAGEM ======================= */
    function entrarArea(id) {
      tela = 'area'; areaId = id; dialogo = null; seqPortao = [];
      E.visitar(id === 'praca' ? 'praca' : 'floresta');
      el.innerHTML = `<div class="wow-world">${topo()}
        <section class="wow-world-area">
          <div class="wow-world-reg-topo"><button class="btn small wow-world-sec" data-w="sair">⬅ Sair para o mapa</button><h3>${esc(MD.AREAS[id].nome)}</h3>
            <span class="wow-world-dica">Setas/WASD para andar · E para interagir</span></div>
          <div class="wow-world-area-box"><canvas id="ww-canvas" aria-label="Área ${esc(MD.AREAS[id].nome)} com seu personagem" tabindex="0"></canvas></div>
          <div class="wow-world-controles">
            <div class="wow-world-dpad" aria-label="Controles de movimento">
              <button class="wow-world-dir c" data-dir="cima" aria-label="Andar para cima">▲</button><button class="wow-world-dir e" data-dir="esq" aria-label="Andar para a esquerda">◀</button>
              <button class="wow-world-dir d" data-dir="dir" aria-label="Andar para a direita">▶</button><button class="wow-world-dir b" data-dir="baixo" aria-label="Andar para baixo">▼</button></div>
            <button class="btn big wow-world-interagir" data-w="interagir" id="ww-interagir" disabled>E · Interagir</button>
          </div>
          <div class="wow-world-dialogo" id="ww-dialogo" aria-live="polite"><p class="wow-world-dica">Ande até algo e interaja. Os objetos brilham quando você está perto.</p></div>
        </section></div>`;
      const canvas = el.querySelector('#ww-canvas');
      areaCtl = AR.criar({ canvas, area: id, aoPerto: o => { const b = el.querySelector('#ww-interagir'); if (b) { b.disabled = !o; b.textContent = o ? `E · ${o.nome}` : 'E · Interagir'; } }, aoInteragir: interagirArea });
      canvas.focus({ preventScroll: true });
      // botões de direção: segurar para andar (toque, mouse ou caneta)
      el.querySelectorAll('[data-dir]').forEach(b => {
        const on = e => { e.preventDefault(); areaCtl && areaCtl.direcao(b.dataset.dir, true); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (er) {} };
        const off = () => { areaCtl && areaCtl.direcao(b.dataset.dir, false); b.classList.remove('on'); };
        b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
        b.addEventListener('contextmenu', e => e.preventDefault());
      });
    }
    function mostrarDialogo(html) { dialogo = html; const d = el.querySelector('#ww-dialogo'); if (d) d.innerHTML = html; }
    function atualizarHudArea() { const t = el.querySelector('.wow-world-titulo small'); if (t) { const ms = E.missoes(); t.textContent = `Missões ${ms.filter(m => m.estado === 'concluida').length}/${ms.length} · Ecos ${E.nEcos()} · Torre nível ${E.nivelTorre()}`; } }
    function interagirArea(o) {
      const s = E.dados();
      const reg = t => `<blockquote class="wow-world-registro"><b>${esc(MD.REGISTROS[t].titulo)}</b><p>${esc(MD.REGISTROS[t].texto)}</p></blockquote>`;
      switch (o.id) {
        case 'torre': E.examinar('torre'); return mostrarDialogo(`<h4>🗼 Torre dos Portais</h4><p>Nível ${E.nivelTorre()} de 5. Cada missão concluída acrescenta um andar.</p>`);
        case 'lume': E.examinar('lume'); return mostrarDialogo(`<h4>🧙‍♀️ Guardiã Lume</h4>${falas('lume').map(f => `<p class="wow-world-fala">“${esc(f)}”</p>`).join('')}`);
        case 'coruja': E.examinar('coruja'); return mostrarDialogo(`<h4>🦉 Coruja Sábia</h4>${falas('coruja').map(f => `<p class="wow-world-fala">“${esc(f)}”</p>`).join('')}`);
        case 'mural': E.examinar('mural'); return mostrarDialogo(`<h4>📜 Mural de missões</h4>${missoesLista(true)}`);
        case 'placaPraca': return mostrarDialogo('<h4>🪧 Placa</h4><p>“Praça dos Portais. Daqui se chega a todos os mundos. Siga os símbolos, escute os sinos e não tenha pressa.”</p>');
        case 'portal': return sairArea();
        case 'sino': { const r = E.tocarSino(); return mostrarDialogo(`<h4>🔔 Sino da praça</h4><p>${esc(r.msg)}</p>`); }
        case 'pedra_sol': case 'pedra_lua': case 'pedra_estrela': {
          const k = o.simbolo, v = MD.SIMBOLOS[k]; E.acharSimbolo(k);
          return mostrarDialogo(`<h4>🪨 Pedra com símbolo</h4><p class="wow-world-simbolo-grande">${v.icone}</p><p>Gravado na pedra: <b>${v.nome}</b>. ${esc(v.frase)}</p><p class="wow-world-dica">${Object.keys(E.dados().simbolos).length}/3 símbolos encontrados.</p>`);
        }
        case 'portao':
          if (s.marcos.portaoFloresta) return mostrarDialogo('<h4>🌿 Portão de Raízes</h4><p>Aberto. A passagem leva à clareira ao norte.</p>');
          if (Object.keys(s.simbolos).length < 3) return mostrarDialogo(`<h4>🌿 Portão de Raízes</h4><p>Três encaixes vazios: ☀ ☾ ✦. Você conhece ${Object.keys(s.simbolos).length} dos 3 símbolos. Procure as pedras pela trilha.</p>`);
          return mostrarDialogo(`<h4>🌿 Portão de Raízes</h4>${portaoPuzzle(true)}`);
        case 'caderno': E.acharClareira(); return mostrarDialogo(`<h4>📗 Caderno de musgo</h4>${reg('clareira')}`);
        case 'cogumelos': {
          if (s.segredos.raiz) return mostrarDialogo('<h4>🍄 Cogumelos</h4><p>A raiz continua cantando baixinho debaixo deles.</p>');
          E.revelarRaiz();
          return mostrarDialogo('<h4>🍄 Três chapéus vermelhos</h4><p>Você se agacha perto dos cogumelos, na curva do riacho, e escuta: uma raiz dourada canta debaixo da terra e começa a brilhar!</p>');
        }
      }
    }
    function sairArea() { if (areaCtl) { areaCtl.destruir(); areaCtl = null; } tela = 'regiao'; reg = areaId; sel = null; render(); }

    /* ======================= Ações ======================= */
    el.onclick = e => {
      const b = e.target.closest('[data-w]'); if (!b || b.disabled) return;
      const a = b.dataset.w, id = b.dataset.id;
      if (a === 'mapa') { tela = 'mapa'; sel = null; return render(); }
      if (a === 'missoes' || a === 'diario') { tela = a; return render(); }
      if (a === 'regiao') { tela = 'regiao'; reg = id; sel = null; E.visitar(id); return render(); }
      if (a === 'ponto') {
        sel = sel === id ? null : id; seqPortao = []; seqEstrelas = [];
        if (sel) E.examinar(id);
        render(); const pn = el.querySelector('#ww-painel'); if (pn && sel) pn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      if (a === 'entrar') return entrarArea(id);
      if (a === 'sair') return sairArea();
      if (a === 'interagir') { if (areaCtl) areaCtl.interagir(); return; }
      if (a === 'simbolo') {
        if (!seqPortao.includes(id)) seqPortao.push(id);
        const naArea = tela === 'area';
        if (seqPortao.length === 3) {
          const r = E.abrirPortaoFloresta(seqPortao); seqPortao = [];
          if (naArea) return mostrarDialogo(`<h4>🌿 Portão de Raízes</h4><p>${esc(r.msg)}</p>${r.ok ? '' : portaoPuzzle(true)}`);
          msg = { ok: r.ok, txt: r.msg }; return render();
        }
        return naArea ? mostrarDialogo(`<h4>🌿 Portão de Raízes</h4>${portaoPuzzle(true)}`) : render();
      }
      if (a === 'portao-limpar') { seqPortao = []; return b.dataset.area ? mostrarDialogo(`<h4>🌿 Portão de Raízes</h4>${portaoPuzzle(true)}`) : render(); }
      if (a === 'antigos') { const r = E.abrirPortaoAntigos(); msg = { ok: r.ok, txt: r.msg }; return render(); }
      if (a === 'cristal') { const sl = el.querySelector(`[data-cristal="${id}"]`); const r = E.ativarCristal(id, sl ? sl.value : ''); msg = { ok: r.ok, txt: r.msg }; return render(); }
      if (a === 'estrela') {
        if (!seqEstrelas.includes(id)) seqEstrelas.push(id);
        if (seqEstrelas.length === 3) { const r = E.constelacao(seqEstrelas); seqEstrelas = []; msg = { ok: r.ok, txt: r.msg }; }
        return render();
      }
      if (a === 'estrelas-limpar') { seqEstrelas = []; return render(); }
      if (a === 'camara') { const r = E.abrirCamara(); msg = { ok: r.ok, txt: r.msg }; return render(); }
    };

    render();
    return () => { handler = null; clearTimeout(flashTo); clearTimeout(agendado); if (areaCtl) { areaCtl.destruir(); areaCtl = null; } el.onclick = null; };
  }

  WowGames.registerPage({ id: 'mundo', nome: '🗺️ wow.world', mount: pagina });
  WowGames.Mundo = { bannerHtml, versao: '1.0' };
})();
