create policy "owners can update workspaces" on public.workspaces for update
  to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_id = workspaces.id and user_id = (select auth.uid()) and role = 'owner'
  ))
  with check (exists (
    select 1 from public.workspace_members
    where workspace_id = workspaces.id and user_id = (select auth.uid()) and role = 'owner'
  ));
