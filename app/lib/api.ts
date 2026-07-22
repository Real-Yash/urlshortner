import { supabase } from "@/app/lib/supabase/browser";

export type ShortLink = { id:string; code:string; destination_url:string; status:"active"|"disabled"; project_id:string|null; projects?:{name:string}|null; created_at:string; updated_at:string };
export type Project = { id:string; name:string; created_at:string };
export type Analytics = { total:number; daily:{date:string;clicks:number}[]; links:{code:string;clicks:number}[] };
export type ApiKey = { id:string; project_id:string; name:string; key_prefix:string; created_at:string; projects?:{name:string}|null };
export type Domain = { id:string; hostname:string; status:"pending"|"active"|"moved"|"failed"; created_at:string };
export type Workspace = { id:string; name:string; created_at:string };
const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/api/v1`;

async function request(path = "", init?: RequestInit) {
  const { data:{ session } } = await supabase().auth.getSession();
  if (!session) throw new Error("Your session has ended. Sign in again.");
  const response = await fetch(`${endpoint}${path}`, { ...init, headers:{ Authorization:`Bearer ${session.access_token}`, ...init?.headers } });
  if (response.status === 204) return null;
  const json = await response.json().catch(() => ({})) as { data?:unknown; error?:string };
  if (!response.ok) throw new Error(json.error ?? "The request could not be completed.");
  return json.data;
}
export const linksApi = {
  list: () => request("/links") as Promise<ShortLink[]>,
  create: (body:{ destination_url:string; alias?:string; project_id?:string }) => request("/links", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }) as Promise<ShortLink>,
  update: (id:string, body:Partial<Pick<ShortLink,"destination_url"|"status"|"project_id">>&{alias?:string}) => request(`/links/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }) as Promise<ShortLink>,
  remove: (id:string) => request(`/links/${id}`, { method:"DELETE" }),
};
export const projectsApi = {
  list: () => request("/projects") as Promise<Project[]>,
  create: (body:{ name:string }) => request("/projects", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }) as Promise<Project>,
};
export const analyticsApi = { summary: () => request("/analytics") as Promise<Analytics> };
export const apiKeysApi = {
  list: () => request("/api-keys") as Promise<ApiKey[]>,
  create: (body:{ project_id:string; name:string }) => request("/api-keys", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }) as Promise<ApiKey & { key:string }>,
  remove: (id:string) => request(`/api-keys/${id}`, { method:"DELETE" }),
};
export const domainsApi = {
  list: () => request("/domains") as Promise<Domain[]>,
  create: (body:{ subdomain:string }) => request("/domains", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }) as Promise<Domain>,
  refresh: (id:string) => request(`/domains/${id}`, { method:"PATCH" }) as Promise<Domain>,
  remove: (id:string) => request(`/domains/${id}`, { method:"DELETE" }),
};
export const workspaceApi = {
  get: () => request("/workspace") as Promise<Workspace>,
  update: (body:{ name:string }) => request("/workspace", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }) as Promise<Workspace>,
};
