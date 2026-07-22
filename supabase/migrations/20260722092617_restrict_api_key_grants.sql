revoke all on public.api_keys from anon, authenticated, service_role;

grant select, delete on public.api_keys to authenticated;
grant select, insert on public.api_keys to service_role;
