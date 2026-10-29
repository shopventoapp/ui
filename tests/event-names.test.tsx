import { afterEach, expect, test } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import * as publicApi from "../src";
import {
  BookingModeNotice,
  type CalendarData,
  createBookingClient,
  DateList,
  DateSheet,
  defaultBookingLabels,
  type EventBookingProps,
  type EventColors,
  eventStyle,
  MonthCalendar,
  mergeBookingLabels,
  type ShopEvent,
  type ShopSettings,
  type Timewindow,
  useEvents,
} from "../src";

const event: ShopEvent = {
  tasting_id: 1,
  tasting_name: "Cooking class",
  full_name: "Cooking class",
  price: 4000,
};
const colors: EventColors = { 1: "#123456" };
const slot: Timewindow = {
  id: "slot",
  timewindow_id: "slot",
  tasting_id: 1,
  date: "2099-10-25",
  start_time: "19:00:00",
  event_name: "Cooking class",
  max_participants: 16,
  free_spots: 10,
};
const settings: ShopSettings = {
  direct_booking_enabled: false,
  guest_booking_enabled: true,
  countries: [],
  installation_country: "DE",
};
// Checked by TypeScript alongside runtime behavior.
const props: EventBookingProps = {
  baseUrl: "https://api.example",
  eventId: 1,
  termsUrl: "/terms",
  privacyUrl: "/privacy",
};
afterEach(cleanup);

test("event booking requires the public event identifier", () => {
  expect(props.eventId).toBe(event.tasting_id);
  for (const name of [
    "TastingBooking",
    "useTastings",
    "AccountTastingDetail",
    "tastingStyle",
  ])
    expect(name in publicApi).toBe(false);
});

test("event client methods and hooks preserve wire paths and cancellation", async () => {
  const calls: Array<{ url: string; signal?: AbortSignal | null }> = [];
  const client = createBookingClient({
    baseUrl: "https://api.example",
    fetch: async (url, init) => {
      calls.push({ url: String(url), signal: init?.signal });
      return Response.json([event]);
    },
  });
  expect("listTastings" in client).toBe(false);
  expect("getTasting" in client).toBe(false);
  const { getEvent } = client;
  expect(await getEvent(1)).toEqual([event]);
  const hook = renderHook(() => useEvents(client));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.events).toEqual([event]);
  expect("tastings" in hook.result.current).toBe(false);
  expect(calls.map(({ url }) => url)).toEqual(
    Array(2).fill("https://api.example/api/shop/tastings/"),
  );
  const signal = calls.at(-1)?.signal;
  hook.unmount();
  expect(signal?.aborted).toBe(true);
});

test("calendar components accept the required events collection", () => {
  const data: CalendarData = {
    events: [event],
    windows: [slot],
    settings,
    locations: [],
  };
  const props = { ...data, onSelect: () => {}, colors };
  expect(renderToStaticMarkup(<DateList {...props} />)).toContain(
    "Cooking class",
  );
  expect(
    renderToStaticMarkup(<MonthCalendar {...props} month="2099-10" />),
  ).toContain("Cooking class");
});

test("undefined booking labels preserve defaults and defined overrides", () => {
  const labels = {
    eventsLoading: "",
    eventDetails: undefined,
    eventVoucherNotice: undefined,
    eventVoucherMissing: undefined,
  };
  const original = { ...labels };
  const copy = mergeBookingLabels(labels);
  expect(copy.eventsLoading).toBe("");
  expect(copy.eventDetails).toBe(defaultBookingLabels.eventDetails);
  expect(copy.eventVoucherMissing(2)).toBe(
    defaultBookingLabels.eventVoucherMissing(2),
  );
  expect(mergeBookingLabels()).toEqual(defaultBookingLabels);
  expect(labels).toEqual(original);
  expect(
    renderToStaticMarkup(
      <BookingModeNotice settings={settings} labels={labels} />,
    ),
  ).toContain(defaultBookingLabels.eventVoucherNotice);
  expect(
    renderToStaticMarkup(
      <DateSheet
        window={slot}
        variants={[event]}
        settings={settings}
        detailUrl="/event"
        onClose={() => {}}
        onContinue={() => {}}
        labels={labels}
      />,
    ),
  ).toContain(defaultBookingLabels.eventDetails);
});

test("date-sheet and booking-mode copy allow host terminology", () => {
  const labels = {
    eventDetails: "Mehr zum Tasting",
    eventVoucherNotice: "Jeder Platz braucht einen Tasting-Gutschein.",
  };
  const props = {
    window: slot,
    variants: [event],
    settings,
    onClose: () => {},
    onContinue: () => {},
    detailUrl: "/event",
  };
  const defaults = renderToStaticMarkup(<DateSheet {...props} />);
  expect(defaults).toContain("Mehr zur Veranstaltung");
  expect(defaults).toContain("Veranstaltungsgutschein");
  expect(defaults).not.toContain("Tasting");
  const custom = renderToStaticMarkup(<DateSheet {...props} labels={labels} />);
  expect(custom).toContain(labels.eventDetails);
  expect(custom).toContain(labels.eventVoucherNotice);
  expect(
    renderToStaticMarkup(
      <BookingModeNotice settings={settings} labels={labels} />,
    ),
  ).toContain(labels.eventVoucherNotice);
});

test("event styles use only the event token and selectors", async () => {
  expect(Object.entries(eventStyle())).toEqual([]);
  expect(Object.entries(eventStyle("#123456"))).toEqual([
    ["--sv-event", "#123456"],
  ]);
  const css = await Bun.file(
    new URL("../src/booking-redesign.css", import.meta.url),
  ).text();
  expect(css).not.toContain("--sv-tasting");
  expect(css.match(/var\(--sv-event,/g)).toHaveLength(10);
  const dashboard = await Bun.file(
    new URL("../src/dashboard.css", import.meta.url),
  ).text();
  for (const [current, removed] of [
    ["k-event", "k-tasting"],
    ["t-event", "t-tasting"],
  ]) {
    expect(dashboard).toContain(`.${current}`);
    expect(dashboard).not.toContain(`.${removed}`);
  }
});
