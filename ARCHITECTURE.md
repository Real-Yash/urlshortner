# Architecture

## Goal

An API-first SaaS URL shortener: customers and the dashboard use a versioned management API; public redirects use the shortest possible hot path.

```text
Dashboard / customer integration
            |
            v
 app.example.com ----------> Cloudflare Worker API --> Supabase Postgres
            |                              |
            |                              +--> async click aggregation
            v
Public domain/code --> Cloudflare Worker --> Supabase Postgres --> 302
```

## Public URL and API format

```text
https://example.com/aB3x9Q                 # platform short link
https://go.customer.com/summer-sale         # customer custom domain
https://api.example.com/v1/links            # management API
```

`code` is random by default, URL-safe, and case-sensitive. A customer may request a custom alias after validation. Reserve platform routes (`api`, `app`, `login`, `health`, `favicon.ico`, `robots.txt`) so links cannot shadow them.

## Components

| Component | Responsibility | Must not do |
| --- | --- | --- |
| Next.js static app | Dashboard and auth UI on Cloudflare Pages | Handle public redirects or management API |
| Supabase | Postgres, Auth, row-level security | Be a synchronous analytics warehouse |
| Cloudflare Worker | Management API, match host + code, and redirect | Wait for click storage |
| Cache | `host + code` to redirect record | Be the sole source of truth |
| Async analytics worker/queue | Record and aggregate allowed clicks | Affect redirect status or latency |
| Razorpay webhook endpoint | Verify and apply subscription state | Trust browser return URLs |

Redis is optional. Start with Cloudflare cache plus the database; add Redis only after measured cache-miss latency or write load proves it necessary.

## Phase 1 implementation

The initial schema contains only `workspaces`, `workspace_members`, and `links`. A security-definer signup trigger creates one owner workspace per user; RLS limits every link query to that membership. The static dashboard calls the session-authenticated Worker routes at `/api/v1/links`. The Worker performs a direct active-link lookup using its Supabase service credential and responds with `302`; it has no cache or analytics path, so a disabled/deleted link is never served stale.

## Core data model

```text
workspaces(id, name, plan, status)
workspace_members(workspace_id, user_id, role)
domains(id, workspace_id, hostname, status)
links(id, workspace_id, domain_id, code, destination_url, redirect_type,
      status, expires_at, password_hash, created_at, updated_at)
api_keys(id, project_id, name, key_prefix, secret_hash, created_at)
daily_link_stats(link_id, day, clicks, unique_visitors_estimate, ...)
subscriptions(workspace_id, provider, provider_subscription_id, status, current_period_end)
```

Unique constraints: `domains.hostname`; `(links.domain_id, links.code)`; `api_keys.key_prefix`. API keys are project-scoped and store only a SHA-256 hash; deleting a key revokes it. Soft-delete links only if the product promises recovery; otherwise delete and invalidate cache.

## Management API

All endpoints are under `/v1`, require a workspace-scoped API key or user session, enforce workspace ownership through RLS, and return a request ID.

```text
POST   /v1/links
GET    /v1/links?cursor=...
GET    /v1/links/{id}
PATCH  /v1/links/{id}
DELETE /v1/links/{id}
GET    /v1/links/{id}/stats
POST   /v1/domains
POST   /v1/api-keys
DELETE /v1/api-keys/{id}
```

Require an idempotency key for `POST /links` and billing-changing operations. Paginate with opaque cursors, not offsets. Rate-limit per API key and workspace. Never expose a key again after creation; store only a slow hash and a display prefix.

## Redirect flow

1. Worker normalizes the request host (lowercase, remove a terminal dot) and extracts exactly one code path segment.
2. Reject malformed paths, reserved routes, unknown hosts, and inactive domains with a neutral 404.
3. Look up `host + code` in cache; on a miss, fetch the active link from the database and populate cache with a short TTL.
4. Enforce link status, expiration, password requirement, and plan/domain state.
5. Return `302` by default. Allow a deliberate `301` only for permanent links: browsers cache it aggressively and it is hard to undo.
6. Send a minimal event to asynchronous analytics using `waitUntil`; redirect even if it fails.

