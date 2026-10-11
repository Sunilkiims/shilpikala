"use client";

import { useState } from "react";

type Props = { productId: number; name: string; returnable: boolean; replaceable: boolean; note: string };

export function PolicyRow(props: Props) {
  const [returnable, setReturnable] = useState(props.returnable);
  const [replaceable, setReplaceable] = useState(props.replaceable);
  const [note, setNote] = useState(props.note);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setState("saving");
    try {
      const res = await fetch(`/api/admin/returns/policies/${props.productId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnable, replaceable, note }),
      });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <tr className="border-t border-earth-brown/10 align-middle">
      <td className="py-2 pr-4 text-sm text-charcoal">{props.name}</td>
      <td className="pr-4"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={returnable} onChange={(e) => { setReturnable(e.target.checked); setState("idle"); }} /> <span className="sr-only">{props.name}: </span>Returnable</label></td>
      <td className="pr-4"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={replaceable} onChange={(e) => { setReplaceable(e.target.checked); setState("idle"); }} /> <span className="sr-only">{props.name}: </span>Replaceable</label></td>
      <td className="pr-4"><label><span className="sr-only">Note for {props.name}</span><input value={note} maxLength={300} onChange={(e) => { setNote(e.target.value); setState("idle"); }} placeholder="e.g. made to order" className="w-56 max-w-full border border-earth-brown/25 bg-transparent px-2 py-1 text-sm" /></label></td>
      <td className="whitespace-nowrap">
        <button type="button" onClick={save} disabled={state === "saving"} className="rounded-sm border border-earth-brown/30 px-3 py-1 text-sm hover:border-terracotta hover:text-terracotta disabled:opacity-60">Save</button>
        <span role="status" className="ml-2 text-xs">{state === "saved" ? "Saved" : state === "error" ? "Couldn't save" : ""}</span>
      </td>
    </tr>
  );
}
