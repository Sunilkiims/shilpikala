"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/forms/fields";
import { cn } from "@/lib/utils/cn";
import { MAX_IMAGES, REASONS, TYPE_LABEL, type RequestType } from "@/lib/returns/config";
import type { Address } from "@/types/catalog";

export type FormItem = {
  productId: number;
  name: string;
  imageId?: number;
  unitPrice: string;
  orderedQty: number;
  availableQty: number;
  canReturn: boolean;
  canReplace: boolean;
  /** Why the item cannot be requested, if it can't. */
  blockedReason?: string;
};

type Props = {
  orderId: string;
  orderNumberLabel: string;
  items: FormItem[];
  defaultAddress: Address;
  deadlineLabel: string;
  daysRemaining: number;
  payoutEnabled: boolean;
  videoMaxMb: number;
  imageMaxMb: number;
};

const ERRORS: Record<string, string> = {
  unauthorized: "Please sign in again.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  window_closed: "The return/replacement window for this order has closed.",
  not_delivered: "This order has not been delivered yet.",
  delivery_date_missing: "We don't have a confirmed delivery date for this order. Please contact us.",
  not_returnable: "One of the selected items cannot be returned.",
  not_replaceable: "One of the selected items cannot be replaced.",
  duplicate_request: "There is already an active request for some of these items.",
  item_not_in_order: "One of the items is not part of this order.",
  invalid_quantity: "Please check the quantities.",
  no_items: "Select at least one item.",
  description_too_short: "Please describe the issue (at least 10 characters).",
  description_too_long: "Please shorten the description.",
  invalid_address: "Please complete the pickup address.",
  image_required: "Add at least one clear photo of the item.",
  unsupported_file_type: "Only JPG, PNG or WebP photos and MP4, MOV or WebM video are accepted.",
  file_too_large: "A photo is too large.",
  video_too_large: "The video is too large.",
  too_many_images: `You can add up to ${MAX_IMAGES} photos.`,
  invalid_upi: "Enter a valid UPI ID, like name@bank.",
  invalid_bank_details: "Check the bank account number and IFSC code.",
  payout_method_unavailable: "That refund method isn't available right now. Choose the original payment method.",
  order_not_found: "We couldn't find that order on your account.",
};

const STEPS = ["Items", "Issue", "Photos", "Pickup & refund"] as const;

