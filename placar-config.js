/* wow.games: CONFIGURAÇÃO PÚBLICA do placar global (Supabase).
   Preencha com os dados do SEU projeto Supabase (Project Settings → API). Passo a passo em docs/placar-global.md.
     url:        a "Project URL", ex.: https://abcdefghijklmnop.supabase.co
     chaveAnon:  a chave pública "anon" (ou "publishable"). Ela PODE ficar no site: as regras do banco (supabase/placar.sql)
                 só deixam visitantes chamarem as duas funções do placar.
   NUNCA coloque aqui a chave "service_role" (ou "secret"): ela ignora as regras de segurança e daria controle total do banco.
   Enquanto url ou chaveAnon estiverem vazios, o placar mostra "não configurado" e nada é enviado pela rede. */
WowGames.PlacarConfig = {
  url: '',
  chaveAnon: ''
};
