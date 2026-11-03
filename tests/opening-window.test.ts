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

test("timed closures preserve the day and reject only their half-open intervals", () => {
  const config = {
    opening_hours: null,
    opening_exceptions: [
      {
        from: "2027-01-04",
        until: "2027-01-04",
        closed_from: "2027-01-04T17:00",
        closed_until: "2027-01-04T22:30",
        label: "geschlossene Gesellschaft",
      },
    ],
  };
  const window = openingWindow("2027-01-04", config);
  expect(window.kind).toBe("unrestricted");
  for (const clock of ["16:59", "22:30", "23:59"])
    expect(timeInOpeningWindow(clock, window)).toBe(true);
  for (const clock of ["17:00", "18:00", "22:29"])
    expect(timeInOpeningWindow(clock, window)).toBe(false);
  expect(openingWindow("2027-01-05", config)).toEqual({ kind: "unrestricted" });
});
test("timed exceptions compose with manual opening overrides and multiple closures", () => {
  const window = openingWindow("2026-12-22", {
    ...settings,
    opening_exceptions: [
      {
        from: "2026-12-22",
        until: "2026-12-22",
        closed_from: "2026-12-22T14:00",
        closed_until: "2026-12-22T14:30",
      },
      ...(settings.opening_exceptions || []),
      {
        from: "2026-12-22",
        until: "2026-12-22",
        closed_from: "2026-12-22T15:00",
        closed_until: "2026-12-22T15:30",
      },
    ],
  });
  expect(window.kind).toBe("open");
  for (const clock of ["13:00", "14:30", "15:30"])
    expect(timeInOpeningWindow(clock, window)).toBe(true);
  for (const clock of ["12:59", "14:00", "15:00", "16:00"])
    expect(timeInOpeningWindow(clock, window)).toBe(false);
});
test("buffered closures crossing midnight are clipped without closing adjacent free time", () => {
  const config = {
    opening_exceptions: [
      {
        from: "2027-01-03",
        until: "2027-01-05",
        closed_from: "2027-01-03T23:30",
        closed_until: "2027-01-05T00:30",
      },
    ],
  };
  expect(
    timeInOpeningWindow("23:29", openingWindow("2027-01-03", config)),
  ).toBe(true);
  expect(
    timeInOpeningWindow("23:30", openingWindow("2027-01-03", config)),
  ).toBe(false);
  expect(
    timeInOpeningWindow("12:00", openingWindow("2027-01-04", config)),
  ).toBe(false);
  expect(
    timeInOpeningWindow("00:29", openingWindow("2027-01-05", config)),
  ).toBe(false);
  expect(
    timeInOpeningWindow("00:30", openingWindow("2027-01-05", config)),
  ).toBe(true);
});

test("only closed_from marks an exception as a timed closure", () => {
  for (const extra of [
    { private_event_id: 4 },
    { closed_until: "2026-12-22T15:30" },
  ]) {
    expect(
      openingWindow("2026-12-22", {
        opening_exceptions: [
          {
            from: "2026-12-22",
            until: "2026-12-22",
            opens: "15:00",
            closes: "15:30",
            ...extra,
          },
        ],
      }),
    ).toEqual({ kind: "open", opens: "15:00", closes: "15:30" });
    expect(
      openingWindow("2026-12-22", {
        opening_exceptions: [
          {
            from: "2026-12-22",
            until: "2026-12-22",
            ...extra,
          },
        ],
      }),
    ).toEqual({ kind: "closed" });
  }
});
