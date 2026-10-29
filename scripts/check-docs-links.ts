/** Check local destinations/fragments/assets and require safe attributes on outbound links. */
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export async function checkDocsLinks(root = resolve("site")) {
  const files: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (path.endsWith(".html")) files.push(path);
    }
  }
  await walk(root);
  if (!files.length) throw new Error("No built documentation pages found");
  const ids = new Map<string, Set<string>>();
  const links: {
    file: string;
    href: string;
    target?: string;
    rel?: string;
    anchor: boolean;
  }[] = [];
  for (const file of files) {
    const set = new Set<string>();
    ids.set(file, set);
    new HTMLRewriter()
      .on("[id]", {
        element(el) {
          const id = el.getAttribute("id");
          if (id) set.add(id);
        },
      })
      .on("a[href],link[href],script[src],img[src]", {
        element(el) {
          const href = el.getAttribute("href") ?? el.getAttribute("src");
          if (href)
            links.push({
              file,
              href,
              target: el.getAttribute("target") ?? undefined,
              rel: el.getAttribute("rel") ?? undefined,
              anchor: el.tagName === "a",
            });
        },
      })
      .transform(await readFile(file, "utf8"));
  }
  const errors: string[] = [];
  let internal = 0;
  let external = 0;
  for (const link of links) {
    if (/^(mailto:|tel:|data:)/i.test(link.href)) continue;
    const from = new URL(
      `https://docs.shopvento.de/${link.file
        .slice(root.length + 1)
        .split(sep)
        .join("/")}`,
    );
    const to = new URL(link.href, from);
    if (to.origin !== from.origin) {
      external++;
      if (!/^https?:$/.test(to.protocol))
        errors.push(`${link.file}: unsupported URL ${link.href}`);
      if (
        link.anchor &&
        (link.target !== "_blank" ||
          !["noopener", "noreferrer"].every((rel) =>
            link.rel?.split(/\s+/).includes(rel),
          ))
      )
        errors.push(`${link.file}: unsafe external link ${link.href}`);
      if (!link.anchor)
        errors.push(`${link.file}: runtime external asset ${link.href}`);
      continue;
    }
    let target = resolve(root, `.${decodeURIComponent(to.pathname)}`);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      errors.push(`${link.file}: path escapes site`);
      continue;
    }
    try {
      if ((await stat(target)).isDirectory())
        target = resolve(target, "index.html");
      await stat(target);
      const fragment = decodeURIComponent(to.hash.slice(1));
      if (
        fragment &&
        extname(target) === ".html" &&
        !ids.get(target)?.has(fragment)
      )
        errors.push(`${link.file}: missing fragment ${link.href}`);
    } catch {
      errors.push(`${link.file}: missing local destination ${link.href}`);
    }
    internal++;
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    `Checked ${files.length} HTML pages: ${internal} internal links/assets, ${external} safe external links, 0 errors.`,
  );
  return { pages: files.length, internal, external };
}
if (import.meta.main)
  await checkDocsLinks(Bun.argv[2] ? resolve(Bun.argv[2]) : undefined);
