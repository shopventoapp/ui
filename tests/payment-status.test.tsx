import { afterEach, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { createAccountClient } from "../src/account-client";
import {
  BookingFlow,
  startFlowDraft,
  writeFlowDraft,
} from "../src/booking-flow";
import type { CalendarInput } from "../src/calendar";
import { createBookingClient, type Timewindow } from "../src/client";
import { EventBooking } from "../src/components";
import { createDashboardClient } from "../src/dashboard-client";
import { useSubmitBooking } from "../src/hooks";
import { usePaymentStatus } from "../src/payment-hooks";
import {
  type PaymentStatusInput,
  paymentActionBlocked,
  paymentStatusFrom,
} from "../src/payment-status";
import { ReservationForm } from "../src/reservation-form";
import { createShopClient } from "../src/shop-client";
import { ShopFlow } from "../src/shop-flow";

const unavailable =
  "Bald verfügbar: Online-Zahlungen sind derzeit nicht freigeschaltet. Bitte versuche es später erneut.";
const originalFetch = globalThis.fetch;
const profile = {
  id: 1,
  first_name: "Alex",
  last_name: "Guest",
  email: "alex@example.invalid",
};
const slot: Timewindow = {
  id: "slot",
  timewindow_id: "single_slot",
  tasting_id: 5,
  date: "2099-10-25",
  start_time: "19:00:00",
  free_spots: 10,
  max_participants: 16,
  franchise_location_id: 1,
  event_name: "Example",
};
const event = {
  tasting_id: 5,
  tasting_name: "Example",
  full_name: "Example",
  variant_id: "v1",
  price: 4900,
};
const settings = {
  countries: [{ value: "DE", label: "Germany" }],
  installation_country: "DE",
  direct_booking_enabled: true,
  guest_booking_enabled: true,
};
const bookingData = {
  windows: [slot],
  events: [event],
  settings,
  locations: [{ id: 1, location_name: "Example" }],
} satisfies CalendarInput;
function setUrl(url: string) {
  (
    window as unknown as { happyDOM: { setURL(url: string): void } }
  ).happyDOM.setURL(url);
}
function challenge() {
  window.turnstile = {
    render: (_element, options) => {
      queueMicrotask(() => options.callback?.("test-token"));
      return "widget";
    },
    getResponse: () => "test-token",
    reset: () => {},
  };
  Object.assign(window.turnstile, { remove: () => {} });
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  globalThis.fetch = originalFetch;
  delete window.turnstile;
  setUrl("http://localhost/");
});

for (const transport of ["shop", "booking"] as const) {
  for (const [name, response, expected] of [
    [
      "inactive",
      () =>
        Response.json({
          online_payments_enabled: false,
          checkout_label: "ignored label",
        }),
      "inactive",
    ],
    [
      "active",
      () =>
        Response.json({
          online_payments_enabled: true,
          checkout_label: "Zur Zahlung",
        }),
      "active",
    ],
    ["legacy 404", () => new Response(null, { status: 404 }), "active"],
    ["503", () => new Response(null, { status: 503 }), "error"],
    ["401", () => new Response(null, { status: 401 }), "error"],
    [
      "network error",
      () => {
        throw new Error("Offline");
      },
      "error",
    ],
    ["invalid JSON", () => new Response("invalid"), "error"],
    [
      "missing fields",
      () => Response.json({ online_payments_enabled: true }),
      "unknown",
    ],
    [
      "wrong boolean",
      () =>
        Response.json({
          online_payments_enabled: "true",
          checkout_label: "Pay",
        }),
      "unknown",
    ],
    ["null", () => Response.json(null), "unknown"],
    ["bare active", () => Response.json("active"), "unknown"],
  ] as const) {
    test(`${transport} payment transport: ${name}`, async () => {
      const calls: Array<[string, RequestInit | undefined]> = [];
      const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push([String(input), init]);
        return response();
      };
      const client =
        transport === "shop"
          ? createShopClient({ baseUrl: "https://tenant.invalid/", fetcher })
          : createBookingClient({
              baseUrl: "https://tenant.invalid/",
              fetch: fetcher,
            });
      const controller = new AbortController();
      expect(await client.getPaymentStatus(controller.signal)).toBe(expected);
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe(
        "https://tenant.invalid/api/shop/payments/status",
      );
      expect(calls[0][1]).toMatchObject({
        credentials: "include",
        cache: "no-store",
      });
      expect(calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });
  }
}