/** Resize big phone photos in the browser so five of them fit inside a request. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 700 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

type Picked = { file: File; url: string };

export function ReturnRequestForm(props: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [type, setType] = useState<RequestType>("return");
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<Picked[]>([]);
  const [video, setVideo] = useState<Picked | null>(null);
  const [address, setAddress] = useState<Address>(props.defaultAddress);
  const [refundMethod, setRefundMethod] = useState<"original" | "upi" | "bank">("original");
  const [upiId, setUpiId] = useState("");
  const [bank, setBank] = useState({ accountHolder: "", accountNumber: "", ifsc: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);

  // Preview URLs are revoked when files are removed or the form goes away.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => headingRef.current?.focus(), [step, done]);

  const selected = props.items.filter((i) => (qty[i.productId] ?? 0) > 0);
  const canDo = (t: RequestType) => selected.length > 0 && selected.every((i) => (t === "return" ? i.canReturn : i.canReplace));
  const typeOk = canDo(type);

  function validate(forStep: number): string | null {
    if (forStep === 0 && selected.length === 0) return ERRORS.no_items;
    if (forStep === 1) {
      if (!typeOk) return type === "return" ? ERRORS.not_returnable : ERRORS.not_replaceable;
      if (description.trim().length < 10) return ERRORS.description_too_short;
    }
    if (forStep === 2 && images.length === 0) return ERRORS.image_required;
    if (forStep === 3) {
      if (!address.fullName.trim() || !address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.postalCode.trim()) return ERRORS.invalid_address;
      if (type === "return" && refundMethod === "upi" && !/^[\w.-]{2,64}@[A-Za-z][A-Za-z0-9]{1,31}$/.test(upiId.trim())) return ERRORS.invalid_upi;
      if (type === "return" && refundMethod === "bank" && (!bank.accountHolder.trim() || !/^\d{9,18}$/.test(bank.accountNumber.replace(/\s/g, "")) || !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(bank.ifsc.trim()))) return ERRORS.invalid_bank_details;
    }
    return null;
  }

  function next() {
    const problem = validate(step);
    setError(problem);
    if (!problem) setStep((s) => s + 1);
  }

  async function addImages(list: FileList | null) {
    if (!list) return;
    setError(null);
    const room = MAX_IMAGES - images.length;
    const accepted = [...list].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type)).slice(0, room);
    if (list.length > accepted.length) setError(`Photos must be JPG, PNG or WebP, up to ${MAX_IMAGES} in total.`);
    const added: Picked[] = [];
    for (const f of accepted) {
      const small = await shrinkImage(f);
      if (small.size > props.imageMaxMb * 1024 * 1024) {
        setError(ERRORS.file_too_large);
        continue;
      }
      const url = URL.createObjectURL(small);
      urls.current.push(url);
      added.push({ file: small, url });
    }
    setImages((cur) => [...cur, ...added]);
  }

  function pickVideo(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    if (!/^video\/(mp4|quicktime|webm)$/.test(f.type)) return setError(ERRORS.unsupported_file_type);
    if (f.size > props.videoMaxMb * 1024 * 1024) return setError(`The video must be under ${props.videoMaxMb} MB.`);
    setError(null);
    const url = URL.createObjectURL(f);
    urls.current.push(url);
    setVideo({ file: f, url });
  }

  async function submit() {
    const problem = validate(3);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("orderId", props.orderId);
    fd.set("type", type);
    fd.set("reason", reason);
    fd.set("description", description.trim());
    fd.set("items", JSON.stringify(selected.map((i) => ({ productId: i.productId, quantity: qty[i.productId] }))));
    fd.set("pickupAddress", JSON.stringify(address));
    if (type === "return") {
      fd.set("refundMethod", refundMethod);
      if (refundMethod === "upi") fd.set("payout", JSON.stringify({ upiId: upiId.trim() }));
      if (refundMethod === "bank") fd.set("payout", JSON.stringify(bank));
    }
    for (const img of images) fd.append("evidence", img.file);
    if (video) fd.append("evidence", video.file);
    try {
      const res = await fetch("/api/account/returns", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERRORS[body.error as string] ?? (res.status === 413 ? "The files are too large to upload. Try fewer or smaller photos." : "We couldn't submit your request. Please try again."));
        return;
      }
      // No router.refresh() here: once the last unit is requested the server page stops rendering this
      // form, which would wipe the confirmation. The links below load fresh (dynamic) pages.
      setDone({ id: body.request.id });
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-sm border border-olive/40 bg-olive/5 p-6">
        <h3 ref={headingRef} tabIndex={-1} className="text-xl text-charcoal outline-none focus-visible:outline-none">Request submitted</h3>
        <p className="mt-2 text-sm text-earth-brown/85">
          Your {TYPE_LABEL[type].toLowerCase()} request for order {props.orderNumberLabel} has been received. We have emailed you a confirmation.
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.15em] text-earth-brown/70">Your request ID</p>
        <p className="font-mono text-2xl text-charcoal">{done.id}</p>
        <p className="mt-4 text-sm text-earth-brown/85">We will review it and email you at each step. You can follow it any time.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href={`/account/returns/${done.id}`}>Track this request</Button>
          <Button href="/account" variant="secondary">Back to my account</Button>
        </div>
      </div>
    );
  }

  const label = "text-sm text-earth-brown/80";

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (step === 3) void submit(); else next(); }} className="rounded-sm border border-earth-brown/20 p-4 sm:p-6" noValidate>
      <ol className="flex flex-wrap gap-x-5 gap-y-1 text-xs" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn(i === step ? "text-terracotta" : i < step ? "text-charcoal" : "text-earth-brown/55")}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <h3 ref={headingRef} tabIndex={-1} className="mt-4 text-xl text-charcoal outline-none focus-visible:outline-none">{STEPS[step]}</h3>
      <p className="mt-1 text-xs text-earth-brown/70">
        {props.daysRemaining} {props.daysRemaining === 1 ? "day" : "days"} left · request by {props.deadlineLabel}
      </p>

      <div className="mt-5">
        {step === 0 && (
          <fieldset className="min-w-0">
            <legend className={label}>Which items, and how many?</legend>
            <ul className="mt-3 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
              {props.items.map((item) => {
                const blocked = item.availableQty === 0 || (!item.canReturn && !item.canReplace);
                return (
                  <li key={item.productId} className="flex items-center gap-3 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.imageId ? <img src={`/media/product-images/${item.imageId}`} alt="" className="h-14 w-14 shrink-0 rounded-sm object-cover" /> : <span aria-hidden="true" className="h-14 w-14 shrink-0 rounded-sm bg-earth-brown/10" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-charcoal">{item.name}</p>
                      <p className="text-xs text-earth-brown/70">
                        Ordered {item.orderedQty} · ₹{item.unitPrice} each
                        {blocked && <span className="text-terracotta-deep"> · {item.blockedReason ?? "Not eligible"}</span>}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-xs text-earth-brown/80">
                      <span className="sr-only">Quantity of {item.name}</span>
                      <select
                        disabled={blocked}
                        value={qty[item.productId] ?? 0}
                        onChange={(e) => setQty((q) => ({ ...q, [item.productId]: Number(e.target.value) }))}
                        className="border border-earth-brown/25 bg-transparent px-2 py-1.5 text-sm text-charcoal disabled:opacity-50"
                      >
                        {Array.from({ length: item.availableQty + 1 }, (_, n) => (
                          <option key={n} value={n}>{n === 0 ? "None" : n}</option>
                        ))}
                      </select>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {step === 1 && (
          <div className="grid gap-5">
            <fieldset className="min-w-0">
              <legend className={label}>What would you like?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["return", "replacement"] as const).map((t) => (
                  <label key={t} className={cn("flex cursor-pointer items-start gap-2 rounded-sm border p-3 text-sm", type === t ? "border-terracotta bg-terracotta/5" : "border-earth-brown/25", !canDo(t) && "cursor-not-allowed opacity-50")}>
                    <input type="radio" name="type" value={t} checked={type === t} disabled={!canDo(t)} onChange={() => setType(t)} className="mt-1" />
                    <span>
                      <span className="block text-charcoal">{TYPE_LABEL[t]}</span>
                      <span className="block text-xs text-earth-brown/70">
                        {canDo(t) ? (t === "return" ? "Send it back and get your money back" : "Send it back and get a new one") : "Not available for the selected items"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className={label}>Reason</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass}>
                {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={label}>Describe the issue</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={1500} className={fieldClass} aria-describedby="desc-hint" />
              <span id="desc-hint" className="mt-1 block text-xs text-earth-brown/70">What is wrong, and where? The more detail, the faster we can help.</span>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5">
            <div>
              <label className={label} htmlFor="photos">Photos (required, up to {MAX_IMAGES})</label>
              <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={images.length >= MAX_IMAGES}
                onChange={(e) => { void addImages(e.target.files); e.target.value = ""; }} className="mt-1.5 block w-full text-sm" />
              {images.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {images.map((img, i) => (
                    <li key={img.url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-sm object-cover" />
                      <button type="button" onClick={() => setImages((cur) => cur.filter((x) => x !== img))} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-charcoal/80 text-xs text-ivory" aria-label={`Remove photo ${i + 1}`}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className={label} htmlFor="video">Unboxing video (optional, up to {props.videoMaxMb} MB)</label>
              <input id="video" type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(e) => { pickVideo(e.target.files); e.target.value = ""; }} className="mt-1.5 block w-full text-sm" />
              {video && (
                <p className="mt-2 flex items-center gap-3 text-xs text-earth-brown/80">
                  {video.file.name} ({(video.file.size / 1048576).toFixed(1)} MB)
                  <button type="button" onClick={() => setVideo(null)} className="text-terracotta underline underline-offset-2">Remove</button>
                </p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5">
            <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2">
              <legend className={label}>Pickup address</legend>
              {(
                [["fullName", "Full name", true], ["phone", "Phone", false], ["line1", "Address line 1", true], ["line2", "Address line 2 (optional)", false], ["city", "City", true], ["state", "State", true], ["postalCode", "Postal code", true], ["country", "Country", true]] as const
              ).map(([key, text, required]) => (
                <label key={key} className={cn("block", (key === "line1" || key === "line2") && "sm:col-span-2")}>
                  <span className={label}>{text}</span>
                  <input value={address[key] ?? ""} required={required} onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))} className={fieldClass} autoComplete={key === "postalCode" ? "postal-code" : undefined} />
                </label>
              ))}
            </fieldset>

            {type === "return" && (
              <fieldset className="min-w-0">
                <legend className={label}>Refund method</legend>
                <div className="mt-2 grid gap-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name="refund" checked={refundMethod === "original"} onChange={() => setRefundMethod("original")} className="mt-1" />
                    <span>Original payment method <span className="block text-xs text-earth-brown/70">Recommended — back to the card, UPI or bank you paid with.</span></span>
                  </label>
                  {props.payoutEnabled && (
                    <>
                      <label className="flex items-start gap-2 text-sm">
                        <input type="radio" name="refund" checked={refundMethod === "upi"} onChange={() => setRefundMethod("upi")} className="mt-1" />
                        <span>UPI</span>
                      </label>
                      {refundMethod === "upi" && (
                        <label className="block pl-6">
                          <span className={label}>UPI ID</span>
                          <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" autoComplete="off" className={fieldClass} />
                        </label>
                      )}
                      <label className="flex items-start gap-2 text-sm">
                        <input type="radio" name="refund" checked={refundMethod === "bank"} onChange={() => setRefundMethod("bank")} className="mt-1" />
                        <span>Bank transfer</span>
                      </label>
                      {refundMethod === "bank" && (
                        <div className="grid gap-3 pl-6 sm:grid-cols-3">
                          <label className="block"><span className={label}>Account holder</span><input value={bank.accountHolder} onChange={(e) => setBank((b) => ({ ...b, accountHolder: e.target.value }))} autoComplete="off" className={fieldClass} /></label>
                          <label className="block"><span className={label}>Account number</span><input inputMode="numeric" value={bank.accountNumber} onChange={(e) => setBank((b) => ({ ...b, accountNumber: e.target.value }))} autoComplete="off" className={fieldClass} /></label>
                          <label className="block"><span className={label}>IFSC</span><input value={bank.ifsc} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value.toUpperCase() }))} autoComplete="off" className={fieldClass} /></label>
                        </div>
                      )}
                      {refundMethod !== "original" && <p className="pl-6 text-xs text-earth-brown/70">Stored encrypted, used only to pay your refund, and deleted once it is paid.</p>}
                    </>
                  )}
                </div>
              </fieldset>
            )}

            <div className="rounded-sm bg-earth-brown/5 p-3 text-sm text-earth-brown/90">
              <p className="text-charcoal">Summary</p>
              <p>{TYPE_LABEL[type]} · {selected.map((i) => `${i.name} × ${qty[i.productId]}`).join(", ")}</p>
              <p className="text-xs text-earth-brown/70">{images.length} photo{images.length === 1 ? "" : "s"}{video ? " + 1 video" : ""}</p>
            </div>
          </div>
        )}
      </div>

      <div aria-live="polite" className="mt-4 min-h-5">
        {error && <p role="alert" className="text-sm text-terracotta-deep">{error}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {step > 0 && <Button type="button" variant="secondary" onClick={() => { setError(null); setStep((s) => s - 1); }}>Back</Button>}
        <Button type="submit" disabled={busy}>{step === 3 ? (busy ? "Submitting…" : "Submit request") : "Continue"}</Button>
        <Link href="/return-refund-policy" className="text-xs text-terracotta underline underline-offset-2 hover:text-terracotta-deep">Return &amp; refund policy</Link>
      </div>
    </form>
  );
}
