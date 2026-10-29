/** Build guides, TypeDoc and a bundled read-only Redoc reference into site/. */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import { marked } from "marked";

const output = resolve("site");
await rm(output, { recursive: true, force: true });
await mkdir(`${output}/assets`, { recursive: true });
await cp("docs/assets", `${output}/assets`, { recursive: true });
await cp("openapi", `${output}/openapi`, { recursive: true });
await cp("docs/CNAME", `${output}/CNAME`);
await writeFile(`${output}/.nojekyll`, "");
const apiDocument = await SwaggerParser.validate(
  resolve("openapi/shop-api.json"),
);
const wireFallback =
  (apiDocument as unknown as Record<string, unknown>)["x-contract-source"] ===
  "bundled-wire";
const guides = [
  ["getting-started", "Getting started"],
  ["nextjs", "Next.js App Router"],
  ["event-booking", "Event booking"],
  ["vouchers", "Vouchers"],
  ["customer-account", "Customer account"],
  ["shop", "Cart and checkout"],
  ["reservations", "Table reservations"],
  ["newsletter", "Newsletter signup"],
  ["theming", "Theming"],
  ["labels", "Labels and copy"],
];
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
function header(current: string) {
  return `<a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">s</span>Shopvento <span style="font-size:14px;font-weight:400;letter-spacing:0">Docs</span></a><nav aria-label="Main"><a href="/guides/getting-started/" ${current === "guides" ? 'aria-current="page"' : ""}>Guides</a><a href="/reference/" ${current === "reference" ? 'aria-current="page"' : ""}>Components</a><a href="/api/" ${current === "api" ? 'aria-current="page"' : ""}>Shop API</a><a href="https://github.com/shopventoapp/ui" target="_blank" rel="noopener noreferrer">GitHub</a></nav><button class="theme-toggle" type="button" data-theme-toggle>Theme</button></header>`;
}
function sidebar(slug: string) {
  return `<aside class="sidebar"><nav aria-label="Documentation"><p>Build with Shopvento</p><ul>${guides.map(([id, name]) => `<li><a href="/guides/${id}/" ${slug === id ? 'aria-current="page"' : ""}>${name}</a></li>`).join("")}</ul><p>Reference</p><ul><li><a href="/reference/">Components and types</a></li><li><a href="/api/">Shop API</a></li></ul></nav></aside>`;
}
const footer = `<footer class="page-footer">Shopvento UI 0.3.0 · <a href="https://github.com/shopventoapp/ui" target="_blank" rel="noopener noreferrer">Source</a> · <a href="https://www.npmjs.com/package/@shopvento/ui" target="_blank" rel="noopener noreferrer">npm</a> · <a href="https://shopvento.de" target="_blank" rel="noopener noreferrer">shopvento.de</a></footer>`;
function page(title: string, content: string, slug = "", api = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Shopvento Docs</title><meta name="description" content="English integration guides, React component and type reference, and the public Shopvento API."><script src="/assets/theme.js"></script><link rel="stylesheet" href="/assets/site.css"></head><body class="${api ? "api-page" : ""}">${header(api ? "api" : slug ? "guides" : "")}<div class="site-layout">${sidebar(slug)}<main id="main" class="content ${api ? "api-content" : ""}">${content}${footer}</main></div></body></html>`;
}
const ids = new Map<string, number>();
const renderer = new marked.Renderer();
renderer.heading = function ({ tokens, depth }) {
  const text = this.parser.parseInline(tokens);
  const base = text
    .replace(/<[^>]*>/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .replace(/\s+/g, "-");
  const count = ids.get(base) ?? 0;
  ids.set(base, count + 1);
  return `<h${depth} id="${base}${count ? `-${count}` : ""}">${text}</h${depth}>`;
};
marked.use({ renderer });
async function markdown(path: string) {
  ids.clear();
  let text = await readFile(path, "utf8");
  const markers = [
    ...text.matchAll(/<!-- example:(examples\/[\w/.-]+\.tsx?) -->/g),
  ];
  for (const [marker, file] of markers) {
    const example = await readFile(file, "utf8");
    text = text.replace(
      marker,
      `\n\`\`\`${file.endsWith("tsx") ? "tsx" : "ts"}\n${example.trimEnd()}\n\`\`\`\n`,
    );
  }
  return (await marked.parse(text))
    .replaceAll("<table>", '<div class="table-scroll"><table>')
    .replaceAll("</table>", "</table></div>");
}
await writeFile(
  `${output}/index.html`,
  page("Documentation", await markdown("docs/index.md")),
);
for (const [slug, title] of guides) {
  const path = `${output}/guides/${slug}/index.html`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    page(title, await markdown(`docs/guides/${slug}.md`), slug),
  );
}
const typedoc = Bun.spawn(
  ["bun", "run", "typedoc", "--options", "typedoc.json"],
  { stdout: "inherit", stderr: "inherit" },
);
if ((await typedoc.exited) !== 0) throw new Error("TypeDoc build failed");
await mkdir(`${output}/api`, { recursive: true });
// Redoc's standalone distribution includes its dependencies. No runtime CDN is used.
await cp(
  resolve("node_modules/redoc/LICENSE"),
  `${output}/assets/redoc.LICENSE.txt`,
);
const redocBundle = await readFile(
  resolve("node_modules/redoc/bundles/redoc.standalone.js"),
  "utf8",
);
const logoUrl = "https://cdn.redoc.ly/redoc/logo-mini-full.svg";
if (!redocBundle.includes(logoUrl))
  throw new Error("Recheck the pinned Redoc logo asset");
