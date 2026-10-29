await Bun.write(
  "dist/styles.css",
  (await Bun.file("src/styles.css").text()) +
    "\n" +
    (await Bun.file("src/booking-redesign.css").text()) +
    "\n" +
    (await Bun.file("src/dashboard.css").text()),
);

await Bun.write(
  "dist/shop.css",
  (await Bun.file("src/shop.css").text()) +
    "\n" +
    (await Bun.file("src/shop-flow.css").text()) +
    "\n" +
    (await Bun.file("src/public-forms.css").text()),
);

await Bun.write("dist/google-sans.ttf", Bun.file("src/assets/google-sans.ttf"));

export {};

await Bun.write(
  "dist/forms.css",
  await Bun.file("src/public-forms.css").text(),
);
