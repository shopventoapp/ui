import type { CSSProperties } from "react";

/** Consistent field-error typography for standalone public forms. */
export const publicFormFieldErrorStyle: CSSProperties = {
  fontFamily: "var(--sv-font, Georgia, serif)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: "6px 0 0",
  color: "var(--sv-primary, #0b5cad)",
};
