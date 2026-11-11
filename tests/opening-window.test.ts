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

test.each([
  ["2026-07-10T22:00+02:00", "2026-07-11T00:00+02:00", "2026-07-11", undefined],
  ["2026-11-10T22:00+01:00", "2026-11-11T00:00+01:00", "2026-11-11", undefined],
  [
    "2026-03-29T01:00+01:00",
    "2026-03-29T04:00+02:00",
    "2026-03-29",
    [{ starts: "01:00", ends: "04:00" }],
  ],
  [
    "2026-10-25T01:00+02:00",
    "2026-10-25T04:00+01:00",
    "2026-10-25",
    [{ starts: "01:00", ends: "04:00" }],
  ],
  [
    "2026-07-10T22:00+02:00",
    "2026-07-11T02:00+02:00",
    "2026-07-11",
    [{ starts: "00:00", ends: "02:00" }],
  ],
  ["2026-11-10T18:00+01:00", "2026-11-10T18:00+01:00", "2026-11-10", undefined],
])(
  "clips Berlin offset closure %s to %s on %s",
  (start, end, date, expected) => {
    const result = openingWindow(date as string, {
      opening_exceptions: [
        {
          from: (start as string).slice(0, 10),
          until: (end as string).slice(0, 10),
          closed_from: start as string,
          closed_until: end as string,
        },
      ],
    });
    expect(result.closures).toEqual(expected);
  },
);

test("split intervals override the covering legacy span", () => {
  const window = openingWindow("2026-11-17", {
    opening_hours: [{ weekday: 1, opens: "12:00", closes: "23:00" }],
    opening_intervals: [
      { weekday: 1, opens: "17:30", closes: "23:00" },
      { weekday: 1, opens: "12:00", closes: "14:30" },
    ],
  });
  for (const time of ["12:00", "14:29", "17:30", "22:59"])
    expect(timeInOpeningWindow(time, window)).toBe(true);
  for (const time of ["11:59", "14:30", "15:30", "23:00"])
    expect(timeInOpeningWindow(time, window)).toBe(false);
});

test("overnight hours carry onto the next calendar date and across the week", () => {
  for (const [weekday, date, next] of [
    [4, "2026-11-20", "2026-11-21"],
    [6, "2026-11-22", "2026-11-23"],
  ] as const) {
    const config = {
      opening_intervals: [{ weekday, opens: "18:00", closes: "02:00" }],
    };
    expect(timeInOpeningWindow("23:59", openingWindow(date, config))).toBe(
      true,
    );
    expect(timeInOpeningWindow("00:30", openingWindow(date, config))).toBe(
      false,
    );
    expect(timeInOpeningWindow("00:00", openingWindow(next, config))).toBe(
      true,
    );
    expect(timeInOpeningWindow("01:59", openingWindow(next, config))).toBe(
      true,
    );
    expect(timeInOpeningWindow("02:00", openingWindow(next, config))).toBe(
      false,
    );
    expect(timeInOpeningWindow("18:00", openingWindow(next, config))).toBe(
      false,
    );
  }
});

test("present null and empty intervals override legacy hours", () => {
  const opening_hours = [{ weekday: 1, opens: "12:00", closes: "23:00" }];
  expect(
    openingWindow("2026-11-17", { opening_hours, opening_intervals: null }),
  ).toEqual({ kind: "unrestricted" });
  expect(
    openingWindow("2026-11-17", { opening_hours, opening_intervals: [] }),
  ).toEqual({ kind: "closed" });
});

