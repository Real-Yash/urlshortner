# Product Context

## Vision

Build a SaaS URL shortener for a focused audience, starting with WhatsApp/Instagram sellers and marketers. The value is branded links, reliable redirects, and useful campaign analytics—not merely shorter URLs.

## MVP

- User authentication and workspaces
- Create short links with custom aliases
- Fast redirects
- Basic click totals
- QR codes (deferred from Phase 1)

## Planned stack

- Next.js + TypeScript on Cloudflare Pages: static dashboard
- Supabase: PostgreSQL and authentication
- Cloudflare Worker: global redirect service and management API
- Redis: redirect lookup cache when it is needed
- Razorpay: India payments; Stripe later if needed

The stack is a direction, not implementation yet. Prefer managed services and native platform features over extra services.

## Product rules

- The product is API-first: the dashboard uses the same versioned management API available to customers.
- Redirects must stay fast and available.
- Capture analytics asynchronously; never make a redirect wait for it.
- Validate destination URLs and protect against abuse before public launch.
- Custom domains and billing come after the core redirect flow is solid.

## Explicitly deferred

- Advanced analytics and dashboards
- Link-in-bio pages, deep links, AI features
- Enterprise roles, approvals, and audit logs
- Phase 1 also defers Redis, custom domains, API keys, billing, and QR codes.

## Open decisions

- Primary customer niche
- Exact custom-domain onboarding flow
- Pricing and billing launch scope

## Change log

- 2026-07-20: Initial product direction and MVP recorded.
- 2026-07-20: Chose an API-first product architecture.
- 2026-07-20: Phase 1 uses one owner workspace automatically created for each authenticated user, session-authenticated `/api/v1/links` Worker endpoints, and direct Worker-to-Supabase active-link lookups. The static Next.js dashboard deploys to Cloudflare Pages. No redirect analytics or cache is in this phase so disabled/deleted links take effect immediately.
- 2026-07-20: GitHub Actions deploys pushes to `dev` to the `dev` Pages branch and `url-shortener-api-dev` Worker, while pushes to `main` deploy production. Both environments currently use the same Supabase project; a separate Supabase project is deferred until isolation is needed.
- 2026-07-21: The product is named Zylin. Its planned public domains are `zylin.com` for the dashboard and `zyl.in` for short links; until those domains are connected, the Cloudflare Pages deployment target is `zylin` at `zylin.pages.dev`.
- 2026-07-22: Production links use `https://zylin.yashpatil.dev`, a custom Worker domain in the existing `yashpatil.dev` Cloudflare zone, which is also the management API base URL. The domain binding is managed in the Cloudflare dashboard; the `workers.dev` endpoint is disabled in production.
- 2026-07-21: Projects are workspace-scoped campaign labels. A link can be assigned to one project when created; links without a project remain supported.
- 2026-07-22: Basic analytics records successful GET redirects asynchronously in `click_events`; the dashboard shows authenticated seven-day totals and top links. Event writes never block redirects.
