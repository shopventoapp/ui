# Contributing

Thanks for helping. Bug reports and pull requests are welcome on GitHub.

## Setup

The package uses [Bun](https://bun.sh). Install the pinned dependencies with:

```sh
bun install --frozen-lockfile
```

## Checks

Run these before opening a pull request. CI runs the same steps.

| Command | Purpose |
| --- | --- |
| `bun run lint` | Biome and the TypeScript compiler over `src`, `tests` and `scripts` |
| `bun run typecheck` | TypeScript only |
| `bun test` | Component and hook tests with happy-dom and mocked `fetch` |
| `bun run build` | ESM bundle and declarations in `dist`, plus the CSS and font |
| `bun run pack` | Build and write a tarball to `artifacts/` for local testing in a consumer |

## Wire contracts

`src/wire.ts` and `src/shop-wire.ts` are generated from the backend OpenAPI export. Do not edit them by hand.

```sh
bun run generate:client /absolute/path/openapi.json
bun run generate:shop-client /absolute/path/catalogue-openapi.json /absolute/path/checkout-openapi.json [/absolute/path/legal-openapi.json]
```

The generators keep only the operations this package uses, drop the backend module prefix from schema names and format the result with Biome. Rerun all checks afterwards.

## Pull requests

- Keep changes focused and add a test for new behaviour.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages (`feat:`, `fix:`, `docs:`, `chore:`).
- Add an entry to `CHANGELOG.md` under "Unreleased".
- Public exports, props and `--sv-*` tokens are part of the API. Removing or renaming one is a breaking change.

## Releases

Maintainers bump `version` in `package.json`, update `CHANGELOG.md`, and push a tag `vX.Y.Z` matching the version. The release workflow runs all checks and publishes to npm with provenance.