await writeFile(
  `${output}/assets/redoc.standalone.js`,
  redocBundle.replaceAll(logoUrl, "/assets/redoc-logo.svg"),
);
await writeFile(
  `${output}/assets/api.js`,
  `import { init } from '/assets/redoc.standalone.js';
await init('/openapi/shop-api.json', {disableTelemetry:true,hideDownloadButtons:true,sanitize:true,router:'hash',layout:'stacked',scrollYOffset:0},document.getElementById('api-reference'));
// Enforce the same outbound-link policy for dynamically rendered Redoc anchors.
const secureLinks=()=>document.querySelectorAll('#api-reference a[href]').forEach(a=>{if(/^https?:/.test(a.href)&&new URL(a.href).origin!==location.origin){a.target='_blank';a.rel='noopener noreferrer';}});
secureLinks();new MutationObserver(secureLinks).observe(document.getElementById('api-reference'),{childList:true,subtree:true});
`,
);
const sourceNote = wireFallback
  ? "<strong>Source: bundled wire contracts.</strong> Backend-only validation, errors and authorization rules are not inferred. Check the installation contract before rollout."
  : "<strong>Source: backend OpenAPI export.</strong> Only the public client operations and their reachable schemas are included.";
const apiContent = `<h1>Shop API reference</h1><p>Only the public operations used by the package. This is a read-only reference; no requests are sent to an installation.</p><blockquote><p>${sourceNote}</p></blockquote><p><a href="/openapi/shop-api.json" download>Download OpenAPI 3.1 JSON</a> · <a href="/guides/customer-account/">Session proxy guide</a></p><div id="api-reference" aria-label="Shop API documentation"></div><noscript><p>Enable JavaScript to read the bundled Redoc reference, or download the JSON above.</p></noscript><script type="module" src="/assets/api.js"></script>`;
await writeFile(
  `${output}/api/index.html`,
  page("Shop API reference", apiContent, "", true),
);

async function htmlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? htmlFiles(`${directory}/${entry.name}`)
          : entry.name.endsWith(".html")
            ? [`${directory}/${entry.name}`]
            : [],
      ),
    )
  ).flat();
}
let count = 0;
for (const path of await htmlFiles(output)) {
  let html = await readFile(path, "utf8");
  const reference = path.includes("/reference/");
  if (reference) {
    html = html
      .replace(/<body([^>]*)>/, `<body$1>${header("reference")}`)
      .replace("</head>", '<script src="/assets/theme.js"></script></head>');
    // TypeDoc has its own accessible main area; expose a stable shared skip target.
    html = html.replace('class="col-content"', 'id="main" class="col-content"');
    if (!html.includes('id="main"'))
      html = html.replace(
        'class="container container-main"',
        'id="main" class="container container-main"',
      );
  }
  html = await new HTMLRewriter()
    .on("a[href]", {
      element(element) {
        const href = element.getAttribute("href") ?? "";
        if (
          /^(https?:)?\/\//i.test(href) &&
          !href.startsWith("https://docs.shopvento.de/")
        ) {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        }
      },
    })
    .transform(new Response(html))
    .text();
  await writeFile(path, html);
  count++;
}
console.log(
  `Built ${count} HTML pages, ${guides.length} guides and the bundled API reference in site/.`,
);
