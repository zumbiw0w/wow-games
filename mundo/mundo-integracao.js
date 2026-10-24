/* wow.world — INTEGRAÇÃO com os jogos e com o perfil.
   - Ouve os eventos que os jogos JÁ enviam (WowGames.evento → Perfil.aoEvento), sem alterar nenhum jogo:
       wow.elements: 'reacao' (reação nova) e 'sync' (reações já descobertas, enviado ao abrir o jogo)
       Matemática Relâmpago, Complete a Sequência e O Caso #001: 'fim' (partida concluída)
       Pare no Tempo: 'rodada' (erro da rodada)
   - Adaptador de histórico: lê (somente leitura) recordes do perfil que só existem depois de partidas concluídas.
   - Conquistas do wow.world: registradas no sistema de conquistas existente; o XP é o que esse sistema já concede, uma única vez.
   - Os eventos do próprio wow.world usam jogo: 'mundo' e partida: false, então não contam como partida nem alteram pontuação. */
(function () {
  const Perfil = WowGames.Perfil, E = WowGames.MundoEstado;
  if (!Perfil || !E) return;
  const conq = (id, icone, nome, desc, xp, ok) => Perfil.registrarConquista({ id, icone, nome, desc, xp, ok });
  const missao = id => ev => ev.jogo === 'mundo' && ev.tipo === 'missao' && ev.id === id;
  conq('mundoandarilho', '🧭', 'Andarilho do wow.world', 'Conclua a missão “Um mundo a descobrir” no wow.world.', 60, missao('m1'));
  conq('mundoraizes', '🌿', 'Decifrador de Raízes', 'Conclua a missão “O código da floresta” no wow.world.', 80, missao('m2'));
  conq('mundocristais', '💎', 'Despertador de Cristais', 'Conclua a missão “Energia adormecida” no wow.world.', 80, missao('m3'));
  conq('mundoantigos', '🚪', 'Aprovado pelos Antigos', 'Conclua a missão “O teste dos antigos” no wow.world.', 60, missao('m4'));
  conq('mundoeco', '🔮', 'Ouvinte do Primeiro Eco', 'Conclua a missão “O primeiro eco” no wow.world.', 150, missao('m5'));
  conq('mundosegredos', '🗝️', 'Guardião dos Segredos', 'Encontre os três segredos do wow.world.', 150, ev => ev.jogo === 'mundo' && ev.tipo === 'segredos');

  Perfil.aoEvento(ev => { if (ev && ev.jogo !== 'mundo') E.processarEvento(ev); });
  try { E.importarDoPerfil(Perfil.dados()); } catch (e) { console.error('[wow.world] Não foi possível ler o histórico do perfil:', e); }
})();
