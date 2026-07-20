import { supabase } from "@/app/lib/supabase/browser";

export type ShortLink = { id:string; code:string; destination_url:string; status:"active"|"disabled"; created_at:string; updated_at:string };
const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/links`;

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
  list: () => request() as Promise<ShortLink[]>,
  create: (body:{ destination_url:string; alias?:string }) => request("", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }) as Promise<ShortLink>,
  update: (id:string, body:Partial<Pick<ShortLink,"destination_url"|"status">>&{alias?:string}) => request(`/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }) as Promise<ShortLink>,
  remove: (id:string) => request(`/${id}`, { method:"DELETE" }),
};
