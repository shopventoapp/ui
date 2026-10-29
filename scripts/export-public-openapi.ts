/** Export the public client surface from a backend OpenAPI export or bundled wire types. */
import { resolve } from "node:path";
import ts from "typescript";
import { publicTypeNames } from "./public-type-names";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type ObjectSchema = { [key: string]: Json };
type Route = readonly [
  path: string,
  method: string,
  name: string,
  group: string,
];
/** Exact operations called by the published clients. Other methods fail closed. */
export const publicRoutes: readonly Route[] = [
  ["/api/shop/tastings/", "get", "listEvents", "Events"],
  ["/api/shop/tastings/timewindows", "get", "listTimewindows", "Events"],
  ["/api/shop/tastings/locations", "get", "listLocations", "Events"],
  ["/api/shop/tastings/bookings", "post", "submitBooking", "Bookings"],
  [
    "/api/shop/tastings/bookings/guest",
    "post",
    "submitGuestBooking",
    "Bookings",
  ],
  ["/api/shop/vouchers/{code}", "get", "checkVoucher", "Vouchers"],
  ["/api/shop/orders/", "get", "orders", "Customer account"],
  ["/api/shop/tastings/bookings", "get", "bookings", "Customer account"],
  [
    "/api/shop/tastings/bookings/{booking_id}",
    "get",
    "booking",
    "Customer account",
  ],
  [
    "/api/shop/tastings/bookings/{booking_id}/move",
    "post",
    "moveBooking",
    "Customer account",
  ],
  ["/api/shop/table-reservations", "get", "reservations", "Customer account"],
  [
    "/api/shop/table-reservations/{reservation_id}",
    "get",
    "reservation",
    "Customer account",
  ],
  [
    "/api/shop/table-reservations/{reservation_id}",
    "patch",
    "updateReservation",
    "Customer account",
  ],
  [
    "/api/shop/table-reservations/{reservation_id}/cancel",
    "post",
    "cancelReservation",
    "Customer account",
  ],
  ["/api/shop/vouchers/customer", "get", "vouchers", "Customer account"],
  [
    "/api/shop/vouchers/customer/{voucher_id}",
    "get",
    "voucher",
    "Customer account",
  ],
  [
    "/api/shop/vouchers/customer/{voucher_id}/history",
    "get",
    "voucherHistory",
    "Customer account",
  ],
  [
    "/api/shop/orders/{order_id}/withdrawal-items",
    "get",
    "withdrawalItems",
    "Customer account",
  ],
  [
    "/api/shop/orders/{order_id}/cancellation-request",
    "post",
    "withdraw",
    "Customer account",
  ],
  ["/api/shop/user/profile", "put", "updateProfile", "Customer account"],
  [
    "/api/shop/user/newsletter/unsubscribe",
    "post",
    "newsletterUnsubscribe",
    "Customer account",
  ],
  ["/api/shop/user/shipping-addresses", "get", "addresses", "Customer account"],
  [
    "/api/shop/user/shipping-addresses",
    "post",
    "createAddress",
    "Customer account",
  ],
  [
    "/api/shop/user/shipping-addresses/{shipping_address_id}",
    "put",
    "updateAddress",
    "Customer account",
  ],
  [
    "/api/shop/user/shipping-addresses/{shipping_address_id}",
    "delete",
    "deleteAddress",
    "Customer account",
  ],
  [
    "/api/shop/user/password-update",
    "post",
    "updatePassword",
    "Customer account",
  ],
  ["/api/shop/user/update-email", "post", "updateEmail", "Customer account"],
  ["/api/shop/user/login", "post", "login", "Authentication"],
  ["/api/shop/user/register", "post", "register", "Authentication"],
  ["/api/shop/user/password-reset", "post", "passwordReset", "Authentication"],
  [
    "/api/shop/user/password-reset/confirm",
    "post",
    "passwordSet",
    "Authentication",
  ],
  ["/api/shop/user/verify-email", "post", "emailVerify", "Authentication"],
  [
    "/api/shop/user/confirm-email-change",
    "post",
    "emailChangeConfirm",
    "Authentication",
  ],
  ["/api/shop/user/profile", "get", "profile", "Customer account"],
  ["/api/shop/user/logout", "post", "logout", "Authentication"],
  ["/api/shop/settings", "get", "settings", "Settings"],
  [
    "/api/shop/user/google-auth/status",
    "get",
    "googleAuthStatus",
    "Authentication",
  ],
  ["/api/shop/user/google-auth", "get", "googleAuth", "Authentication"],
  ["/api/shop/articles/catalogue", "get", "catalogue", "Shop"],
  ["/api/shop/articles/", "get", "shopVouchers", "Shop"],
  ["/api/shop/articles/{article_slug}", "get", "article", "Shop"],
  ["/api/shop/cart/", "post", "quote", "Shop"],
  ["/api/shop/checkout/create-checkout-session", "post", "checkout", "Shop"],
  ["/api/shop/orders/{order_id}", "get", "order", "Shop"],
  ["/api/shop/checkout/confirm-checkout", "post", "confirm", "Shop"],
];
const blocked =
  /vinovista|genusswerte|weinbar|\bvv\.|localhost|127\.0\.0\.1|\.internal\b|sascha|kazuhiko/iu;
