import { NextResponse } from "next/server";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { emailConfig, isAdminNotificationConfigured } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/send";
import { inquiryAlertEmail } from "@/lib/email/templates";
import { createInquiry, type InquiryKind } from "@/lib/inquiries/store";
import { validateInquiry } from "@/lib/inquiries/validation";

export async function POST(request: Request) {
  const limited = limitAttempts(request, "inquiry", 5, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // Honeypot: real visitors never see or fill this field. Pretend success
  // so bots get no signal to adapt to — and store nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ received: true }, { status: 201 });
  }

  const kind: InquiryKind | null =
    body.kind === "contact" || body.kind === "custom-art" ? body.kind : null;
  if (!kind) return NextResponse.json({ error: "invalid_kind" }, { status: 400 });

  const result = validateInquiry(kind, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const inquiry = await createInquiry(result.value);

  if (isAdminNotificationConfigured()) {
    const detailLines = inquiry.details
      ? "\n\n" + Object.entries(inquiry.details).map(([k, v]) => `${k}: ${v}`).join("\n")
      : "";
    const mail = inquiryAlertEmail({
      kind: inquiry.kind,
      name: inquiry.name,
      email: inquiry.email,
      subject: inquiry.subject,
      message: inquiry.message + detailLines,
    });
    await sendEmail({ to: emailConfig.adminNotificationEmail, ...mail });
  }

  return NextResponse.json({ received: true }, { status: 201 });
}
