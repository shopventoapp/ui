import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import ts from "typescript";
import { germanMessages } from "../src/locale";

function visibleLiterals(source: string, file = "component.tsx") {
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const add = (value: string) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (/\p{L}/u.test(normalized)) found.push(normalized);
  };
  function expression(node: ts.Expression) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      add(node.text);
    else if (ts.isConditionalExpression(node)) {
      expression(node.whenTrue);
      expression(node.whenFalse);
    } else if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    ) {
      expression(node.left);
      expression(node.right);
    } else if (ts.isParenthesizedExpression(node)) expression(node.expression);
    else if (ts.isTemplateExpression(node)) {
      add(node.head.text);
      for (const part of node.templateSpans) {
        expression(part.expression);
        add(part.literal.text);
      }
    }
  }
  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) add(node.text);
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      !ts.isJsxAttribute(node.parent)
    )
      expression(node.expression);
    if (
      ts.isJsxAttribute(node) &&
      /^(?:aria-label|aria-description|alt|title|placeholder|label)$/.test(
        node.name.getText(syntax),
      ) &&
      node.initializer
    ) {
      if (ts.isStringLiteral(node.initializer)) add(node.initializer.text);
      else if (
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      )
        expression(node.initializer.expression);
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return found;
}
test("guard catches new visible JSX copy, attributes and conditional/template fragments", () => {
  expect(visibleLiterals("<label>X</label>")).toEqual(["X"]);
  expect(visibleLiterals("<h1>Uncatalogued greeting</h1>")).toEqual([
    "Uncatalogued greeting",
  ]);
  expect(visibleLiterals('<input aria-label="New label" />')).toEqual([
    "New label",
  ]);
  expect(
    // biome-ignore lint/suspicious/noTemplateCurlyInString: The source fixture intentionally contains a template expression.
    visibleLiterals('<p>{ok ? "New success" : `New error ${code}`}</p>'),
  ).toEqual(["New success", "New error"]);
  expect(visibleLiterals('<p>{text("Catalogued message")}</p>')).toEqual([]);
});
test("public components render catalogue messages instead of literal customer copy", async () => {
  const failures: string[] = [];
  for (const file of await readdir(new URL("../src/", import.meta.url))) {
    if (!file.endsWith(".tsx")) continue;
    const source = await readFile(
      new URL(`../src/${file}`, import.meta.url),
      "utf8",
    );
    for (const value of visibleLiterals(source, file))
      failures.push(`${file}: ${value}`);
  }
  expect(failures).toEqual([]);
});
test("every literal message lookup exists in the typed German catalogue", async () => {
  const keys = new Set(
    Object.values(germanMessages).flatMap((area) => Object.keys(area)),
  );
  const missing: string[] = [];
  for (const file of await readdir(new URL("../src/", import.meta.url))) {
    if (!/\.tsx?$/.test(file) || /(?:wire|labels|messages|locale)\./.test(file))
      continue;
    const source = await readFile(
      new URL(`../src/${file}`, import.meta.url),
      "utf8",
    );
    const syntax = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        /^(?:text|t|paymentText|newsletterText)$/.test(node.expression.text)
      ) {
        const key = node.arguments[0];
        if (key && ts.isStringLiteral(key) && !keys.has(key.text))
          missing.push(`${file}: ${key.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(syntax);
  }
  expect(missing).toEqual([]);
});

// Protocol slugs, legacy country aliases and catalogue-key comparisons are data.
const nonCopy = new Set([
  "österreich",
  "dänemark",
  "gutscheine",
  "reservierungen",
  "bestellungen",
  "veranstaltungen",
  "veranstaltung",
  "wein",
  "weine",
  "feinkost",
  "geschenke",
  "versand",
  "widerruf",
  "buchen",
  "warenkorb",
  "/versand",
  "/widerruf",
  "bis-15",
]);
function germanLiterals(source: string, file = "helper.ts") {
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const value = node.text;
      const parent = node.parent;
      let lookup = false;
      let branch: ts.Node = node;
      while (
        branch.parent &&
        (ts.isConditionalExpression(branch.parent) ||
          ts.isParenthesizedExpression(branch.parent) ||
          ts.isBinaryExpression(branch.parent))
      )
        branch = branch.parent;
      if (
        ts.isCallExpression(branch.parent) &&
        branch.parent.arguments[0] === branch
      ) {
        const callee = branch.parent.expression.getText(syntax);
        lookup =
          /^(?:text|t|paymentText|newsletterText)$/.test(callee) ||
          callee.startsWith("getMessages(") ||
          (file === "shop-product.ts" && callee === "add");
      }
      let ancestor: ts.Node | undefined = node;
      while (ancestor && !ts.isVariableDeclaration(ancestor))
        ancestor = ancestor.parent;
      // These tables contain German catalogue keys, translated at their use sites.
      const keyTable =
        ancestor &&
        ts.isVariableDeclaration(ancestor) &&
        /^(?:withdrawalReasons|orderStatusText|nutritionLabels|defaultAccountLabels)$/.test(
          ancestor.name.getText(syntax),
        ) &&
        Object.values(germanMessages).some((area) =>
          Object.hasOwn(area, value),
        );
      const catalogueIndex =
        ts.isElementAccessExpression(parent) &&
        /(?:Messages|Labels)$/.test(parent.expression.getText(syntax));
      const knownError =
        ts.isBinaryExpression(parent) &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        /(?:error|cause)\.detail/.test(parent.left.getText(syntax));
      if (
        !lookup &&
        !keyTable &&
        !catalogueIndex &&
        !knownError &&
        !nonCopy.has(value) &&
        /[äöüß]|\b(?:Abgeholt|Person(?:en)?|Bitte|Dein|Deine|für|und|Uhr|Versand|Widerruf|gelesen|Datum|gültig|nicht|Tisch|bis)\b/i.test(
          value,
        )
      )
        found.push(value);
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return found;
}
test("German literal guard catches helper values and nested untranslated plural arguments", () => {
  expect(
    germanLiterals('const status = { PICKUP_COMPLETED: "Abgeholt" };'),
  ).toEqual(["Abgeholt"]);
  expect(
    germanLiterals(
      'text("Tisch für {0} {1}", n, n === 1 ? "Person" : "Personen")',
    ),
  ).toEqual(["Person", "Personen"]);
  expect(germanLiterals('text("Bitte prüfen")')).toEqual([]);
});
test("all source files keep German copy inside catalogues or message lookups", async () => {
  const failures: string[] = [];
  for (const file of await readdir(new URL("../src/", import.meta.url))) {
    if (
      !/\.tsx?$/.test(file) ||
      /^(?:account-messages|booking-messages|common-messages|shop-flow-labels|newsletter-signup-labels|reservation-form-labels)\.ts$/.test(
        file,
      )
    )
      continue;
    const source = await readFile(
      new URL(`../src/${file}`, import.meta.url),
      "utf8",
    );
    for (const value of germanLiterals(source, file))
      failures.push(`${file}: ${value}`);
  }
  expect(failures).toEqual([]);
});