test("host capability is immediate, validated and never refetched", () => {
  let calls = 0;
  const client = {
    getPaymentStatus: async () => {
      calls++;
      return "active" as const;
    },
  };
  const hook = renderHook(
    ({ supplied }: { supplied: PaymentStatusInput }) =>
      usePaymentStatus(client, supplied),
    {
      initialProps: {
        supplied: {
          online_payments_enabled: false,
          checkout_label: "Pay anyway",
        } as PaymentStatusInput,
      },
    },
  );
  expect(hook.result.current).toBe("inactive");
  hook.rerender({ supplied: "active" });
  expect(hook.result.current).toBe("active");
  hook.rerender({ supplied: "unknown" });
  expect(hook.result.current).toBe("unknown");
  expect(calls).toBe(0);
  expect(paymentStatusFrom({ online_payments_enabled: "false" })).toBe(
    "unknown",
  );
  for (const status of ["inactive", "loading", "unknown", "error"] as const) {
    for (const amount of [undefined, null, NaN, -1, 1, "0"])
      expect(paymentActionBlocked(status, amount)).toBe(true);
    expect(paymentActionBlocked(status, 0)).toBe(false);
  }
});

test("automatic status stays loading until resolved and ignores obsolete clients", async () => {
  let resolve: (status: "active") => void = () => {};
  let signal: AbortSignal | undefined;
  const first = {
    getPaymentStatus: (input?: AbortSignal) => {
      signal = input;
      return new Promise<"active">((done) => {
        resolve = done;
      });
    },
  };
  const second = { getPaymentStatus: async () => "inactive" as const };
  const hook = renderHook(({ client }) => usePaymentStatus(client), {
    initialProps: {
      client: first as {
        getPaymentStatus: (
          input?: AbortSignal,
        ) => Promise<"active" | "inactive">;
      },
    },
  });
  expect(hook.result.current).toBe("loading");
  hook.rerender({ client: second });
  expect(signal?.aborted).toBe(true);
  await waitFor(() => expect(hook.result.current).toBe("inactive"));
  await act(async () => resolve("active"));
  expect(hook.result.current).toBe("inactive");
});

function shopFixture({
  amount = 1000,
  guest = false,
  status,
  finalAmount,
  responseStatus = 200,
  entry = false,
  quoteWait,
  failCheckout = false,
}: {
  amount?: number;
  guest?: boolean;
  status?: PaymentStatusInput;
  finalAmount?: number;
  responseStatus?: number;
  entry?: boolean;
  quoteWait?: Promise<void>;
  failCheckout?: boolean;
} = {}) {
  setUrl("http://localhost/kasse");
  challenge();
  const article = {
    id: "voucher",
    title: "Voucher",
    slug: "voucher",
    type: "VOUCHER",
    price: 1000,
    category: { name: "Vouchers", slug: "gutscheine" },
    variants: [],
  };
  let quotes = 0,
    posts = 0,
    capabilities = 0;
  const client = createShopClient({
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("payments/status")) {
        capabilities++;
        return responseStatus === 200
          ? Response.json({
              online_payments_enabled: false,
              checkout_label: "Anything",
            })
          : new Response(null, { status: responseStatus });
      }
      if (url.includes("checkout")) {
        posts++;
        if (failCheckout)
          return Response.json({ detail: "Failed" }, { status: 503 });
        return Response.json({
          checkout_url: "https://checkout.stripe.com/c/pay",
          order_id: "order",
        });
      }
      if (url.includes("cart")) {
        quotes++;
        if (quotes > 1 && quoteWait) await quoteWait;
        return Response.json({
          items: [
            {
              ...article,
              article,
              quantity: 1,
              price_per_item: 1000,
              price: 1000,
            },
          ],
          subtotal_price: 1000,
          voucher_discount_amount: 1000 - amount,
          total_price:
            quotes > 1 && finalAmount !== undefined ? finalAmount : amount,
          available_fulfillment_options: [],
        });
      }
      return Response.json(
        url.includes("catalogue")
          ? { articles: [], vouchers: [article] }
          : { shop_checkout_review_required: true, turnstile_site_key: "test" },
      );
    },
  });
  localStorage.setItem(
    "sv-shop-cart-v1",
    JSON.stringify({
      items: [{ id: "voucher", quantity: 1 }],
      voucher_codes: amount < 1000 ? ["FUNDED"] : [],
    }),
  );
  const config = {
    client,
    paymentStatus: status,
    accountEnabled: entry || !guest,
    accountClient: createAccountClient({
      fetch: async () =>
        entry ? Response.json({}, { status: 401 }) : Response.json(profile),
    }),
    dashboardClient: createDashboardClient({
      fetch: async () => Response.json([]),
    }),
    onNavigate: () => {},
  };
  const view = render(<ShopFlow {...config} />);
  return { view, config, counts: () => ({ posts, quotes, capabilities }) };
}
function required<T>(value: T | null): T {
  if (value === null) throw new Error("Expected test element");
  return value;
}
function accept(view: ReturnType<typeof render>) {
  fireEvent.click(required(view.container.querySelector("#terms")));
}

