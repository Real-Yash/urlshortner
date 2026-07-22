create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  key_prefix text not null unique,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);

create index api_keys_project_created_at_idx on public.api_keys (project_id, created_at desc);

grant select, delete on public.api_keys to authenticated;
grant select, insert on public.api_keys to service_role;

alter table public.api_keys enable row level security;

create policy "members read project api keys" on public.api_keys for select
  to authenticated
  using (exists (select 1 from public.projects where projects.id = api_keys.project_id and public.is_workspace_member(projects.workspace_id)))
;

create policy "members delete project api keys" on public.api_keys for delete
  to authenticated
  using (exists (select 1 from public.projects where projects.id = api_keys.project_id and public.is_workspace_member(projects.workspace_id)));
