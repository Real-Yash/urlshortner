alter table public.links
  add column project_id uuid references public.projects(id) on delete set null;

create index links_project_id_idx on public.links (project_id);
