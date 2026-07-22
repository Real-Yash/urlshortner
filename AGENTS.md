# Agent Instructions

Start each task by reading `CONTEXT.md`. It is the source of truth for the product direction and current decisions.

Supabase CLI and MCP access are available. Before pushing a migration, review its SQL and security implications, run a remote migration check/dry run, then verify the applied schema with a safe read-only query.

- Keep changes small and ship only the requested scope.
- Preserve a fast, reliable redirect path; do not add blocking analytics work to it.
- Do not add dependencies or infrastructure without a concrete need.
- Update `CONTEXT.md` in the same change when the product vision, chosen stack, architecture, scope, or a decision that affects future development changes.
- Update `README.md` when setup or local commands change.
- If a decision is unclear, record it under **Open decisions** rather than inventing it.
