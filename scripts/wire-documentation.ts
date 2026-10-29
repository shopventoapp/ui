/** Keep regenerated public wire contracts documented without changing their types. */
import ts from "typescript";

/** Attach wire-purpose and field documentation before formatting generated source. */
export function documentWireTypes(source: string): string {
  const file = ts.createSourceFile(
    "wire.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const edits: { position: number; text: string }[] = [];
  const words = (name: string) =>
    name
      .replaceAll("_", " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase();
  const fields: Record<string, string> = {
    id: "Backend record identifier. Do not substitute a materialized row ID for timewindow_id.",
    tasting_id:
      "Public event identifier. The backend wire spelling is unchanged.",
    timewindow_id: "Backend slot identifier required for booking submission.",
    variant_id: "UUID of the selected event variant.",
    price: "Price in integer cents.",
    total:
      "Server total; monetary totals are integer cents and list envelope totals are record counts.",
    amount: "Amount in integer cents.",
    order_id: "Opaque backend order identifier.",
    order_number: "Customer-visible backend order reference.",
    access_token:
      "Upstream credential. The host proxy must remove it from browser-facing login JSON.",
    turnstile_token: "Live guest challenge token. Never persist it in a draft.",
    terms_privacy_accepted:
      "Current explicit terms/privacy consent. Never restore consent from a draft.",
    marketing_consent:
      "Legacy registration field for required terms/privacy acceptance, separate from newsletter consent.",
    newsletter_consent:
      "Newsletter choice; an opt-in requires the backend double-opt-in flow.",
    description: "Backend-provided customer-visible description.",
    status: "Backend status value. The backend remains authoritative.",
    date: "Calendar date supplied by the backend.",
    start_time: "Local event start time in Europe/Berlin.",
    end_time: "Local event end time in Europe/Berlin.",
    voucher_code:
      "Voucher code carrying monetary value. Do not expose it to analytics or logs.",
    seats: "Places included in this booking request or response.",
  };
  const add = (node: ts.Node, comment: string) => {
    const documented = node as ts.Node & { jsDoc?: unknown[] };
    if (documented.jsDoc?.length) return;
    edits.push({
      position: node.getStart(file),
      text: `\n/** ${comment} */\n`,
    });
  };
  function visit(node: ts.Node) {
    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      add(
        node,
        node.name.text === "Tasting"
          ? "@deprecated Use ShopEvent from the public package entry point. Removed in 1.0."
          : `Public ${words(node.name.text)} wire contract. Values and optionality come from the backend export.`,
      );
    }
    if (ts.isPropertySignature(node)) {
      const name = node.name.getText(file).replace(/^["']|["']$/g, "");
      add(
        node,
        `${fields[name] ?? `Backend ${words(name)} value.`}${node.questionToken ? " Optional; no client default is applied to this wire field." : " Required by this wire contract."}`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const edit of edits.sort((a, b) => b.position - a.position))
    source =
      source.slice(0, edit.position) + edit.text + source.slice(edit.position);
  return source;
}
