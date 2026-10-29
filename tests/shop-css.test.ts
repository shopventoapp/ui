import { expect, test } from "bun:test";

test("the published shop stylesheet stays byte-identical to 0.2.0", async () => {
  const result = Bun.spawn(["bun", "run", "scripts/copy-css.ts"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await result.exited).toBe(0);
  expect(await Bun.file("dist/shop.css").bytes()).toEqual(
    await Bun.file("tests/fixtures/shop-0.2.0.css").bytes(),
  );
});