for (const guest of [false, true]) {
  for (const status of ["inactive", "unknown", "loading", "error"] as const) {
    test(`${guest ? "guest" : "account"} paid checkout cannot submit or retry with ${status} capability`, async () => {
      const { view, counts } = shopFixture({ guest, status });
      const button = await view.findByRole("button", {
        name: "Bald verfügbar",
      });
      await waitFor(() => expect(counts().quotes).toBeGreaterThan(0));
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.submit(required(button.closest("form")));
      fireEvent.submit(required(button.closest("form")));
      expect(counts().posts).toBe(0);
      expect(counts().capabilities).toBe(0);
    });
  }
}
for (const amount of [0, 1]) {
  test(`backend cart quote payable ${amount} controls voucher checkout`, async () => {
    const { view, counts } = shopFixture({ amount, status: "inactive" });
    const button = await view.findByRole("button", {
      name: amount ? "Bald verfügbar" : "Zahlungspflichtig bestellen",
    });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(!!amount));
    if (!amount) {
      accept(view);
      fireEvent.click(button);
      await waitFor(() => expect(counts().posts).toBe(1));
    } else {
      fireEvent.submit(required(button.closest("form")));
      expect(counts().posts).toBe(0);
    }
  });
}
for (const responseStatus of [200, 404, 503]) {
  test(`checkout loads status automatically, HTTP ${responseStatus}`, async () => {
    const { view, counts } = shopFixture({ responseStatus });
    const enabled = responseStatus === 404;
    const button = await view.findByRole("button", {
      name: enabled ? "Zahlungspflichtig bestellen" : "Bald verfügbar",
    });
    await waitFor(() => expect(counts().capabilities).toBe(1));
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(!enabled));
  });
}

