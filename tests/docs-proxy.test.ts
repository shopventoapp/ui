import { expect, test } from "bun:test";

// The UI suite preloads a browser DOM whose Headers hide Set-Cookie by design.
// These checks exercise the Next.js server recipe with Bun's native Web APIs.
for (const name of ["boundaries", "session", "expiry"]) {
  test(`host proxy ${name} with native server Web APIs`, async () => {
    const child = Bun.spawn(
      ["bun", "run", "tests/fixtures/docs-proxy.ts", name],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [output, error, exit] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(error).toBe("");
    expect(exit).toBe(0);
    expect(output).toContain(`Proxy ${name} passed`);
  });
}
