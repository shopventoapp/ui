# Maintenance scripts

Run scripts from the repository root with Bun 1.3.10. The root README lists all documentation commands.

| Script | Command | Purpose |
| --- | --- | --- |
| `copy-css.ts` | Called by `bun run build` | Copy the scoped styles and bundled font into the package output. |
| `generate-client.ts` | `bun run generate:client <backend-openapi.json>` | Generate narrow booking/account wire contracts. |
| `generate-shop-client.ts` | `bun run generate:shop-client <catalogue.json> <checkout.json> [legal.json]` | Generate public catalogue and checkout wire contracts. |
| `wire-documentation.ts` | Imported by generators | Preserve public TSDoc purpose and field comments when wire contracts are regenerated. |
| `public-type-names.ts` | Imported by generators | Replace backend module-qualified schema names with neutral public names. |
| `export-public-openapi.ts` | `bun run export:openapi <backend-openapi.json> [output.json]` | Select the exact client path/method allowlist, prune unreachable schemas and remove deployment/editorial metadata. Fails if a required operation or local reference is missing. |
| `export-public-openapi.ts` | `bun run export:openapi --from-wire [output.json]` | Explicit fallback: reconstruct schemas from bundled wire contracts and public call sites. Does not claim backend-only validation, errors or authorization rules. |
| `build-docs.ts` | `bun run docs:build` | Validate OpenAPI, embed checked examples, build Markdown and TypeDoc, bundle Redoc and emit `site/CNAME`. Requires no backend or credentials. |
| `check-docs-links.ts` | `bun run docs:check [site-directory]` | Validate local HTML destinations, fragments and assets; fail unsafe external links or remote runtime assets. Makes no network requests. |

The OpenAPI exporter deliberately does not call a server. To use a backend source, export `app.openapi()` offline with that backend project's Python environment, without starting the ASGI lifespan or database services, and pass the JSON path. Do not commit the unfiltered backend export. The committed fallback is documented in `openapi/README.md`.