test("exceptions replace their opening day, while next-day closures preserve carry", () => {
  const config = {
    opening_intervals: [{ weekday: 4, opens: "18:00", closes: "02:00" }],
  };
  const closed = (day: string) => ({
    ...config,
    opening_exceptions: [{ from: day, until: day, label: "Holiday" }],
  });
  expect(openingWindow("2026-11-21", closed("2026-11-20")).kind).toBe("closed");
  expect(
    timeInOpeningWindow(
      "00:30",
      openingWindow("2026-11-21", closed("2026-11-21")),
    ),
  ).toBe(true);
  const replacement = {
    ...config,
    opening_exceptions: [
      {
        from: "2026-11-20",
        until: "2026-11-20",
        opens: "19:00",
        closes: "01:00",
      },
    ],
  };
  expect(
    timeInOpeningWindow("00:59", openingWindow("2026-11-21", replacement)),
  ).toBe(true);
  expect(
    timeInOpeningWindow("01:00", openingWindow("2026-11-21", replacement)),
  ).toBe(false);
  const timed = {
    ...config,
    opening_exceptions: [
      {
        from: "2026-11-20",
        until: "2026-11-21",
        closed_from: "2026-11-20T23:30",
        closed_until: "2026-11-21T00:30",
      },
    ],
  };
  expect(timeInOpeningWindow("00:29", openingWindow("2026-11-21", timed))).toBe(
    false,
  );
  expect(timeInOpeningWindow("00:30", openingWindow("2026-11-21", timed))).toBe(
    true,
  );
});

test("midnight closing has no carry and a real 23:59 closing stays exclusive", () => {
  for (const closes of ["00:00", "23:59"]) {
    const config = {
      opening_intervals: [{ weekday: 4, opens: "18:00", closes }],
    };
    expect(
      timeInOpeningWindow("23:59", openingWindow("2026-11-20", config)),
    ).toBe(closes === "00:00");
    expect(openingWindow("2026-11-21", config).kind).toBe("closed");
  }
});

test("wine bar single-window payloads preserve every minute and window snapshot", () => {
  const opening_hours = [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    opens: "12:00",
    closes: weekday === 1 ? "21:00" : "22:00",
  }));
  const legacy = {
    opening_hours,
    opening_exceptions: [
      {
        from: "2026-11-19",
        until: "2026-11-19",
        opens: "14:00",
        closes: "20:00",
        label: "Special",
      },
    ],
  };
  const current = { ...legacy, opening_intervals: opening_hours };
  const windows = [];
  for (let day = 16; day <= 22; day++) {
    const date = `2026-11-${day}`;
    const before = openingWindow(date, legacy),
      after = openingWindow(date, current);
    expect(after).toEqual(before);
    for (let minute = 0; minute < 1440; minute++) {
      const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      expect(timeInOpeningWindow(time, after)).toBe(
        timeInOpeningWindow(time, before),
      );
    }
    windows.push(after);
  }
  expect(windows).toMatchSnapshot();
});

test("carried hours and the next days own hours stay separate across calendar boundaries", () => {
  for (const [date, weekday] of [
    ["2027-01-01", 3],
    ["2027-03-28", 5],
    ["2027-10-31", 5],
  ] as const) {
    const window = openingWindow(date, {
      opening_intervals: [
        { weekday, opens: "18:00", closes: "03:00" },
        { weekday: (weekday + 1) % 7, opens: "17:30", closes: "22:00" },
      ],
    });
    for (const time of ["00:00", "01:59", "17:30", "21:59"])
      expect(timeInOpeningWindow(time, window)).toBe(true);
    for (const time of ["03:00", "12:00", "22:00", "23:59"])
      expect(timeInOpeningWindow(time, window)).toBe(false);
  }
});

test.each(["2027-03-28", "2027-10-31"])(
  "Berlin transition hour is not offered on %s",
  (date) => {
    const config = {
      opening_intervals: [{ weekday: 5, opens: "20:00", closes: "05:00" }],
    };
    const window = openingWindow(date, config);
    for (let minute = 0; minute < 60; minute++)
      expect(
        timeInOpeningWindow(`02:${String(minute).padStart(2, "0")}`, window),
      ).toBe(false);
    for (const time of ["00:00", "01:59", "03:00", "04:59"])
      expect(timeInOpeningWindow(time, window)).toBe(true);
    expect(timeInOpeningWindow("05:00", window)).toBe(false);
  },
);
