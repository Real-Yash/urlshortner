import assert from "node:assert/strict";
import test from "node:test";
import { customCode, destinationUrl, randomCode } from "../app/lib/links";
import { platformSubdomain } from "../app/lib/domains";
import worker from "../worker/src/index";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { projectId, projectName } from "../app/lib/projects";
import { summarizeClicks } from "../app/lib/analytics";

test("accepts safe destinations and aliases", () => {
  assert.equal(destinationUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(destinationUrl("ftp://example.com"), null);
  assert.equal(destinationUrl("https://user:pass@example.com"), null);
  assert.equal(customCode("Summer_Sale"), "summer_sale");
  assert.equal(customCode("api"), null);
  assert.equal(projectName(" Summer campaign "), "Summer campaign");
  assert.equal(projectName(" "), null);
  assert.equal(projectId("5c452e94-a14d-4e76-8cf5-48cd064b5b32"), "5c452e94-a14d-4e76-8cf5-48cd064b5b32");
  assert.equal(projectId("not-a-project"), null);
  assert.match(randomCode(), /^[A-Za-z0-9_]{6}$/);
});

test("summarizes click events by link", () => {
  const now = new Date().toISOString();
  const summary = summarizeClicks([{link_id:"1",clicked_at:now,links:{code:"sale"}},{link_id:"1",clicked_at:now,links:{code:"sale"}}]);
  assert.equal(summary.total, 2);
  assert.deepEqual(summary.links, [{code:"sale",clicks:2}]);
});

test("accepts safe platform subdomains", () => {
  assert.equal(platformSubdomain("My-Shop"), "my-shop");
  assert.equal(platformSubdomain("api"), null);
  assert.equal(platformSubdomain("go.example.com"), null);
});

test("lists domains using the current schema", async () => {
  const originalFetch = globalThis.fetch, calls:string[] = [];
  globalThis.fetch = async input => { calls.push(String(input)); return Response.json([]); };
  try {
    const response = await worker.fetch(new Request("https://api.example/api/v1/domains", {headers:{Authorization:"Bearer token"}}), {SUPABASE_URL:"https://db.example",SUPABASE_PUBLISHABLE_KEY:"",SUPABASE_SERVICE_ROLE_KEY:"",PLATFORM_HOST:"zylin.yashpatil.dev"}, {waitUntil(){}} as unknown as ExecutionContext);
    assert.equal(response.status, 200);
    assert.match(calls[0], /select=id,hostname,status,created_at/);
    assert.doesNotMatch(calls[0], /verification/);
  } finally { globalThis.fetch = originalFetch; }
});

test("updates only the caller's workspace settings", async () => {
  const originalFetch = globalThis.fetch, calls:{url:string;init?:RequestInit}[] = [];
  globalThis.fetch = async (input, init) => { const url = String(input); calls.push({url,init}); return Response.json(url.includes("workspace_members?") ? [{workspace_id:"workspace-1"}] : [{id:"workspace-1",name:"New workspace",created_at:"2026-07-22T00:00:00Z"}]); };
  try {
    const response = await worker.fetch(new Request("https://api.example/api/v1/workspace", {method:"PATCH",headers:{Authorization:"Bearer token","Content-Type":"application/json"},body:JSON.stringify({name:" New workspace "})}), {SUPABASE_URL:"https://db.example",SUPABASE_PUBLISHABLE_KEY:"",SUPABASE_SERVICE_ROLE_KEY:"",PLATFORM_HOST:"zylin.yashpatil.dev"}, {waitUntil(){}} as unknown as ExecutionContext);
    assert.equal(response.status, 200);
    assert.match(calls[1].url, /workspaces\?id=eq\.workspace-1/);
    assert.equal(calls[1].init?.method, "PATCH");
    assert.equal(calls[1].init?.body, '{"name":"New workspace"}');
  } finally { globalThis.fetch = originalFetch; }
});

test("scopes custom-host redirects to the domain workspace", async () => {
  const originalFetch = globalThis.fetch, calls:string[] = [];
  globalThis.fetch = async input => { const url = String(input); calls.push(url); return Response.json(url.includes("/domains?") ? [{workspace_id:"workspace-1"}] : [{id:"link-1",workspace_id:"workspace-1",destination_url:"https://example.com"}]); };
  try {
    const response = await worker.fetch(new Request("https://go.example.com/sale"), {SUPABASE_URL:"https://db.example",SUPABASE_PUBLISHABLE_KEY:"",SUPABASE_SERVICE_ROLE_KEY:"",PLATFORM_HOST:"zylin.yashpatil.dev"}, {waitUntil(){}} as unknown as ExecutionContext);
    assert.equal(response.status, 302);
    assert.match(calls[1], /workspace_id=eq\.workspace-1/);
  } finally { globalThis.fetch = originalFetch; }
});