function neutral(value: string): string {
  return publicTypeNames(value)
    .replace(/genusswerte|vinovista|weinbar/gi, "Shopvento")
    .replace(/[\u2013\u2014]/g, "-");
}
/** Drop editorial and deployment metadata, retain the actual schema constraints. */
function clean(value: Json, mapKeys = false): Json {
  if (typeof value === "string") {
    if (/https?:\/\//i.test(value))
      return "https://{installation}.shopvento.app";
    const result = neutral(value);
    if (blocked.test(result))
      throw new Error("Disallowed private text in API contract");
    return result;
  }
  if (Array.isArray(value)) return value.map((item) => clean(item));
  if (!value || typeof value !== "object") return value;
  const result: ObjectSchema = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      !mapKeys &&
      ([
        "description",
        "summary",
        "example",
        "examples",
        "externalDocs",
        "contact",
        "license",
        "servers",
      ].includes(key) ||
        key.startsWith("x-"))
    )
      continue;
    const name = neutral(key);
    if (name in result)
      throw new Error("Schema names collide after neutral renaming");
    result[name] = clean(
      item,
      [
        "properties",
        "schemas",
        "$defs",
        "patternProperties",
        "responses",
        "headers",
        "securitySchemes",
      ].includes(key),
    );
  }
  return result;
}
const jsonContent = (schema: ObjectSchema) => ({
  "application/json": { schema },
});
function object(value: Json | undefined): ObjectSchema {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object in API contract");
  return value;
}

