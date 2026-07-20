create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role = 'owner'),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  unique (user_id)
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null check (code ~ '^[A-Za-z0-9_-]{4,64}$'),
  destination_url text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);

create index links_workspace_created_at_idx on public.links (workspace_id, created_at desc);

create function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.links enable row level security;

create policy "members can read workspaces" on public.workspaces for select
  using (public.is_workspace_member(id));
create policy "members can read memberships" on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));
create policy "members manage own links" on public.links for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create function public.create_workspace_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare workspace_id uuid;
begin
  insert into public.workspaces (name)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My') || '''s workspace')
  returning id into workspace_id;
  insert into public.workspace_members (workspace_id, user_id) values (workspace_id, new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.create_workspace_for_new_user();

create function public.touch_link_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger links_updated_at before update on public.links
  for each row execute procedure public.touch_link_updated_at();
