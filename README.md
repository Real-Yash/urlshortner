# Zylin

Phase 1 is a static Next.js dashboard on Cloudflare Pages, backed by Supabase Auth/Postgres, plus a Cloudflare Worker for the versioned management API and public redirects.

## Setup

1. Install dependencies: `npm install`.
2. Link the project and apply the schema: `supabase link --project-ref <project-ref>` then `supabase db push`. In Supabase Auth URL Configuration, use the production Pages URL as Site URL and allow `http://localhost:3000/**` plus the `dev` Pages URL.
3. Copy `.env.example` to `.env.local`, fill in the public Supabase URL, publishable key, and Worker URL.
4. In Supabase Auth, enable Email/Password. If email confirmation is enabled, confirm the email before signing in.
5. Run the dashboard with `npm run dev`; verify it with `npm run typecheck`, `npm test`, and `npm run build`.
6. Deploy the Worker with `npm run worker:deploy` after configuring `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets. Set `NEXT_PUBLIC_API_URL` to `https://zylin.yashpatil.dev`, then deploy the dashboard with `npm run pages:deploy`.
7. GitHub Actions deploys `dev` to the development Worker/Pages branch and `main` to production. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets; set the three `NEXT_PUBLIC_*` values as environment variables in both the `development` and `production` GitHub environments.

The API uses the logged-in Supabase session and exposes `POST`/`GET /api/v1/links` plus `PATCH`/`DELETE /api/v1/links/:id`.

Product decisions live in [CONTEXT.md](CONTEXT.md); architecture is in [ARCHITECTURE.md](ARCHITECTURE.md).