/** Use TypeScript's resolved public wire types, without guessing backend-only validation. */
function fromWire(): ObjectSchema {
  const configPath = ts.findConfigFile(".", ts.sys.fileExists, "tsconfig.json");
  if (!configPath) throw new Error("Missing tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ".");
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const schemas: ObjectSchema = {};
  const aliases = new Map<string, ts.Type>();
  for (const path of ["src/wire.ts", "src/shop-wire.ts", "src/client.ts"]) {
    const file =
      program.getSourceFile(resolve(path)) ?? program.getSourceFile(path);
    if (!file) throw new Error(`Missing ${path}`);
    for (const node of file.statements) {
      if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))
        aliases.set(node.name.text, checker.getTypeAtLocation(node));
    }
  }
  function schema(type: ts.Type, root = false): ObjectSchema {
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
      return { description: "Not specified by the bundled wire contract." };
    if (type.isStringLiteral()) return { type: "string", const: type.value };
    if (type.isNumberLiteral()) return { type: "number", const: type.value };
    if (type.flags & ts.TypeFlags.BooleanLiteral)
      return { type: "boolean", const: checker.typeToString(type) === "true" };
    if (type.flags & ts.TypeFlags.String) return { type: "string" };
    if (type.flags & ts.TypeFlags.Number) return { type: "number" };
    if (type.flags & ts.TypeFlags.Boolean) return { type: "boolean" };
    if (type.flags & ts.TypeFlags.Null) return { type: "null" };
    if (type.isUnion()) {
      const types = type.types.filter(
        (part) => !(part.flags & ts.TypeFlags.Undefined),
      );
      if (types.length === 1) return schema(types[0]);
      return { anyOf: types.map((part) => schema(part)) };
    }
    if (checker.isArrayType(type))
      return {
        type: "array",
        items: schema(checker.getTypeArguments(type as ts.TypeReference)[0]),
      };
    const name = type.aliasSymbol?.name;
    if (!root && name && aliases.has(name)) {
      if (!schemas[name]) {
        schemas[name] = {};
        schemas[name] = schema(type, true);
      }
      return { $ref: `#/components/schemas/${name}` };
    }
    const properties: ObjectSchema = {};
    const required: string[] = [];
    for (const prop of type.getProperties()) {
      const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
      if (!declaration) throw new Error(`Missing declaration ${prop.name}`);
      properties[prop.name] = schema(
        checker.getTypeOfSymbolAtLocation(prop, declaration),
      );
      if (!(prop.flags & ts.SymbolFlags.Optional)) required.push(prop.name);
    }
    const index = type.getStringIndexType();
    return {
      type: "object",
      ...(Object.keys(properties).length ? { properties } : {}),
      ...(required.length ? { required } : {}),
      ...(index ? { additionalProperties: schema(index) } : {}),
    };
  }
  function member(type: ts.Type, key: string): ts.Type {
    const symbol = type.getProperty(key);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    if (!symbol || !declaration) throw new Error(`Missing wire member ${key}`);
    return checker.getTypeOfSymbolAtLocation(symbol, declaration);
  }
  function named(name: string): ObjectSchema {
    const type = aliases.get(name);
    if (!type) throw new Error(`Missing wire alias ${name}`);
    if (!schemas[name]) schemas[name] = schema(type, true);
    return { $ref: `#/components/schemas/${name}` };
  }
  const paths: ObjectSchema = {};
  for (const [path, method, name] of publicRoutes) {
    let response: ObjectSchema;
    let body: ObjectSchema | undefined;
    const account = aliases.get("AccountOperations");
    const shop = aliases.get("ShopOperations");
    const shopName = name === "shopVouchers" ? "vouchers" : name;
    if (name === "settings") response = named("ShopSettings");
    else if (account?.getProperty(name) && name !== "shopVouchers") {
      const operation = member(account, name);
      response = schema(member(operation, "response"));
      const input = member(operation, "body");
      if (!(input.flags & ts.TypeFlags.Undefined)) body = schema(input);
    } else if (shop?.getProperty(shopName)) {
      const operation = member(shop, shopName);
      response = schema(member(operation, "response"));
      const input = member(operation, "body");
      if (!(input.flags & ts.TypeFlags.Undefined)) body = schema(input);
    } else if (name === "listEvents")
      response = { type: "array", items: named("ShopEvent") };
    else if (name === "listTimewindows")
      response = {
        type: "object",
        required: ["timewindows", "total"],
        properties: {
          timewindows: { type: "array", items: named("Timewindow") },
          total: { type: "number" },
        },
      };
    else if (name === "listLocations")
      response = {
        type: "object",
        required: ["locations", "total"],
        properties: {
          locations: { type: "array", items: named("Location") },
          total: { type: "number" },
        },
      };
    else if (name === "checkVoucher") response = named("VoucherCheck");
    else if (name === "submitBooking" || name === "submitGuestBooking") {
      body = named(
        name === "submitBooking"
          ? "ShopBookingRequest"
          : "ShopGuestBookingRequest",
      );
      response = named("ShopBookingResponse");
    } else if (name === "googleAuthStatus")
      response = {
        type: "object",
        required: ["enabled"],
        properties: { enabled: { type: "boolean" } },
      };
    else if (name === "googleAuth") response = {};
    else throw new Error(`Unmapped public operation ${name}`);
    const parameters: Json[] = [...path.matchAll(/\{([^}]+)\}/g)].map(
      (match) => ({
        name: match[1],
        in: "path",
        required: true,
        schema: { type: "string" },
      }),
    );
    if (name === "listTimewindows") {
      for (const key of ["tasting_id", "location_id", "start_date", "end_date"])
        parameters.push({
          name: key,
          in: "query",
          required: false,
          schema: { type: key.endsWith("_id") ? "integer" : "string" },
        });
    }
    if (name === "googleAuth")
      for (const key of ["success_redirect_url", "failure_redirect_url"])
        parameters.push({
          name: key,
          in: "query",
          required: false,
          schema: { type: "string", format: "uri" },
        });
    const code = name === "googleAuth" ? "302" : "200";
    const operation: ObjectSchema = {
      parameters,
      ...(body
        ? { requestBody: { required: true, content: jsonContent(body) } }
        : {}),
      responses: {
        [code]: {
          description:
            name === "googleAuth"
              ? "Redirect to the configured identity provider."
              : "Successful response. Validation constraints not present in the wire types remain installation-defined.",
          ...(name === "googleAuth" ? {} : { content: jsonContent(response) }),
        },
      },
    };
    const item = paths[path] ? object(paths[path]) : {};
    item[method] = operation;
    paths[path] = item;
  }
  return { paths, components: { schemas } };
}

