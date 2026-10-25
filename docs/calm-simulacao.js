// Simulação do balanceamento do wow.calm (não é carregada pelo site). Uso: node docs/calm-simulacao.js
const C = require(require('path').join(__dirname, '..', 'games', 'calm-dados.js'));
const estilos = [
  { nome: 'muitos cliques', cps: 6, pausa: 0 },
  { nome: 'equilibrado', cps: 3.5, pausa: .15 },
  { nome: 'casual', cps: 1.6, pausa: .35 }      // pausa = fração do tempo sem clicar (lendo, olhando o quarto)
];
function simular(e, semi) {
  const niv = {}; let s = 0, t = 0, dt = .25; const marcos = [], etapas = {}; let ultimaCompra = 0, maiorEspera = 0, compras = 0;
  let r = semi;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  while (!C.concluido(niv) && t < 3 * 3600) {
    const p = C.producao(niv);
    const clicando = rnd() > e.pausa;
    s += p.auto * dt + (clicando ? p.clique * e.cps * dt : 0);
    t += dt;
    // estratégia: compra o melhor custo-benefício entre itens disponíveis; prioriza essenciais quando acessíveis
    for (let k = 0; k < 5; k++) {
      const disp = C.ITENS.filter(i => C.disponivel(i, niv) && (niv[i.id] || 0) < i.max && !i.opcional);
      if (!disp.length) break;
      const valor = it => {
        const n = niv[it.id] || 0, antes = C.producao(niv), depois = C.producao(Object.assign({}, niv, { [it.id]: n + 1 }));
        const ganho = (depois.auto - antes.auto) + (depois.clique - antes.clique) * e.cps * (1 - e.pausa);
        return (ganho + (it.essencial && !n ? antes.auto * .6 + 5 : 0)) / C.custo(it, n);
      };
      disp.sort((a, b) => valor(b) - valor(a));
      const alvo = disp[0], custo = C.custo(alvo, niv[alvo.id] || 0);
      if (custo > s) break;
      s -= custo; niv[alvo.id] = (niv[alvo.id] || 0) + 1; compras++;
      maiorEspera = Math.max(maiorEspera, t - ultimaCompra); ultimaCompra = t;
      const et = C.etapaAtual(niv); if (!etapas[et]) etapas[et] = t;
    }
  }
  return { t, etapas, maiorEspera, compras, p: C.producao(niv) };
}
const m = s => `${Math.floor(s / 60)}min${String(Math.round(s % 60)).padStart(2, '0')}`;
for (const e of estilos) {
  const rs = [1, 2, 3].map(k => simular(e, 12345 * k));
  const r = rs[1];
  console.log(`${e.nome.padEnd(15)} conclusão ${rs.map(x => m(x.t)).join(' / ')} | etapas: ${Object.entries(r.etapas).map(([k, v]) => k + '@' + m(v)).join(' ')} | maior espera entre compras ${m(r.maiorEspera)} | compras ${r.compras} | final: ${C.fmt(r.p.clique)}/clique ${C.fmt(r.p.auto)}/s`);
}
// só automático (sem cliques depois do início): não deve travar
const ocioso = simular({ nome: 'ocioso', cps: .3, pausa: .8 }, 7);
console.log('quase sem cliques:', m(ocioso.t), Object.entries(ocioso.etapas).map(([k, v]) => k + '@' + m(v)).join(' '));
