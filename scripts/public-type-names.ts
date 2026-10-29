/** Map backend module-qualified schema names (`<pkg>__schemas__shop_orders__ShopArticle`) to `ShopOrdersShopArticle`. */
export function publicTypeNames(source: string): string {
  return source.replace(
    /\b[a-z0-9_]+__schemas__([a-z0-9_]+?)__([A-Za-z0-9]+)\b/g,
    (_, module: string, name: string) =>
      module
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("") + name,
  );
}
