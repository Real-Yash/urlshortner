alter table public.domains
  add constraint domains_workspace_id_key unique (workspace_id);
