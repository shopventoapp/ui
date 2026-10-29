import { afterEach, expect, test } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AccountEventDetail,
  AccountTastingDetail,
  BookingModeNotice,
  createBookingClient,
  DateList,
  DateSheet,
  type EventBookingProps,
  type EventColors,
  eventStyle,
  MonthCalendar,
  type ShopEvent,
  type ShopSettings,
  type Tasting,
  type TastingBookingProps,
  type TastingColors,
  type Timewindow,
  tastingStyle,
  useEvents,
  useTastings,
} from "../src";

const event: ShopEvent = {
  tasting_id: 1,
  tasting_name: "Cooking class",
  full_name: "Cooking class",
  price: 4000,
};
const legacyEvent: Tasting = event;
const colors: EventColors = { 1: "#123456" };
const legacyColors: TastingColors = colors;
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
// These assignments are checked by tsc as well as the runtime compatibility tests.
const oldProps: TastingBookingProps = {
  baseUrl: "https://api.example",
  tastingId: 1,
  termsUrl: "/terms",
  privacyUrl: "/privacy",
};
const newProps: EventBookingProps = { ...oldProps, eventId: 1 };
afterEach(cleanup);

test("deprecated exports retain the same implementation and compatible types", () => {
  expect(AccountEventDetail === AccountTastingDetail).toBe(true);
  expect(useEvents === useTastings).toBe(true);
  expect(eventStyle === tastingStyle).toBe(true);
  expect(legacyEvent).toEqual(event);
  expect(legacyColors).toEqual(colors);
  expect(newProps.eventId).toBe(oldProps.tastingId);
});

test("event client methods and hooks preserve wire paths, cancellation and legacy keys", async () => {
  const calls: Array<{ url: string; signal?: AbortSignal | null }> = [];
  const client = createBookingClient({
    baseUrl: "https://api.example",
    fetch: async (url, init) => {
      calls.push({ url: String(url), signal: init?.signal });
      return Response.json([event]);
    },
  });
  expect(client.listEvents === client.listTastings).toBe(true);
  expect(client.getEvent === client.getTasting).toBe(true);
  const { getEvent, getTasting } = client;
  expect(await getEvent(1)).toEqual(await getTasting(1));
  const hook = renderHook(() => useEvents(client));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.events).toEqual([event]);
  expect(hook.result.current.events === hook.result.current.tastings).toBe(
    true,
  );
  expect(calls.map(({ url }) => url)).toEqual(
    Array(3).fill("https://api.example/api/shop/tastings/"),
  );
  const signal = calls.at(-1)?.signal;
  hook.unmount();
  expect(signal?.aborted).toBe(true);
});

test("calendar props accept both collection names with events taking precedence", () => {
  const props = { windows: [slot], onSelect: () => {}, colors };
  expect(renderToStaticMarkup(<DateList {...props} events={[event]} />)).toBe(
    renderToStaticMarkup(<DateList {...props} tastings={[event]} />),
  );
  expect(
    renderToStaticMarkup(
      <MonthCalendar {...props} month="2099-10" events={[event]} />,
    ),
  ).toBe(
    renderToStaticMarkup(
      <MonthCalendar {...props} month="2099-10" tastings={[event]} />,
    ),
  );
  expect(
    renderToStaticMarkup(
      <DateList {...props} events={[event]} tastings={[]} />,
    ),
  ).toContain("Cooking class");
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

test("event and legacy CSS tokens and selectors remain available together", async () => {
  expect(eventStyle("#123456")).toHaveProperty("--sv-event", "#123456");
  expect(eventStyle("#123456")).toHaveProperty("--sv-tasting", "#123456");
  const css = await Bun.file(
    new URL("../src/booking-redesign.css", import.meta.url),
  ).text();
  expect(css.match(/var\(--sv-tasting,/g)).toHaveLength(10);
  expect(css.match(/var\(--sv-event, var\(--sv-tasting,/g)).toHaveLength(10);
  const dashboard = await Bun.file(
    new URL("../src/dashboard.css", import.meta.url),
  ).text();
  for (const [current, legacy] of [
    ["k-event", "k-tasting"],
    ["t-event", "t-tasting"],
  ]) {
    expect(dashboard).toContain(`.${current}`);
    expect(dashboard).toContain(`.${legacy}`);
  }
});
