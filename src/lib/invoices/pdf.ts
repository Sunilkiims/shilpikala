import PDFDocument from "pdfkit";
import type { StoredOrder } from "@/lib/orders/types";
import { formatOrderNumber } from "@/lib/orders/types";
import type { BusinessProfile } from "./business";
import { computeInvoiceTotals, rs } from "./totals";
import type { InvoiceRecord } from "./store";

const INK = "#24211e";
const MUTED = "#6b5d50";
const TERRACOTTA = "#a65335";
const LINE = "#e0d6c6";
const WASH = "#f6f0e6";

/**
 * The built-in PDF fonts only cover Latin text. Anything outside that
 * range (e.g. Devanagari names) would print as garbage, so it is
 * replaced with "?" rather than corrupting the invoice.
 */
export function pdfSafe(value: string | undefined): string {
  return (value ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E -ÿ\n]/g, "?");
}

function mandala(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number) {
  doc.save().lineWidth(0.8).strokeColor(TERRACOTTA).fillColor(TERRACOTTA);
  doc.circle(cx, cy, r).stroke();
  doc.circle(cx, cy, r * 0.62).stroke();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    doc.circle(cx + Math.cos(a) * r * 0.81, cy + Math.sin(a) * r * 0.81, r * 0.14).fill();
  }
  doc.circle(cx, cy, r * 0.2).fill();
  doc.restore();
}

export function invoiceFileName(invoice: InvoiceRecord): string {
  return `ShilpiKala-Invoice-${invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "-")}.pdf`;
}

