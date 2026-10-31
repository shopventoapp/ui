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
