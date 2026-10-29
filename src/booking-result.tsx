"use client";
import { useEffect, useState } from "react";
import { type FlowDraft, readFlowDraft } from "./booking-flow";
import {
  type ResultLocation,
  type ResultSnapshot,
  type ResultWindow,
  readBookingResult,
  validBookingReference,
} from "./booking-storage";
import {
  AvailabilityBadge,
  type BookingFormat,
  BookingIcon,
  bookingDate,
  bookingTime,
  type CalendarInput,
  eventsFrom,
} from "./calendar";

export function bookingCalendarFile(
  w: ResultWindow,
  title: string,
  reference: string,
  location?: ResultLocation,
) {
  const escapeIcs = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/([,;])/g, "\\$1");
  const stamp = (time: string) =>
    `${w.date.replace(/-/g, "")}T${time.replace(/:/g, "").slice(0, 6).padEnd(6, "0")}`;
  const fold = (line: string) => {
    let result = "",
      bytes = 0;
    for (const char of line) {
      const length = new TextEncoder().encode(char).length;
      if (bytes + length > 75) {
        result += "\r\n ";
        bytes = 1;
      }
      result += char;
      bytes += length;
    }
    return result;
  };
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shopvento//Booking//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Berlin",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(reference)}@shopvento.invalid`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d+Z$/, "Z")}`,
    `DTSTART;TZID=Europe/Berlin:${stamp(w.start_time)}`,
    ...(w.end_time ? [`DTEND;TZID=Europe/Berlin:${stamp(w.end_time)}`] : []),
    `SUMMARY:${escapeIcs(title)}`,
    `LOCATION:${escapeIcs([location?.location_name, location?.location_street].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${escapeIcs(`Buchung ${reference}. Die verbindliche Bestätigung erhältst Du per E-Mail.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
export function BookingOutcome({
  cancelled = false,
  draftKey,
  bookingUrl,
  calendarUrl,
  reference,
  routeUrl,
  registerUrl,
  registerHint,
  data,
  format = {},
}: {
  cancelled?: boolean;
  draftKey: string;
  bookingUrl: string;
  calendarUrl: string;
  reference?: string | null;
  routeUrl?: string;
  registerUrl?: string;
  registerHint?: string;
  data?: CalendarInput | null;
  format?: BookingFormat;
}) {
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [draft, setDraft] = useState<FlowDraft | null>(null);
  useEffect(() => {
    const d = readFlowDraft(draftKey);
    setDraft(d);
    setSnapshot(readBookingResult(draftKey, reference));
  }, [draftKey, reference]);
  useEffect(() => {
    if (!cancelled && snapshot && reference === snapshot.order_number) {
      try {
        const current = readFlowDraft(draftKey);
        if (
          current?.windowId === snapshot.window.timewindow_id &&
          current.updated <= snapshot.updated
        )
          sessionStorage.removeItem(draftKey);
        sessionStorage.removeItem(`${draftKey}:result`);
      } catch {
        /* Storage may be unavailable. */
      }
    }
  }, [snapshot, cancelled, reference, draftKey]);
  const selected = data?.windows.find(
    (w) => w.timewindow_id === draft?.windowId,
  );

  const download = () => {
    if (!snapshot) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          bookingCalendarFile(
            snapshot.window,
            snapshot.title,
            snapshot.order_number,
            snapshot.location,
          ),
        ],
        { type: "text/calendar;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "buchung.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="result">
      <div className="page-head">
        <p className="eyebrow">
          {cancelled ? "Zahlung abgebrochen" : "Buchung erhalten"}
        </p>
        <h1 className="display h1">
          {cancelled ? (
            <>
              Kein Problem, <em>nichts verloren</em>
            </>
          ) : (
            <>
              Danke für <em>Deine Buchung</em>
            </>
          )}
        </h1>
        <p className="lead">
          {cancelled
            ? "Die Zahlung wurde abgebrochen. Deine Auswahl ist noch da."
            : "Bestätigung und Ticket kommen per E-Mail. Die Rückkehr auf diese Seite bestätigt noch keinen Zahlungseingang."}
        </p>
      </div>
      {snapshot && !cancelled && (
        <div className="card ticket">
          <div className="tk-top">
            <p className="eyebrow">Buchung {snapshot.order_number}</p>
            <h2 className="display h3">{snapshot.title}</h2>
            <p>
              {bookingDate(snapshot.window.date, false, format.locale)},{" "}
              {bookingTime(snapshot.window)}
            </p>
          </div>
          <div className="perf" aria-hidden="true" />
          <div className="tk-body">
            <dl className="kv">
              <dt>Plätze</dt>
              <dd>{snapshot.seatCount}</dd>
              <dt>Ort</dt>
              <dd>
                {snapshot.location?.location_name},{" "}
                {snapshot.location?.location_street}
              </dd>
            </dl>
            {!cancelled && (
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={download}
                >
                  <BookingIcon name="calendar" /> In den Kalender
                </button>
                {routeUrl && (
                  <a
                    className="btn btn-ghost"
                    href={routeUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <BookingIcon name="pin" /> Route
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {cancelled && draft && (
        <div className="card card-pad stack">
          <p className="eyebrow">Deine Auswahl</p>
          <h2 className="display h3">
            {(data ? eventsFrom(data) : []).find(
              (t) => t.tasting_id === selected?.tasting_id,
            )?.tasting_name ?? "Dein Termin"}
          </h2>
          {selected ? (
            <>
              <p>
                {bookingDate(selected.date, false, format.locale)},{" "}
                {bookingTime(selected)}
              </p>
              <AvailabilityBadge
                window={selected}
                seats={draft.seats.length}
                leadHours={data?.settings.online_lead_hours}
              />
            </>
          ) : (
            <p>
              {data
                ? "Dieser Termin ist nicht mehr verfügbar. Wähle einen anderen Termin."
                : "Die aktuelle Verfügbarkeit wird geladen."}
            </p>
          )}
          <p>
            {draft.seats.length} {draft.seats.length === 1 ? "Platz" : "Plätze"}
          </p>
          <p>Die Plätze sind erst mit der Zahlung fest für Dich reserviert.</p>
        </div>
      )}
      {!cancelled && !snapshot && validBookingReference(reference) && (
        <p>Buchungsnummer: {reference}</p>
      )}
      <div className="btn-row">
        {cancelled && draft && (
          <a className="btn btn-primary" href={bookingUrl}>
            Weiter buchen
          </a>
        )}
        <a className="btn btn-ghost" href={calendarUrl}>
          {cancelled ? "Anderen Termin wählen" : "Weitere Termine"}
        </a>
      </div>
      {!cancelled && registerUrl && registerHint && snapshot?.guestEmail && (
        <p className="muted">
          {registerHint}{" "}
          <a
            href={`${registerUrl.split("#")[0]}#email=${encodeURIComponent(snapshot.guestEmail)}`}
          >
            Konto anlegen
          </a>
        </p>
      )}
    </div>
  );
}