export function exportPublicOpenApi(
  source: ObjectSchema,
  wire = false,
): ObjectSchema {
  const sourcePaths = object(source.paths);
  const paths: ObjectSchema = {};
  for (const [path, method, name, group] of publicRoutes) {
    const item = object(sourcePaths[path]);
    if (!item[method])
      throw new Error(
        `Missing public operation: ${method.toUpperCase()} ${path}`,
      );
    const operation = object(clean(item[method]));
    operation.operationId = name;
    operation.summary = name.replace(/([a-z])([A-Z])/g, "$1 $2");
    operation.tags = [group];
    // Path-level parameters and security definitions are structural, not editorial.
    if (item.parameters)
      operation.parameters = [
        ...(clean(item.parameters) as Json[]),
        ...((operation.parameters as Json[] | undefined) ?? []),
      ];
    if (source.security && !operation.security)
      operation.security = clean(source.security);
    if (operation.callbacks) delete operation.callbacks;
    if (operation.links) delete operation.links;
    // Responses require descriptions in OpenAPI, even when private descriptions are dropped.
    for (const response of Object.values(object(operation.responses))) {
      if (
        response &&
        typeof response === "object" &&
        !Array.isArray(response) &&
        !response.$ref
      )
        response.description = "Response from the installation.";
    }
    const target = paths[path] ? object(paths[path]) : {};
    target[method] = operation;
    paths[path] = target;
  }
  const components: ObjectSchema = {};
  const sourceComponents = source.components
    ? object(clean(source.components))
    : {};
  function retain(value: Json): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(retain);
      return;
    }
    if (typeof value.$ref === "string") {
      const match = /^#\/components\/([^/]+)\/([^/]+)$/.exec(value.$ref);
      if (!match)
        throw new Error("Only local component references are allowed");
      const [, section, name] = match;
      const bucket = components[section] ? object(components[section]) : {};
      if (!bucket[name]) {
        const original = object(sourceComponents[section])[name];
        if (!original) throw new Error(`Unresolved component ${name}`);
        bucket[name] = clean(original);
        if (section === "responses" && !object(bucket[name]).$ref)
          object(bucket[name]).description = "Response from the installation.";
        components[section] = bucket;
        retain(bucket[name]);
      }
    }
    if (Array.isArray(value.security)) {
      for (const requirement of value.security) {
        for (const name of Object.keys(object(requirement))) {
          const definitions = object(sourceComponents.securitySchemes);
          const bucket = components.securitySchemes
            ? object(components.securitySchemes)
            : {};
          if (!definitions[name])
            throw new Error(`Unresolved security scheme ${name}`);
          bucket[name] = clean(definitions[name]);
          components.securitySchemes = bucket;
        }
      }
    }
    Object.values(value).forEach(retain);
  }
  retain(paths);
  const result: ObjectSchema = {
    openapi: "3.1.0",
    "x-contract-source": wire ? "bundled-wire" : "backend-export",
    info: {
      title: "Shopvento Shop API",
      version: "0.2.0",
      description: wire
        ? "Public client surface derived from the bundled TypeScript wire contracts. The backend export was unavailable. Fields and optionality are preserved; backend-only formats, constraints, errors and authorization requirements cannot be inferred. Use the installation's contract for production validation. OAuth status and redirect shapes come from the component call sites. Cart and checkout clients exist; complete cart and checkout UI flows are not in this package."
        : "Public operations used by @shopvento/ui, selected from the backend OpenAPI export.",
    },
    servers: [
      {
        url: "https://{installation}.shopvento.app",
        variables: {
          installation: {
            default: "your-installation",
          },
        },
      },
    ],
    paths,
    components,
  };
  const serialized = JSON.stringify(result);
  if (blocked.test(serialized))
    throw new Error("Private text remains in public OpenAPI");
  return result;
}
if (import.meta.main) {
  const input = Bun.argv[2];
  if (!input)
    throw new Error(
      "Usage: bun run export:openapi <backend-export.json | --from-wire> [output.json]",
    );
  const wire = input === "--from-wire";
  const source = wire
    ? fromWire()
    : object(await Bun.file(resolve(input)).json());
  const result = exportPublicOpenApi(source, wire);
  const output = Bun.argv[3] ?? "openapi/shop-api.json";
  await Bun.write(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `Exported ${publicRoutes.length} operations across ${Object.keys(object(result.paths)).length} paths to ${output} (${wire ? "wire fallback" : "backend export"}).`,
  );
}
