-- Caderno Digital · configuração do Supabase
-- Cole tudo no SQL Editor do seu projeto Supabase e clique em "Run". Pode rodar mais de uma vez.

-- 1. Tabela onde fica o caderno de cada pessoa (aulas, páginas, escrita, dados dos arquivos)
create table if not exists public.caderno_dados (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tabela text not null,
  id text not null,
  dados jsonb,
  atualizado bigint not null default 0,
  excluido boolean not null default false,
  sincronizado timestamptz not null default clock_timestamp(),
  primary key (user_id, tabela, id)
);

create index if not exists caderno_dados_sync_idx on public.caderno_dados (user_id, sincronizado);

-- Marca a hora do servidor em cada gravação (usada para saber o que mudou)
create or replace function public.caderno_marcar_sync()
returns trigger language plpgsql as $$
begin
  new.sincronizado := clock_timestamp();
  return new;
end $$;

drop trigger if exists caderno_dados_sync on public.caderno_dados;
create trigger caderno_dados_sync before insert or update on public.caderno_dados
for each row execute function public.caderno_marcar_sync();

-- Projetos novos do Supabase não liberam tabelas novas para a API automaticamente
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.caderno_dados to authenticated;

-- Cada pessoa só vê e altera o próprio caderno
alter table public.caderno_dados enable row level security;

drop policy if exists "caderno: dona le" on public.caderno_dados;
create policy "caderno: dona le" on public.caderno_dados for select to authenticated using (user_id = auth.uid());
drop policy if exists "caderno: dona grava" on public.caderno_dados;
create policy "caderno: dona grava" on public.caderno_dados for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "caderno: dona altera" on public.caderno_dados;
create policy "caderno: dona altera" on public.caderno_dados for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "caderno: dona apaga" on public.caderno_dados;
create policy "caderno: dona apaga" on public.caderno_dados for delete to authenticated using (user_id = auth.uid());

-- 2. Armazenamento dos arquivos (PDFs, imagens, documentos), privado
insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', false)
on conflict (id) do nothing;

drop policy if exists "arquivos: dona le" on storage.objects;
create policy "arquivos: dona le" on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "arquivos: dona envia" on storage.objects;
create policy "arquivos: dona envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "arquivos: dona altera" on storage.objects;
create policy "arquivos: dona altera" on storage.objects for update to authenticated
  using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "arquivos: dona apaga" on storage.objects;
create policy "arquivos: dona apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
