import type { ExecutionContext } from "@cloudflare/workers-types";
import { projectId, projectName } from "../../app/lib/projects";
import { summarizeClicks, type ClickEvent } from "../../app/lib/analytics";
import { platformSubdomain } from "../../app/lib/domains";
import { customCode, destinationUrl, randomCode } from "../../app/lib/links";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PLATFORM_HOST: string;
}

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS" };

function json(data: unknown, status = 200) { return Response.json(data, { status, headers: cors }); }
function apiKey() { return `zyl_${btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/[+/]/g, "_").replace(/=+$/, "")}`; }
async function hash(value: string) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function authorization(request: Request) { const value = request.headers.get("Authorization"); return value?.startsWith("Bearer ") ? value : null; }
function database(env: Env, path: string, authorization: string, init?: RequestInit) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization, "Content-Type": "application/json", Prefer: "return=representation", ...init?.headers } });
}
async function workspaceId(env: Env, token: string) {
  const response = await database(env, "workspace_members?select=workspace_id&limit=1", token);
  const [workspace] = response.ok ? await response.json() as { workspace_id: string }[] : [];
  return workspace?.workspace_id;
}
async function belongsToWorkspace(env: Env, token: string, project: string, workspace: string) {
  const response = await database(env, `projects?id=eq.${project}&workspace_id=eq.${workspace}&select=id&limit=1`, token);
  return response.ok && (await response.json() as unknown[]).length > 0;
}
async function projectForApiKey(env: Env, key: string) {
  const response = await database(env, `api_keys?key_hash=eq.${await hash(key)}&select=id,project_id,projects(workspace_id)&limit=1`, `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  const [record] = response.ok ? await response.json() as { id:string; project_id:string; projects:{workspace_id:string}|null }[] : [];
  return record?.projects ? { projectId:record.project_id, workspaceId:record.projects.workspace_id } : null;
}
async function shortUrl(env: Env, token: string, workspace: string, code: string, origin: string) {
  const response = await database(env, `domains?workspace_id=eq.${workspace}&status=eq.active&select=hostname&order=created_at.asc&limit=1`, token);
  const [domain] = response.ok ? await response.json() as {hostname:string}[] : [];
  return new URL(`/${code}`, domain ? `https://${domain.hostname}` : origin).toString();
}
async function createLink(env: Env, token: string, workspace: string, project: string | null, body: { destination_url?: unknown; alias?: unknown }, origin: string) {
  const url = destinationUrl(body.destination_url);
  if (!url) return json({ error: "destination_url must be an absolute http or https URL without credentials" }, 400);
  const alias = body.alias === undefined || body.alias === "" ? null : customCode(body.alias);
  if (body.alias !== undefined && body.alias !== "" && !alias) return json({ error: "alias must be 4-64 URL-safe characters and not reserved" }, 400);
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = alias ?? randomCode();
    const response = await database(env, "links", token, { method: "POST", body: JSON.stringify({ workspace_id: workspace, code, destination_url: url, ...(project ? { project_id: project } : {}) }) });
    const data = response.ok ? await response.json() as unknown[] : null;
    if (response.ok) return json({ data: { ...(data?.[0] as object), short_url: await shortUrl(env, token, workspace, code, origin) } }, 201);
    if (response.status !== 409 || alias) return json({ error: response.status === 409 ? "alias is already in use" : "Unable to create link" }, response.status === 409 ? 409 : 400);
  }
  return json({ error: "Unable to generate a unique short code. Try again." }, 503);
}

