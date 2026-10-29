import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkDocsLinks } from "../scripts/check-docs-links";
import {
  exportPublicOpenApi,
  publicRoutes,
} from "../scripts/export-public-openapi";

function backendFixture() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [path, method] of publicRoutes) {
    paths[path] ??= {};
    paths[path][method] = {
      summary: "Private editorial text",
      responses: {
        "200": {
          description: "Backend response",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/app__schemas__shop_orders__ShopArticle",
              },
            },
          },
        },
      },
    };
  }
  paths["/api/admin/private"] = { get: { responses: {} } };
  paths["/api/shop/settings"].delete = { responses: {} };
  return {
    paths,
    components: {
      schemas: {
        app__schemas__shop_orders__ShopArticle: {
          type: "object",
          properties: {
            description: { type: "string", description: "Private prose" },
            nested: { $ref: "#/components/schemas/Child" },
          },
          required: ["description"],
        },
        Child: { type: "string", enum: ["ACTIVE", "PAUSED"] },
        UnusedAdmin: { type: "string" },
      },
    },
  };
}

test("public OpenAPI selects exact methods, prunes unreachable schemas and renames local refs", () => {
  const result = exportPublicOpenApi(
    backendFixture() as Parameters<typeof exportPublicOpenApi>[0],
  );
  const serialized = JSON.stringify(result);
  expect(serialized.includes("/api/admin/private")).toBe(false);
  expect(serialized.includes("UnusedAdmin")).toBe(false);
  expect(serialized.includes("__schemas__")).toBe(false);
  const paths = result.paths as Record<string, Record<string, unknown>>;
  expect(Object.keys(paths["/api/shop/settings"])).toEqual(["get"]);
  expect(Object.keys(paths)).toHaveLength(40);
  const schemas = (result.components as { schemas: Record<string, unknown> })
    .schemas;
  expect(Object.keys(schemas).sort()).toEqual([
    "Child",
    "ShopOrdersShopArticle",
  ]);
  expect(
    serialized.includes("#/components/schemas/ShopOrdersShopArticle"),
  ).toBe(true);
  expect(schemas.ShopOrdersShopArticle).toEqual({
    type: "object",
    properties: {
      description: { type: "string" },
      nested: { $ref: "#/components/schemas/Child" },
    },
    required: ["description"],
  });
});

test("public OpenAPI fails closed on a missing allowed operation or unresolved/external ref", () => {
  const missing = backendFixture();
  delete missing.paths["/api/shop/settings"].get;
  expect(() =>
    exportPublicOpenApi(missing as Parameters<typeof exportPublicOpenApi>[0]),
  ).toThrow("Missing public operation");
  const unresolved = backendFixture();
  unresolved.components.schemas.app__schemas__shop_orders__ShopArticle.properties.nested.$ref =
    "#/components/schemas/Missing";
  expect(() =>
    exportPublicOpenApi(
      unresolved as Parameters<typeof exportPublicOpenApi>[0],
    ),
  ).toThrow("Unresolved component");
  unresolved.components.schemas.app__schemas__shop_orders__ShopArticle.properties.nested.$ref =
    "https://private.example/schema.json";
  expect(() =>
    exportPublicOpenApi(
      unresolved as Parameters<typeof exportPublicOpenApi>[0],
    ),
  ).toThrow("Only local component references");
});

test("committed wire fallback validates as OpenAPI and retains catalogue descriptions and guest consent", async () => {
  const validation = Bun.spawn(
    [
      "bun",
      "-e",
      'import parser from "@apidevtools/swagger-parser"; await parser.validate("openapi/shop-api.json");',
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(await validation.exited).toBe(0);
  const document = await Bun.file("openapi/shop-api.json").json();
  expect(document.openapi).toBe("3.1.0");
  expect(
    Object.values(document.paths ?? {}).reduce(
      (total: number, item: unknown) =>
        total +
        Object.keys(item ?? {}).filter((key) =>
          ["get", "post", "put", "patch", "delete"].includes(key),
        ).length,
      0,
    ),
  ).toBe(45);
  const text = await Bun.file("openapi/shop-api.json").text();
  expect(text.includes('"terms_privacy_accepted"')).toBe(true);
  expect(text.includes('"description": {')).toBe(true);
  expect(/vinovista|genusswerte|weinbar|\bvv\./i.test(text)).toBe(false);
});

test("link checker rejects broken fragments, missing files and unsafe outbound attributes", async () => {
  const root = await mkdtemp(join(tmpdir(), "shopvento-docs-links-"));
  try {
    await writeFile(
      join(root, "index.html"),
      '<h1 id="main">Home</h1><a href="#main">Local</a><a href="https://shopvento.de" target="_blank" rel="noopener noreferrer">Site</a>',
    );
    expect((await checkDocsLinks(root)).pages).toBe(1);
    for (const href of ["#missing", "/missing.html", "https://shopvento.de"]) {
      await writeFile(join(root, "index.html"), `<a href="${href}">Broken</a>`);
      await expect(checkDocsLinks(root)).rejects.toThrow();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("theme guide covers every package CSS token", async () => {
  const guide = await Bun.file("docs/guides/theming.md").text();
  const sources = await Promise.all(
    [
      "styles.css",
      "booking-redesign.css",
      "dashboard.css",
      "shop.css",
      "shop-components.tsx",
    ].map((file) => Bun.file(`src/${file}`).text()),
  );
  const tokens = new Set(sources.join("\n").match(/--sv-[a-z0-9-]+/g));
  expect(tokens.size).toBeGreaterThan(50);
  for (const token of tokens) expect(guide.includes(`\`${token}\``)).toBe(true);
});
