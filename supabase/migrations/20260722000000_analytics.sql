create table public.click_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  link_id uuid not null references public.links(id) on delete cascade,
  clicked_at timestamptz not null default now()
);

create index click_events_workspace_clicked_at_idx on public.click_events (workspace_id, clicked_at desc);
create index click_events_link_clicked_at_idx on public.click_events (link_id, clicked_at desc);

alter table public.click_events enable row level security;

create policy "members can read own click events" on public.click_events for select
  using (public.is_workspace_member(workspace_id));
