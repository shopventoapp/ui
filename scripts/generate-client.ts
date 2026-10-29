/** Regenerate the narrow wire contract from the final backend OpenAPI export. */
import { resolve } from "node:path";
import { publicTypeNames } from "./public-type-names";
import { documentWireTypes } from "./wire-documentation";

const source = Bun.argv[2];
if (!source)
  throw new Error("Usage: bun run generate:client /absolute/path/openapi.json");
type Schema = {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  additionalProperties?: boolean | Schema;
};
const document = (await Bun.file(resolve(source)).json()) as {
  components?: { schemas?: Record<string, Schema> };
  paths: Record<
    string,
    Record<
      string,
      {
        requestBody?: { content: Record<string, { schema: Schema }> };
        responses: Record<
          string,
          { content?: Record<string, { schema: Schema }> }
        >;
      }
    >
  >;
};
const schemas = document.components?.schemas ?? {};
const names = {
  Location: "ShopFranchiseLocationResponse",
  Timewindow: "ShopTimewindowResponse",
  ShopSettings: "PublicShopSettings",
  BookingRequest: "ShopBookingRequest",
  GuestBookingRequest: "ShopGuestBookingRequest",
  BookingResponse: "ShopBookingResponse",
  AccountLoginRequest: "UserLoginRequest",
  AccountRegisterRequest: "ShopUserProfileCreateRequest",
  AccountProfile: "ShopUserProfile",
  AccountPasswordResetRequest: "PasswordResetRequest",
  AccountPasswordSetRequest: "PasswordResetConfirmRequest",
  AccountEmailVerifyRequest: "EmailVerificationRequest",
  AccountEmailChangeConfirmRequest: "EmailChangeConfirmRequest",
  AccountAuthResponse: "AuthResponse",
};
const required = new Set<string>(["ShopTasting", ...Object.values(names)]);
function type(schema: Schema): string {
  if (schema.$ref) {
    const name = schema.$ref.split("/").at(-1);
    if (!name || !schemas[name])
      throw new Error(`Unresolved reference ${schema.$ref}`);
    required.add(name);
    return name;
  }
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (schema.anyOf || schema.oneOf)
    return (schema.anyOf ?? schema.oneOf ?? []).map(type).join(" | ");
  if (schema.allOf) return schema.allOf.map(type).join(" & ");
  if (Array.isArray(schema.type))
    return schema.type.map((t) => type({ ...schema, type: t })).join(" | ");
  if (schema.type === "null") return "null";
  if (schema.type === "array") return `Array<${type(schema.items ?? {})}>`;
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "string") return "string";
  if (schema.properties)
    return `{ ${Object.entries(schema.properties)
      .map(
        ([key, value]) =>
          `${JSON.stringify(key)}${schema.required?.includes(key) ? "" : "?"}: ${type(value)};`,
      )
      .join(" ")} }`;
  if (typeof schema.additionalProperties === "object")
    return `Record<string, ${type(schema.additionalProperties)}>`;
  return "unknown";
}
const accountRoutes = {
  orders: ["/api/shop/orders/", "get"],
  bookings: ["/api/shop/tastings/bookings", "get"],
  booking: ["/api/shop/tastings/bookings/{booking_id}", "get"],
  moveBooking: ["/api/shop/tastings/bookings/{booking_id}/move", "post"],
  reservations: ["/api/shop/table-reservations", "get"],
  reservation: ["/api/shop/table-reservations/{reservation_id}", "get"],
  updateReservation: ["/api/shop/table-reservations/{reservation_id}", "patch"],
  cancelReservation: [
    "/api/shop/table-reservations/{reservation_id}/cancel",
    "post",
  ],
  vouchers: ["/api/shop/vouchers/customer", "get"],
  voucher: ["/api/shop/vouchers/customer/{voucher_id}", "get"],
  voucherHistory: ["/api/shop/vouchers/customer/{voucher_id}/history", "get"],
  withdrawalItems: ["/api/shop/orders/{order_id}/withdrawal-items", "get"],
  withdraw: ["/api/shop/orders/{order_id}/cancellation-request", "post"],
  updateProfile: ["/api/shop/user/profile", "put"],
  newsletterUnsubscribe: ["/api/shop/user/newsletter/unsubscribe", "post"],
  addresses: ["/api/shop/user/shipping-addresses", "get"],
  createAddress: ["/api/shop/user/shipping-addresses", "post"],
  updateAddress: [
    "/api/shop/user/shipping-addresses/{shipping_address_id}",
    "put",
  ],
  deleteAddress: [
    "/api/shop/user/shipping-addresses/{shipping_address_id}",
    "delete",
  ],
  updatePassword: ["/api/shop/user/password-update", "post"],
  updateEmail: ["/api/shop/user/update-email", "post"],
  login: ["/api/shop/user/login", "post"],
  register: ["/api/shop/user/register", "post"],
  passwordReset: ["/api/shop/user/password-reset", "post"],
  passwordSet: ["/api/shop/user/password-reset/confirm", "post"],
  emailVerify: ["/api/shop/user/verify-email", "post"],
  emailChangeConfirm: ["/api/shop/user/confirm-email-change", "post"],
  profile: ["/api/shop/user/profile", "get"],
  logout: ["/api/shop/user/logout", "post"],
  settings: ["/api/shop/settings", "get"],
} as const;
let operationOutput = "export type AccountOperations = {\n";
for (const [name, [path, method]] of Object.entries(accountRoutes)) {
  const operation = document.paths[path]?.[method];
  if (!operation)
    throw new Error(`Missing account operation ${method} ${path}`);
  const body = operation.requestBody?.content["application/json"]?.schema;
  const response =
    operation.responses["200"]?.content?.["application/json"]?.schema;
  if (!response) throw new Error(`Missing account response ${path}`);
  operationOutput += `${name}: { path: ${JSON.stringify(path)}; method: ${JSON.stringify(method.toUpperCase())}; body: ${body ? type(body) : "undefined"}; response: ${type(response)} };\n`;
}
operationOutput += "};\n";
let output =
  "// Generated wire contracts. Run bun run generate:client with the final OpenAPI export.\n";
for (const name of required) {
  if (!schemas[name]) throw new Error(`Missing final backend schema: ${name}`);
  output += `export type ${name} = ${type(schemas[name])};\n`;
}
for (const [alias, name] of Object.entries(names))
  output += `export type ${alias} = ${name};\n`;
await Bun.write(
  "src/wire.ts",
  documentWireTypes(publicTypeNames(output + operationOutput)),
);
const formatted = Bun.spawn(["bun", "run", "format:generated", "src/wire.ts"], {
  stdout: "inherit",
  stderr: "inherit",
});
if ((await formatted.exited) !== 0)
  throw new Error("Formatting generated wire contracts failed");
