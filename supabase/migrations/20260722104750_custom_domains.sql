create table public.domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hostname text not null unique check (char_length(hostname) between 3 and 253),
  cloudflare_id text unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'moved', 'failed')),
  verification jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index domains_workspace_created_at_idx on public.domains (workspace_id, created_at desc);

grant select, insert, delete, update on public.domains to authenticated;

alter table public.domains enable row level security;

create policy "members manage own domains" on public.domains for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create trigger domains_updated_at before update on public.domains
  for each row execute procedure public.touch_link_updated_at();
