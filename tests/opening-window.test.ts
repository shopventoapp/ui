import { expect, test } from "bun:test";
import {
  type OpeningSettings,
  openingWindow,
  timeInOpeningWindow,
} from "../src/opening-window";

const settings: OpeningSettings = {
  opening_hours: [{ weekday: 1, opens: "12:00", closes: "18:00" }],
  opening_exceptions: [
    { from: "2026-12-25", until: "2026-12-26", label: "Weihnachten" },
    {
      from: "2026-12-22",
      until: "2026-12-22",
      opens: "13:00",
      closes: "16:00",
    },
    {
      from: "2026-12-24",
      until: "2026-12-24",
      opens: "11:00",
      closes: "17:00",
    },
  ],
};
test("missing and null weekly hours are unrestricted outside exceptions", () => {
  for (const config of [{}, { ...settings, opening_hours: null }]) {
    const window = openingWindow("2026-12-29", config);
    expect(window).toEqual({ kind: "unrestricted" });
    expect(timeInOpeningWindow("23:59", window)).toBe(true);
  }
});
test("exceptions apply without weekly hours", () => {
  const config = { ...settings, opening_hours: null };
  expect(openingWindow("2026-12-25", config)).toEqual({
    kind: "closed",
    label: "Weihnachten",
  });
  expect(openingWindow("2026-12-24", config)).toEqual({
    kind: "open",
    opens: "11:00",
    closes: "17:00",
  });
});
test("a missing weekday and an empty weekly schedule are closed", () => {
  expect(openingWindow("2026-12-21", settings)).toEqual({ kind: "closed" });
  expect(openingWindow("2026-12-22", { opening_hours: [] })).toEqual({
    kind: "closed",
  });
  expect(timeInOpeningWindow("12:00", { kind: "closed" })).toBe(false);
});
test("opening is inclusive and closing is exclusive on a weekly opening day", () => {
  const window = openingWindow("2026-12-29", settings);
  expect(window).toEqual({ kind: "open", opens: "12:00", closes: "18:00" });
  for (const time of ["12:00", "17:59"])
    expect(timeInOpeningWindow(time, window)).toBe(true);
  for (const time of ["11:59", "18:00", "25:00", "12:99", "9:00"])
    expect(timeInOpeningWindow(time, window)).toBe(false);
});
test("closed exception includes both endpoints and its label", () => {
  for (const date of ["2026-12-25", "2026-12-26"]) {
    expect(openingWindow(date, settings)).toEqual({
      kind: "closed",
      label: "Weihnachten",
    });
  }
});
test("shortened exception replaces weekly hours", () => {
  const window = openingWindow("2026-12-22", settings);
  expect(window).toEqual({ kind: "open", opens: "13:00", closes: "16:00" });
  expect(timeInOpeningWindow("12:00", window)).toBe(false);
  expect(timeInOpeningWindow("13:00", window)).toBe(true);
  expect(timeInOpeningWindow("16:00", window)).toBe(false);
});
test("an exception opens a normally closed weekday", () => {
  expect(openingWindow("2026-12-24", settings)).toEqual({
    kind: "open",
    opens: "11:00",
    closes: "17:00",
  });
});
test("calendar weekdays do not depend on the browser timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const tz of [
      "Pacific/Kiritimati",
      "America/Los_Angeles",
      "Europe/Berlin",
    ]) {
      process.env.TZ = tz;
      expect(openingWindow("2026-12-29", settings).kind).toBe("open");
    }
  } finally {
    process.env.TZ = previous;
  }
});