test("active checkout creates payment but an updated inactive capability blocks the retry", async () => {
  const { view, config, counts } = shopFixture({ status: "active" });
  const button = await view.findByRole("button", {
    name: "Zahlungspflichtig bestellen",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  view.rerender(<ShopFlow {...config} paymentStatus="inactive" />);
  expect(
    view
      .getByRole("button", { name: "Bald verfügbar" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.submit(required(button.closest("form")));
  expect(counts().posts).toBe(0);
  view.rerender(<ShopFlow {...config} paymentStatus="active" />);
  accept(view);
  fireEvent.click(
    view.getByRole("button", { name: "Zahlungspflichtig bestellen" }),
  );
  await waitFor(() => expect(counts().posts).toBe(1));
});

test("a formerly zero quote that becomes payable cannot create a payment", async () => {
  const { view, counts } = shopFixture({
    amount: 0,
    finalAmount: 100,
    status: "inactive",
  });
  const button = await view.findByRole("button", {
    name: "Zahlungspflichtig bestellen",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  accept(view);
  fireEvent.click(button);
  await waitFor(() =>
    expect(
      view
        .getByRole("button", { name: "Bald verfügbar" })
        .hasAttribute("disabled"),
    ).toBe(true),
  );
  expect(counts().posts).toBe(0);
});

function bookingFixture({
  price = 4900,
  balance = 0,
  reject = false,
  status = "inactive",
  guest = false,
  flow = false,
}: {
  price?: number;
  balance?: number;
  reject?: boolean;
  status?: PaymentStatusInput;
  guest?: boolean;
  flow?: boolean;
} = {}) {
  challenge();
  let posts = 0;
  const client = createBookingClient({
    baseUrl: "",
    fetch: async (input, init) => {
      const url = String(input);
      if (init?.method === "POST") {
        posts++;
        return reject
          ? Response.json({ detail: unavailable }, { status: 409 })
          : Response.json({
              success: true,
              order_id: "order",
              order_number: "SV123",
              status: "success",
              checkout_url: null,
            });
      }
      if (url.includes("/vouchers/"))
        return Response.json({
          voucher_code: "COVER",
          kind: "MULTI_PURPOSE",
          remaining_value: balance,
        });
      if (url.includes("timewindows"))
        return Response.json({ timewindows: [slot], total: 1 });
      if (url.endsWith("settings")) return Response.json(settings);
      if (url.endsWith("locations"))
        return Response.json({ locations: bookingData.locations, total: 1 });
      return Response.json([{ ...event, price }]);
    },
  });
  const seats = [
    { variant_id: "v1", ...(balance ? { voucher_code: "COVER" } : {}) },
  ];
  if (flow) {
    const draft = startFlowDraft("payments-flow", slot.timewindow_id, 1, "v1");
    writeFlowDraft("payments-flow", {
      ...draft,
      codes: balance ? ["COVER"] : [],
      contact: {
        first_name: "Alex",
        last_name: "Guest",
        email: "alex@example.invalid",
      },
    });
    const props = {
      client,
      paymentStatus: status,
      data: { ...bookingData, events: [{ ...event, price }] },
      draftKey: "payments-flow",
      step: 3,
      onStep: () => {},
      calendarUrl: "/events",
      loginUrl: "/login",
      successUrl: "/success",
      termsUrl: "/terms",
      privacyUrl: "/privacy",
      profile: guest ? null : profile,
      texts: {
        withdrawal: "Fixed date",
        minimum: "Minimum guests",
        reschedule: "Move date",
      },
      siteKey: "test",
      onRedirect: () => {},
    };
    return { view: render(<BookingFlow {...props} />), posts: () => posts };
  }
  sessionStorage.setItem(
    `vv:booking::5:all:${guest ? "guest" : "account"}`,
    JSON.stringify({
      timewindow_id: slot.timewindow_id,
      seats,
      contact: {
        first_name: "Alex",
        last_name: "Guest",
        email: "alex@example.invalid",
      },
    }),
  );
  return {
    view: render(
      <EventBooking
        client={client}
        baseUrl=""
        paymentStatus={status}
        eventId={5}
        mode={guest ? "guest" : "account"}
        termsUrl="/terms"
        privacyUrl="/privacy"
        turnstileSiteKey="test"
        onRedirect={() => {}}
      />,
    ),
    posts: () => posts,
  };
}
for (const flow of [false, true]) {
  for (const guest of [false, true]) {
    for (const status of ["inactive", "unknown", "loading", "error"] as const) {
      test(`${flow ? "multi-step" : "compact"} ${guest ? "guest" : "account"} paid booking is gated for ${status}`, async () => {
        const { view, posts } = bookingFixture({ flow, guest, status });
        const button = await view.findByRole("button", {
          name: "Bald verfügbar",
        });
        expect(button.hasAttribute("disabled")).toBe(true);
        fireEvent.submit(required(button.closest("form")));
        fireEvent.submit(required(button.closest("form")));
        expect(posts()).toBe(0);
      });
    }
    for (const [price, balance, status] of [
      [0, 0, "inactive"],
      [4900, 4900, "inactive"],
      [4900, 0, "active"],
      [0, 0, "unknown"],
      [4900, 4900, "error"],
    ] as const) {
      test(`${flow ? "multi-step" : "compact"} ${guest ? "guest" : "account"} booking submits with price ${price}, funding ${balance}, status ${status}`, async () => {
        const { view, posts } = bookingFixture({
          flow,
          guest,
          price,
          balance,
          status,
        });
        const button = await view.findByRole("button", {
          name: "Zahlungspflichtig buchen",
        });
        await waitFor(() =>
          expect(button.hasAttribute("disabled")).toBe(false),
        );
        fireEvent.click(view.getByRole("checkbox"));
        await act(async () => {
          await Promise.resolve();
        });
        fireEvent.submit(required(button.closest("form")));
        await waitFor(() => expect(posts()).toBe(1));
      });
    }
  }
  test(`${flow ? "multi-step" : "compact"} partial voucher funding remains gated`, async () => {
    const { view, posts } = bookingFixture({ flow, balance: 4800 });
    const button = await view.findByRole("button", { name: "Bald verfügbar" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.submit(required(button.closest("form")));
    expect(posts()).toBe(0);
  });
  test(`${flow ? "multi-step" : "compact"} backend payment rejection overrides a zero estimate and prevents retries`, async () => {
    const { view, posts } = bookingFixture({
      flow,
      balance: 4900,
      reject: true,
    });
    const button = await view.findByRole("button", {
      name: "Zahlungspflichtig buchen",
    });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    fireEvent.click(view.getByRole("checkbox"));
    fireEvent.submit(required(button.closest("form")));
    await waitFor(() =>
      expect(view.container.textContent).toContain(unavailable),
    );
    const disabled = view.getByRole("button", { name: "Bald verfügbar" });
    expect(disabled.hasAttribute("disabled")).toBe(true);
    fireEvent.submit(required(disabled.closest("form")));
    fireEvent.submit(required(disabled.closest("form")));
    expect(posts()).toBe(1);
  });
}

test("free table reservations remain usable with an inactive tenant status endpoint", async () => {
  challenge();
  const posts: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.endsWith("payments/status"))
      return Response.json({
        online_payments_enabled: false,
        checkout_label: "Bald verfügbar",
      });
    if (url.includes("settings"))
      return Response.json({
        ready: true,
        turnstile_site_key: "test",
        online_party_min: 2,
        online_party_max: 8,
      });
    if (init?.method === "POST") posts.push(url);
    return Response.json({ status: "confirmed" });
  }) as typeof fetch;
  const view = render(
    <ReservationForm
      siteKey="test"
      publicApi={async () => ({ shopvento: true, locationId: 1 })}
      ScriptComponent={() => null}
      accountEnabled={false}
    />,
  );
  await waitFor(() =>
    expect(view.container.querySelectorAll("#resv-guests option").length).toBe(
      8,
    ),
  );
  for (const [id, value] of [
    ["#resv-name", "Alex Guest"],
    ["#resv-email", "alex@example.invalid"],
    ["#resv-date", "12122026"],
    ["#resv-time", "1830"],
  ])
    fireEvent.change(required(view.container.querySelector(id)), {
      target: { value },
    });
  fireEvent.submit(required(view.container.querySelector("form")));
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]).toContain("table-reservations");
});

test("guest entry from account access cannot bypass the paid checkout gate", async () => {
  const { view, counts } = shopFixture({ entry: true, status: "inactive" });
  fireEvent.click(
    await view.findByRole("button", { name: "Als Gast fortfahren" }),
  );
  const button = await view.findByRole("button", { name: "Bald verfügbar" });
  expect(button.hasAttribute("disabled")).toBe(true);
  fireEvent.submit(required(button.closest("form")));
  expect(counts().posts).toBe(0);
});

test("a failed checkout cannot create another payment after capability becomes inactive", async () => {
  const { view, config, counts } = shopFixture({
    status: "active",
    failCheckout: true,
  });
  const button = await view.findByRole("button", {
    name: "Zahlungspflichtig bestellen",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  accept(view);
  fireEvent.click(button);
  await waitFor(() =>
    expect(view.container.textContent).toContain(
      "Die Bestellung konnte nicht abgeschlossen werden",
    ),
  );
  view.rerender(<ShopFlow {...config} paymentStatus="inactive" />);
  const disabled = view.getByRole("button", { name: "Bald verfügbar" });
  expect(disabled.hasAttribute("disabled")).toBe(true);
  fireEvent.submit(required(disabled.closest("form")));
  expect(counts().posts).toBe(1);
});

test("an inactive capability arriving during the final requote prevents checkout", async () => {
  let release = () => {};
  const quoteWait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { view, config, counts } = shopFixture({ status: "active", quoteWait });
  const button = await view.findByRole("button", {
    name: "Zahlungspflichtig bestellen",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  accept(view);
  fireEvent.click(button);
  await waitFor(() => expect(counts().quotes).toBe(2));
  view.rerender(<ShopFlow {...config} paymentStatus="inactive" />);
  await act(async () => {
    release();
    await quoteWait;
  });
  expect(
    view
      .getByRole("button", { name: "Bald verfügbar" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(counts().posts).toBe(0);
});

test("a backend payment rejection is scoped to the selection and survives contact or account/guest changes", async () => {
  let posts = 0;
  const client = createBookingClient({
    baseUrl: "",
    fetch: async () => {
      posts++;
      return Response.json({ detail: unavailable }, { status: 409 });
    },
  });
  const hook = renderHook(() => useSubmitBooking(client, () => {}));
  const draft = {
    timewindow_id: "first",
    seats: [{ variant_id: "v1", voucher_code: "FIRST" }],
    contact: {
      first_name: "Alex",
      last_name: "Guest",
      email: "alex@example.invalid",
    },
  };
  await act(async () => {
    await hook.result.current.submit(draft, false, "");
  });
  expect(hook.result.current.paymentRejected(draft)).toBe(true);
  await act(async () => {
    await hook.result.current.submit(
      { ...draft, contact: { ...draft.contact, first_name: "Changed" } },
      true,
      "token",
      true,
    );
  });
  expect(posts).toBe(1);
  const changed = { ...draft, timewindow_id: "second" };
  expect(hook.result.current.paymentRejected(changed)).toBe(false);
  await act(async () => {
    await hook.result.current.submit(changed, false, "");
  });
  expect(posts).toBe(2);
});
