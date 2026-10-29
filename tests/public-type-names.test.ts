import { expect, test } from "bun:test";
import { publicTypeNames } from "../scripts/public-type-names";

test("generated wire types drop the backend module prefix", () => {
  expect(
    publicTypeNames(
      "type A = app__schemas__shop_orders__ShopArticle | app__schemas__shop_articles__ShopArticleVariant; type B = ShopTasting;",
    ),
  ).toBe(
    "type A = ShopOrdersShopArticle | ShopArticlesShopArticleVariant; type B = ShopTasting;",
  );
});
