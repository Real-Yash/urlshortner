export const dynamic = "force-static";

export function GET() {
  return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#34433c"/><path d="M20 20h24L20 44h24" fill="none" stroke="#e9ead9" stroke-linecap="round" stroke-linejoin="round" stroke-width="7"/></svg>', { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" } });
}
