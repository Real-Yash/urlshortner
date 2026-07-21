import { projectId, projectName } from "../../app/lib/projects";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const codePattern = /^[A-Za-z0-9_-]{4,64}$/;
const reservedCodes = new Set(["api", "app", "login", "health", "favicon.ico", "robots.txt"]);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS" };

function json(data: unknown, status = 200) { return Response.json(data, { status, headers: cors }); }
function destinationUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password ? url.toString() : null; } catch { return null; }
}
function customCode(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const code = value.trim().toLowerCase();
  return codePattern.test(code) && !reservedCodes.has(code) ? code : null;
}
function randomCode() { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(8)))).replace(/[+/]/g, "_").replace(/=+$/, ""); }
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

async function api(request: Request, env: Env, pathname: string) {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  const token = authorization(request);
  if (!token) return json({ error: "Unauthorized" }, 401);
  const id = pathname.slice("/api/v1/links/".length);
  if (pathname === "/api/v1/links" && request.method === "GET") {
    const response = await database(env, "links?select=*,projects(name)&order=created_at.desc", token);
    return json(response.ok ? { data: await response.json() } : { error: "Unable to load links" }, response.ok ? 200 : 400);
  }
  if (pathname === "/api/v1/links" && request.method === "POST") {
    const body = await request.json().catch(() => null) as { destination_url?: unknown; alias?: unknown; project_id?: unknown } | null;
    const url = destinationUrl(body?.destination_url);
    const code = body?.alias === undefined || body.alias === "" ? randomCode() : customCode(body.alias);
    if (!url) return json({ error: "destination_url must be an absolute http or https URL without credentials" }, 400);
    if (!code) return json({ error: "alias must be 4-64 URL-safe characters and not reserved" }, 400);
    const workspace = await workspaceId(env, token);
    if (!workspace) return json({ error: "Workspace not found" }, 403);
    const project = body?.project_id === undefined ? null : projectId(body.project_id);
    if (body?.project_id !== undefined && (!project || !await belongsToWorkspace(env, token, project, workspace))) return json({ error: "Project not found" }, 400);
    const response = await database(env, "links", token, { method: "POST", body: JSON.stringify({ workspace_id: workspace, code, destination_url: url, ...(project ? { project_id: project } : {}) }) });
    const data = response.ok ? await response.json() as unknown[] : null;
    return json(response.ok ? { data: data?.[0] } : { error: response.status === 409 ? "alias is already in use" : "Unable to create link" }, response.ok ? 201 : response.status === 409 ? 409 : 400);
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env, url.pathname);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Not found", { status: 404 });
    if (!/^\/[A-Za-z0-9_-]{4,64}$/.test(url.pathname)) return new Response("Not found", { status: 404 });
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/links?code=eq.${encodeURIComponent(url.pathname.slice(1))}&status=eq.active&select=destination_url&limit=1`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!response.ok) return new Response("Not found", { status: 404 });
    const [link] = await response.json() as { destination_url: string }[];
    return link ? Response.redirect(link.destination_url, 302) : new Response("Not found", { status: 404 });
  },
};
