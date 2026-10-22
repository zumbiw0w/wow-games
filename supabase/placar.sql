-- wow.games: banco do PLACAR GLOBAL (Supabase / PostgreSQL).
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo inteiro → Run. Pode ser executado de novo sem perder dados.
-- Segurança:
--   * Visitantes (papel "anon") NÃO podem ler nem escrever a tabela diretamente (RLS ligado, sem políticas, privilégios revogados).
--   * Eles só podem chamar duas funções: placar_ranking (leitura pública e limitada) e placar_enviar (envio validado).
--   * O id anônimo do aparelho nunca é guardado: só o hash SHA-256 dele. A leitura pública mostra só os 10 primeiros caracteres do hash.
--   * Não há função para editar ou apagar resultados pelo site. A moderação é feita por você, no painel do Supabase.

create extension if not exists pgcrypto with schema extensions;

-- Regras de cada jogo (iguais às de placar.js). menor_melhor = true para tempos/erros.
create table if not exists public.placar_jogos (
  id            text primary key,
  nome          text not null,
  menor_melhor  boolean not null,
  valor_min     numeric not null,
  valor_max     numeric not null,
  casas         int not null default 0 check (casas between 0 and 3),
  valores_aceitos numeric[]            -- opcional: lista fechada de valores (ex.: escada do Show de Perguntas)
);

insert into public.placar_jogos (id, nome, menor_melhor, valor_min, valor_max, casas, valores_aceitos) values
  ('botao',      'O Botão',               true,    4,  3600, 2, null),
  ('tempo',      'Pare no Tempo',         true,    0,    30, 3, null),
  ('matematica', 'Matemática Relâmpago',  false,   1,  3000, 0, null),
  ('sequencia',  'Complete a Sequência',  false,   1,  2000, 0, null),
  ('cor',        'Não Toque no Vermelho', false,   1,  2250, 0, null),
  ('peso',       'Adivinhe o Peso',       false,   1,  1925, 0, null),
  ('show',       'Show de Perguntas',     false, 100, 35000, 0,
     array[100,200,300,500,800,1200,1800,2500,3500,5000,7000,10000,15000,22000,35000])
on conflict (id) do update set nome = excluded.nome, menor_melhor = excluded.menor_melhor, valor_min = excluded.valor_min,
  valor_max = excluded.valor_max, casas = excluded.casas, valores_aceitos = excluded.valores_aceitos;

create table if not exists public.placar_resultados (
  id            bigint generated always as identity primary key,
  jogo          text not null references public.placar_jogos(id),
  jogador_hash  text not null check (jogador_hash ~ '^[0-9a-f]{64}$'),
  nome          text not null check (char_length(nome) between 2 and 16),
  valor         numeric(12,3) not null,
  criado_em     timestamptz not null default now()
);
create index if not exists placar_resultados_jogo_valor on public.placar_resultados (jogo, valor);
create index if not exists placar_resultados_jogador on public.placar_resultados (jogador_hash, criado_em desc);

-- Ninguém de fora acessa as tabelas diretamente.
alter table public.placar_jogos enable row level security;
alter table public.placar_resultados enable row level security;
revoke all on public.placar_jogos, public.placar_resultados from anon, authenticated;

-- Envio de resultado: valida tudo no servidor.
create or replace function public.placar_enviar(p_jogo text, p_valor numeric, p_nome text, p_jogador uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  j  public.placar_jogos;
  h  text;
  n  text;
  v  numeric;
begin
  select * into j from public.placar_jogos where id = p_jogo;
  if not found then raise exception 'jogo_invalido'; end if;
  if p_jogador is null then raise exception 'jogador_invalido'; end if;

  v := p_valor;
  if v is null or v <> round(v, j.casas) then raise exception 'valor_invalido'; end if;
  if v < j.valor_min or v > j.valor_max then raise exception 'valor_fora_do_limite'; end if;
  if j.valores_aceitos is not null and not (v = any (j.valores_aceitos)) then raise exception 'valor_invalido'; end if;

  n := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  if char_length(n) < 2 or char_length(n) > 16 or n !~ '^[[:alnum:] _.-]+$' then raise exception 'nome_invalido'; end if;

  h := encode(digest(p_jogador::text, 'sha256'), 'hex');

  -- limites de envio por aparelho: 1 a cada 5 segundos e 300 por dia
  if exists (select 1 from public.placar_resultados where jogador_hash = h and criado_em > now() - interval '5 seconds') then
    raise exception 'muitos_envios';
  end if;
  if (select count(*) from public.placar_resultados where jogador_hash = h and criado_em > now() - interval '1 day') >= 300 then
    raise exception 'muitos_envios';
  end if;

  insert into public.placar_resultados (jogo, jogador_hash, nome, valor) values (j.id, h, n, v);
  return json_build_object('ok', true);
end;
$$;

-- Leitura pública: melhor resultado de cada jogador no jogo, no máximo 100 linhas.
-- Empates recebem a mesma posição (rank); entre empatados, quem fez primeiro aparece antes.
create or replace function public.placar_ranking(p_jogo text, p_limite int default 50)
returns table (posicao bigint, nome text, valor numeric, criado_em timestamptz, jogador_tag text)
language sql
stable
security definer
set search_path = public
as $$
  with j as (select * from public.placar_jogos where id = p_jogo),
  melhores as (
    select distinct on (r.jogador_hash) r.jogador_hash, r.nome, r.valor, r.criado_em
    from public.placar_resultados r join j on r.jogo = j.id
    order by r.jogador_hash, case when j.menor_melhor then r.valor else -r.valor end, r.criado_em
  )
  select rank() over (order by case when j.menor_melhor then m.valor else -m.valor end) as posicao,
         m.nome, m.valor, m.criado_em, left(m.jogador_hash, 10) as jogador_tag
  from melhores m cross join j
  order by posicao, m.criado_em
  limit least(greatest(coalesce(p_limite, 50), 1), 100);
$$;

revoke all on function public.placar_enviar(text, numeric, text, uuid) from public;
revoke all on function public.placar_ranking(text, int) from public;
grant execute on function public.placar_enviar(text, numeric, text, uuid) to anon, authenticated;
grant execute on function public.placar_ranking(text, int) to anon, authenticated;
