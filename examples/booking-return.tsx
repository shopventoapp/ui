"use client";
import { BookingResult } from "@shopvento/ui";
import { useEffect, useState } from "react";

export function BookingReturnExample() {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
  return <BookingResult url={url} outcome="success" />;
}