Cache invalidation is required on every link/domain create, update, disable, delete, expiry, and destination change. TTL is the safety net when invalidation misses.

## Security and abuse controls

- Accept only absolute `http:` and `https:` destination URLs. Block credentials in URLs, localhost, private/link-local IP ranges, and internal hostnames; re-check after DNS resolution if destination validation runs server-side.
- Reject dangerous aliases: empty, overly long, Unicode-confusable, reserved, and values containing path separators or percent-encoded separators. Normalize custom aliases to lowercase to avoid visual ambiguity.
- Authenticate API calls with hashed, revocable, workspace-scoped keys. Separate customer keys from internal service credentials.
- Use RLS plus server-side workspace checks; never take `workspace_id` from an untrusted request as authorization.
- Rate-limit creation, management endpoints, password attempts, and redirect traffic per IP/domain. Add CAPTCHA or manual review only when abuse data justifies it.
- Do not log full destination URLs, API keys, cookies, or raw IP addresses unnecessarily. Define retention before storing click data.
- Set security headers on dashboard/API. Redirect responses need no user-controlled HTML. Password pages must use CSRF protection, secure cookies, and a slow password hash.

## Domains

Dashboard claims a unique `brand.zylin.yashpatil.dev` hostname -> wildcard DNS sends it to the Worker -> Worker accepts traffic only for links in the owning workspace. Customer-owned domains remain deferred until Cloudflare for SaaS is justified.

Handle: hostname already claimed, DNS propagation delay, invalid CNAME, apex-domain limitations, SSL not ready, domain disabled/expired, ownership re-verification, and a customer removing DNS later. Do not activate a domain based on a browser callback.

## Analytics

The redirect emits an event containing link ID, timestamp, normalized referrer host, coarse country, and device class. Remove or hash identifiers according to the privacy policy. An async consumer aggregates into `daily_link_stats`; the dashboard reads aggregates, not raw events.

Count bots separately where possible. Treat analytics as approximate: ad blockers, prefetchers, retries, VPNs, and bot scanners make exact unique-click counts impossible. Never promise exact uniqueness.

## Billing and entitlements

Use provider webhooks as the authority. Verify their signatures, store event IDs to make handling idempotent, and apply the resulting subscription status to `workspaces.plan`/`status`.

Entitlements are checked in the management API: number of links, active domains, API rate, team members, and analytics retention. On payment failure, use an explicit grace period; after it, block new creation while preserving existing redirects unless the published policy says otherwise. Never disable all customer links because a webhook was delayed.

## Failure behavior

| Situation | Behavior |
| --- | --- |
| Cache unavailable | Database fallback; observe latency/error rate |
| Database unavailable | Serve still-valid cached redirect; otherwise neutral 404/503, never guess |
| Analytics unavailable | Redirect normally and drop/retry event without blocking |
| Unknown/disabled/expired link | 404 by default; do not reveal whether it once existed |
| Invalid destination or open-redirect attempt | Reject at create/update time |
| Cache stale after update | Invalidate; TTL limits residual stale redirects |
| Duplicate create request | Return prior result for same idempotency key |
| Webhook replay/out of order | Verify signature, deduplicate event ID, apply provider's current state |
| Custom domain unavailable | Platform domain remains usable; surface domain status in dashboard |

## Build order

1. Supabase schema, Auth, RLS, and management API for one workspace/user.
2. Worker redirect path with platform domain, cache, validation, and invalidation.
3. Dashboard using only `/v1` endpoints.
4. Async aggregate click counts and a small stats view.
5. Project API keys, custom domains, then billing.

## Decisions still needed

- Platform domain and branding
- Redirect default (`302` recommended) and whether customers may choose `301`
- Privacy policy, analytics retention, and supported regions
- Link deletion/recovery policy and pricing limits