async function api(request: Request, env: Env, pathname: string) {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  const token = authorization(request);
  if (!token) return json({ error: "Unauthorized" }, 401);
  const isIntegration = token.slice(7).startsWith("zyl_");
  const integration = isIntegration ? await projectForApiKey(env, token.slice(7)) : null;
  if (isIntegration && !integration) return json({ error: "Unauthorized" }, 401);
  const id = pathname.slice("/api/v1/links/".length);
  if (pathname === "/api/v1/links" && request.method === "GET") {
    const response = await database(env, "links?select=*,projects(name)&order=created_at.desc", token);
    return json(response.ok ? { data: await response.json() } : { error: "Unable to load links" }, response.ok ? 200 : 400);
  }
  if (pathname === "/api/v1/links" && request.method === "POST") {
    const body = await request.json().catch(() => null) as { destination_url?: unknown; alias?: unknown; project_id?: unknown } | null;
    if (isIntegration) {
      if (body?.project_id !== undefined || body?.alias !== undefined) return json({ error: "API keys create random links for their project; project_id and alias are not supported" }, 400);
      return createLink(env, `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, integration!.workspaceId, integration!.projectId, body ?? {}, request.url);
    }
    const workspace = await workspaceId(env, token);
    if (!workspace) return json({ error: "Workspace not found" }, 403);
    const project = body?.project_id === undefined ? null : projectId(body.project_id);
    if (body?.project_id !== undefined && (!project || !await belongsToWorkspace(env, token, project, workspace))) return json({ error: "Project not found" }, 400);
    return createLink(env, token, workspace, project, body ?? {}, request.url);
  }
  if (pathname === "/api/v1/workspace" && request.method === "GET") {
    if (integration) return json({ error: "Unauthorized" }, 401);
    const workspace = await workspaceId(env, token);
    if (!workspace) return json({ error: "Workspace not found" }, 403);
    const response = await database(env, `workspaces?id=eq.${workspace}&select=id,name,created_at&limit=1`, token);
    const [data] = response.ok ? await response.json() as unknown[] : [];
    return json(data ? { data } : { error: "Workspace not found" }, data ? 200 : 404);
  }
  if (pathname === "/api/v1/workspace" && request.method === "PATCH") {
    if (integration) return json({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => null) as { name?: unknown } | null;
    const name = projectName(body?.name);
    if (!name) return json({ error: "name must be 1-100 characters" }, 400);
    const workspace = await workspaceId(env, token);
    if (!workspace) return json({ error: "Workspace not found" }, 403);
    const response = await database(env, `workspaces?id=eq.${workspace}`, token, { method: "PATCH", body: JSON.stringify({ name }) });
    const [data] = response.ok ? await response.json() as unknown[] : [];
    return json(data ? { data } : { error: response.ok ? "Workspace not found" : "Unable to update workspace" }, data ? 200 : response.ok ? 404 : 400);
  }
  if (pathname === "/api/v1/projects" && request.method === "GET") {
    const response = await database(env, "projects?select=*&order=created_at.desc", token);
    return json(response.ok ? { data: await response.json() } : { error: "Unable to load projects" }, response.ok ? 200 : 400);
  }
  if (pathname === "/api/v1/projects" && request.method === "POST") {
    const body = await request.json().catch(() => null) as { name?: unknown } | null;
    const name = projectName(body?.name);
    if (!name) return json({ error: "name must be 1-100 characters" }, 400);
    const workspace = await workspaceId(env, token);
    if (!workspace) return json({ error: "Workspace not found" }, 403);
    const response = await database(env, "projects", token, { method: "POST", body: JSON.stringify({ workspace_id: workspace, name }) });
    const data = response.ok ? await response.json() as unknown[] : null;
    return json(response.ok ? { data: data?.[0] } : { error: "Unable to create project" }, response.ok ? 201 : 400);
  }
  if (pathname === "/api/v1/domains" && request.method === "GET") {
    if (integration) return json({ error:"Unauthorized" }, 401);
    const response = await database(env, "domains?select=id,hostname,status,created_at&order=created_at.desc", token);
    return json(response.ok ? { data:await response.json() } : { error:"Unable to load domains" }, response.ok ? 200 : 400);
  }
  if (pathname === "/api/v1/domains" && request.method === "POST") {
    if (integration) return json({ error:"Unauthorized" }, 401);
    const body = await request.json().catch(() => null) as {subdomain?:unknown}|null;
    const subdomain = platformSubdomain(body?.subdomain), workspace = await workspaceId(env, token), platform = env.PLATFORM_HOST || "zylin.yashpatil.dev";
    if (!subdomain || !workspace) return json({ error:"subdomain must be 3-63 lowercase letters, numbers, or hyphens" }, 400);
    const response = await database(env, "domains", token, { method:"POST", body:JSON.stringify({workspace_id:workspace,hostname:`${subdomain}.${platform}`,status:"active"}) });
    const data = response.ok ? await response.json() as unknown[] : null;
    return json(response.ok ? {data:data?.[0]} : {error:"A subdomain is already assigned to this workspace"}, response.ok ? 201 : 409);
  }
  const domainId = pathname.slice("/api/v1/domains/".length);
  if (/^[0-9a-f-]{36}$/i.test(domainId) && request.method === "PATCH") {
    if (integration) return json({ error:"Unauthorized" }, 401);
    const response = await database(env, `domains?id=eq.${domainId}&select=id,hostname,status,created_at&limit=1`, token);
    const [domain] = response.ok ? await response.json() as unknown[] : [];
    return json(domain ? {data:domain} : {error:"Not found"}, domain ? 200 : 404);
  }
  if (/^[0-9a-f-]{36}$/i.test(domainId) && request.method === "DELETE") {
    if (integration) return json({ error:"Unauthorized" }, 401);
    const response = await database(env, `domains?id=eq.${domainId}`, token, {method:"DELETE"});
    const data = response.ok ? await response.json() as unknown[] : [];
    return data[0] ? new Response(null, {status:204,headers:cors}) : json({error:"Not found"}, 404);
  }
  if (pathname === "/api/v1/analytics" && request.method === "GET") {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0); since.setUTCDate(since.getUTCDate() - 6);
    const [count, response] = await Promise.all([
      database(env, "click_events?select=id&limit=1", token, { headers:{ Prefer:"count=exact", Range:"0-0" } }),
      database(env, `click_events?select=link_id,clicked_at,links(code)&clicked_at=gte.${encodeURIComponent(since.toISOString())}&order=clicked_at.asc`, token),
    ]);
    if (!count.ok || !response.ok) return json({ error: "Unable to load analytics" }, 400);
    const data = summarizeClicks(await response.json() as ClickEvent[]);
    const total = Number(count.headers.get("content-range")?.split("/")[1]);
    return json({ data:{ ...data, total:Number.isFinite(total) ? total : data.total } });
  }
  if (pathname === "/api/v1/api-keys" && request.method === "GET") {
    if (integration) return json({ error: "Unauthorized" }, 401);
    const response = await database(env, "api_keys?select=id,project_id,name,key_prefix,created_at,projects(name)&order=created_at.desc", token);
    return json(response.ok ? { data: await response.json() } : { error: "Unable to load API keys" }, response.ok ? 200 : 400);
  }
  if (pathname === "/api/v1/api-keys" && request.method === "POST") {
    if (integration) return json({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => null) as { project_id?:unknown; name?:unknown } | null;
    const project = projectId(body?.project_id), name = typeof body?.name === "string" ? body.name.trim() : "";
    const workspace = await workspaceId(env, token);
    if (!project || !workspace || !await belongsToWorkspace(env, token, project, workspace) || !name || name.length > 100) return json({ error: "project_id must be yours and name must be 1-100 characters" }, 400);
    const key = apiKey();
    const response = await database(env, "api_keys?select=id,project_id,name,key_prefix,created_at", `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, { method:"POST", body:JSON.stringify({ project_id:project, name, key_prefix:key.slice(0, 12), key_hash:await hash(key) }) });
    const data = response.ok ? await response.json() as unknown[] : null;
    return json(response.ok ? { data:{ ...(data?.[0] as object), key } } : { error:"Unable to create API key" }, response.ok ? 201 : 400);
  }
  const keyId = pathname.slice("/api/v1/api-keys/".length);
  if (/^[0-9a-f-]{36}$/i.test(keyId) && request.method === "DELETE") {
    if (integration) return json({ error: "Unauthorized" }, 401);
    const response = await database(env, `api_keys?id=eq.${keyId}`, token, { method:"DELETE" });
    const data = response.ok ? await response.json() as unknown[] : [];
    return data[0] ? new Response(null, { status:204, headers:cors }) : json({ error:response.ok ? "Not found" : "Unable to delete API key" }, response.ok ? 404 : 400);
  }
  if (id && /^[0-9a-f-]{36}$/i.test(id) && request.method === "PATCH") {
    const body = await request.json().catch(() => null) as { destination_url?: unknown; alias?: unknown; status?: unknown; project_id?: unknown } | null;
    const patch: Record<string, string | null> = {};
    if (body?.destination_url !== undefined) { const url = destinationUrl(body.destination_url); if (!url) return json({ error: "destination_url must be an absolute http or https URL without credentials" }, 400); patch.destination_url = url; }
    if (body?.alias !== undefined) { const code = customCode(body.alias); if (!code) return json({ error: "alias must be 4-64 URL-safe characters and not reserved" }, 400); patch.code = code; }
    if (body?.status !== undefined) { if (body.status !== "active" && body.status !== "disabled") return json({ error: "status must be active or disabled" }, 400); patch.status = body.status; }
    if (body?.project_id !== undefined) {
      if (body.project_id === null) patch.project_id = null;
      else {
        const project = projectId(body.project_id);
        const workspace = await workspaceId(env, token);
        if (!project || !workspace || !await belongsToWorkspace(env, token, project, workspace)) return json({ error: "Project not found" }, 400);
        patch.project_id = project;
      }
    }
    if (!Object.keys(patch).length) return json({ error: "No supported changes" }, 400);
    const response = await database(env, `links?id=eq.${id}`, token, { method: "PATCH", body: JSON.stringify(patch) });
    const data = response.ok ? await response.json() as unknown[] : [];
    return json(data[0] ? { data: data[0] } : { error: response.ok ? "Not found" : "Unable to update link" }, data[0] ? 200 : response.ok ? 404 : response.status === 409 ? 409 : 400);
  }
  if (id && /^[0-9a-f-]{36}$/i.test(id) && request.method === "DELETE") {
    const response = await database(env, `links?id=eq.${id}`, token, { method: "DELETE" });
    const data = response.ok ? await response.json() as unknown[] : [];
    return data[0] ? new Response(null, { status: 204, headers: cors }) : json({ error: response.ok ? "Not found" : "Unable to delete link" }, response.ok ? 404 : 400);
  }
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env, url.pathname);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Not found", { status: 404 });
    if (!/^\/[A-Za-z0-9_-]{4,64}$/.test(url.pathname)) return new Response("Not found", { status: 404 });
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    let workspace = "";
    if (hostname !== (env.PLATFORM_HOST || "zylin.yashpatil.dev")) {
      const domain = await fetch(`${env.SUPABASE_URL}/rest/v1/domains?hostname=eq.${encodeURIComponent(hostname)}&status=eq.active&select=workspace_id&limit=1`, { headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`} });
      const [record] = domain.ok ? await domain.json() as {workspace_id:string}[] : [];
      if (!record) return new Response("Not found", {status:404});
      workspace = `&workspace_id=eq.${record.workspace_id}`;
    }
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/links?code=eq.${encodeURIComponent(url.pathname.slice(1))}&status=eq.active${workspace}&select=id,workspace_id,destination_url&limit=1`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!response.ok) return new Response("Not found", { status: 404 });
    const [link] = await response.json() as { id:string; workspace_id:string; destination_url: string }[];
    if (link && request.method === "GET") ctx.waitUntil(fetch(`${env.SUPABASE_URL}/rest/v1/click_events`, { method:"POST", headers:{ apikey:env.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type":"application/json" }, body:JSON.stringify({link_id:link.id,workspace_id:link.workspace_id}) }).catch(() => undefined));
    return link ? Response.redirect(link.destination_url, 302) : new Response("Not found", { status: 404 });
  },
};
