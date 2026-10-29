# Public Shop API subset

`shop-api.json` is an OpenAPI 3.1 document restricted to operations the package calls. `scripts/export-public-openapi.ts` contains the explicit 45-operation / 40-path allowlist. The exporter selects methods as well as paths, retains only reachable components and security definitions, removes editorial/deployment metadata, applies the wire generator's neutral schema renames and emits the server template `https://{installation}.shopvento.app`.

## Current source

Generated with `bun run export:openapi --from-wire`. The requested backend checkout did not contain its `.venv/bin/python`, so importing the FastAPI app with that project's environment was unavailable. No backend server or database was started, and no backend files were changed.

The fallback uses TypeScript's type checker over `src/wire.ts`, `src/shop-wire.ts` and the public client contract in `src/client.ts`. It preserves resolved request/response fields and optionality. OAuth status and redirect query shapes come from `src/account-entry.tsx`. It does not invent backend-only formats, bounds, response errors or authorization rules. This limitation is stated in the OpenAPI info description and rendered API page.

The scope includes public events, timewindows, locations, guest/account booking, voucher checks, customer authentication/profile/addresses, dashboard orders/bookings/reservations/vouchers/newsletter, catalogue/articles, quotes, checkout and confirmation. No legal-content endpoint is called by the current clients, so none is added; host legal text is supplied as component props. Google status/start are included because the public component calls them; callbacks and admin/internal endpoints are excluded.

## Refresh

Prefer `bun run export:openapi /absolute/path/backend-openapi.json` once the backend environment/export is available. This fails on missing allowlisted operations or references. Then run `bun run docs:build`, `bun run docs:check` and `bun test`. Never publish the unfiltered backend export. Runtime reference rendering is local and read-only, with telemetry disabled and no requests to an installation.