export function renderInvoicePdf(
  order: StoredOrder,
  invoice: InvoiceRecord,
  business: BusinessProfile
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: pdfSafe(business.legalName),
        Subject: `Order ${formatOrderNumber(order.orderNumber)}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      draw(doc, order, invoice, business);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function draw(
  doc: PDFKit.PDFDocument,
  order: StoredOrder,
  invoice: InvoiceRecord,
  business: BusinessProfile
) {
  const totals = computeInvoiceTotals(order, business);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // --- Header -------------------------------------------------------
  mandala(doc, left + 20, 72, 20);
  doc.fillColor(TERRACOTTA).font("Times-Bold").fontSize(22).text("ShilpiKala", left + 50, 56, { lineBreak: false });
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("ART  -  SOUL  -  CRAFT", left + 51, 82, { lineBreak: false, characterSpacing: 1.5 });

  doc.fillColor(INK).font("Times-Roman").fontSize(26).text(business.gstin ? "TAX INVOICE" : "INVOICE", left, 54, {
    width,
    align: "right",
  });

  // Seller block
  let y = 118;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(pdfSafe(business.legalName), left, y);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  const sellerLines = [
    business.address,
    business.email,
    business.phone,
    business.gstin ? `GSTIN: ${business.gstin}` : "",
  ].filter(Boolean);
  doc.text(pdfSafe(sellerLines.join("\n")), left, doc.y + 2, { width: width / 2 - 10 });

  // Invoice meta (right column)
  const metaX = left + width / 2 + 30;
  const meta: Array<[string, string]> = [
    ["Invoice no.", invoice.invoiceNumber],
    ["Invoice date", new Date(invoice.issuedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })],
    ["Order no.", formatOrderNumber(order.orderNumber)],
    ["Order date", new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })],
  ];
  let my = y;
  for (const [k, v] of meta) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(k, metaX, my, { width: 80, lineBreak: false });
    doc.font("Helvetica-Bold").fillColor(INK).text(pdfSafe(v), metaX + 85, my, { width: right - metaX - 85, lineBreak: false });
    my += 15;
  }

  y = Math.max(doc.y, my) + 22;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor(LINE).stroke();
  y += 14;

  // --- Billing / shipping ------------------------------------------
  const a = order.address;
  const addressText = pdfSafe(
    [a.fullName, a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`, a.country, a.phone ? `Phone: ${a.phone}` : "", order.customerEmail]
      .filter(Boolean)
      .join("\n")
  );
  const colW = width / 2 - 10;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(TERRACOTTA).text("BILLED TO", left, y, { characterSpacing: 1 });
  doc.text("SHIP TO", left + width / 2 + 10, y, { characterSpacing: 1 });
  const textY = y + 14;
  doc.font("Helvetica").fontSize(9.5).fillColor(INK);
  doc.text(addressText, left, textY, { width: colW });
  const afterBilled = doc.y;
  doc.text(addressText, left + width / 2 + 10, textY, { width: colW });
  y = Math.max(afterBilled, doc.y) + 20;

  // --- Items table --------------------------------------------------
  const colTotal = right;
  const amtX = right - 100; // amount column: 92 wide
  const unitX = right - 215; // unit price column: 105 wide
  const qtyX = right - 265; // qty column: 40 wide
  doc.rect(left, y, width, 22).fill(WASH);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5);
  doc.text("ITEM", left + 8, y + 7, { lineBreak: false });
  doc.text("QTY", qtyX, y + 7, { width: 40, align: "right", lineBreak: false });
  doc.text("UNIT PRICE", unitX, y + 7, { width: 105, align: "right", lineBreak: false });
  doc.text("AMOUNT", amtX, y + 7, { width: 92, align: "right", lineBreak: false });
  y += 28;

  doc.font("Helvetica").fontSize(9.5).fillColor(INK);
  for (const line of totals.lines) {
    const nameWidth = qtyX - left - 20;
    const h = doc.heightOfString(pdfSafe(line.name), { width: nameWidth });
    if (y + h + 12 > doc.page.height - 120) {
      doc.addPage();
      y = doc.page.margins.top;
      doc.font("Helvetica").fontSize(9.5).fillColor(INK);
    }
    doc.text(pdfSafe(line.name), left + 8, y, { width: nameWidth });
    doc.text(String(line.quantity), qtyX, y, { width: 40, align: "right", lineBreak: false });
    doc.text(rs(line.unitPaise), unitX, y, { width: 105, align: "right", lineBreak: false });
    doc.text(rs(line.totalPaise), amtX, y, { width: 92, align: "right", lineBreak: false });
    y += h + 8;
    doc.moveTo(left, y - 3).lineTo(right, y - 3).lineWidth(0.4).strokeColor(LINE).stroke();
  }

  // --- Totals -------------------------------------------------------
  if (y + 170 > doc.page.height - 60) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  y += 8;
  const labelX = left + width * 0.5;
  const row = (label: string, value: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9.5).fillColor(INK);
    doc.text(label, labelX, y, { width: width * 0.28, lineBreak: false });
    doc.text(value, colTotal - 110, y, { width: 102, align: "right", lineBreak: false });
    y += bold ? 20 : 15;
  };
  row("Items total", rs(totals.grossItemsPaise));
  if (totals.discountPaise > 0) row("Discount", `- ${rs(totals.discountPaise)}`);
  row("Shipping", totals.shippingPaise === 0 ? "Free" : rs(totals.shippingPaise));
  doc.moveTo(labelX, y).lineTo(right, y).lineWidth(0.8).strokeColor(INK).stroke();
  y += 6;
  row("Total paid", rs(totals.totalPaise), true);

  if (totals.tax) {
    const t = totals.tax;
    y += 4;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(TERRACOTTA).text(`GST BREAKDOWN (INCLUDED IN TOTAL @ ${t.ratePercent}%)`, labelX, y, { characterSpacing: 0.5, lineBreak: false });
    y += 14;
    row("Taxable value", rs(t.taxableValuePaise));
    if (t.kind === "igst") {
      row(`IGST @ ${t.ratePercent}%`, rs(t.igstPaise));
    } else {
      row(`CGST @ ${t.ratePercent / 2}%`, rs(t.cgstPaise));
      row(`SGST @ ${t.ratePercent / 2}%`, rs(t.sgstPaise));
    }
  }

  // --- Payment ------------------------------------------------------
  y += 14;
  doc.rect(left, y, width, 52).fill(WASH);
  doc.fillColor(TERRACOTTA).font("Helvetica-Bold").fontSize(8).text("PAYMENT", left + 10, y + 8, { characterSpacing: 1, lineBreak: false });
  doc.fillColor(INK).font("Helvetica").fontSize(9.5);
  doc.text(`Status: Paid${order.paymentMethod ? `   |   Method: ${pdfSafe(order.paymentMethod.toUpperCase())}` : ""}`, left + 10, y + 22, { lineBreak: false });
  doc.text(`Transaction reference: ${pdfSafe(order.razorpayPaymentId)}   |   Gateway order: ${pdfSafe(order.razorpayOrderId)}`, left + 10, y + 36, { lineBreak: false, width: width - 20 });
  y += 70;

  // --- Footer -------------------------------------------------------
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
  const notes = [
    "Thank you for choosing handmade. This is a computer-generated invoice and does not require a signature.",
    business.gstin
      ? "Prices include GST as shown above."
      : "Prices are as charged at checkout. No GST registration details are configured for this seller.",
    `Questions? ${business.email}${business.phone ? "  |  " + business.phone : ""}`,
  ];
  doc.text(pdfSafe(notes.join("\n")), left, y, { width, lineGap: 2 });
}
