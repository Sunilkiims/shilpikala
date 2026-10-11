import { siteConfig } from "@/lib/config/site";
import { returnWindowDays } from "@/lib/returns/config";

/**
 * Wording of the public policy. The window length comes from RETURN_WINDOW_DAYS
 * (default: siteConfig.business.returnWindowDays); edit the text here.
 * Per-product exceptions are set in Admin → Returns → Product policies.
 */
export function returnPolicyContent() {
  const days = returnWindowDays();
  return {
    days,
    updated: "October 2026",
    intro: `ShilpiKala pieces are handmade, so each one is slightly unique. If something arrives damaged, defective or not as described, you can ask for a return or a replacement within ${days} days of delivery, from your account.`,
    sections: [
      {
        heading: `The ${days}-day window`,
        paragraphs: [
          `You can request a return or a replacement for ${days} calendar days from the date and time we confirm delivery (not from the order date). The deadline for each order is shown in My Account → Orders → Order details.`,
          "After the window closes the request button is switched off. Your rights under consumer protection law are not affected by this window (see \"Your legal rights\" below).",
        ],
      },
      {
        heading: "What can be returned or replaced",
        paragraphs: [
          "Delivered items that are damaged in transit, defective, the wrong product, different from the description, missing parts or accessories, or have a quality problem.",
          "You can return only some of the items in an order, or only some of the quantity. The same unit cannot have two active requests.",
        ],
      },
      {
        heading: "What cannot be returned",
        paragraphs: [
          "Personalised, custom-commissioned and made-to-order pieces are made specially for you, so they cannot be returned for a change of mind. Products marked non-returnable on their page are covered by the same rule.",
          "Items damaged after delivery by misuse, or returned without their original packaging, may fail inspection.",
        ],
      },
      {
        heading: "Damaged or incorrect items",
        paragraphs: [
          "If your piece is damaged, defective or not what you ordered, you can always ask for a remedy, including for custom work. Tell us within the window and add clear photos (and an unboxing video if you have one). We will not turn a request down only because the piece was custom-made.",
        ],
      },
      {
        heading: "Handmade and customised artwork",
        paragraphs: [
          "Hand-painted and hand-made work shows small natural variations in colour, line and texture. These are part of the craft and are not defects. A piece that differs materially from its description or from an approved design is a defect, and we will put it right.",
        ],
      },
      {
        heading: "How the pickup works",
        paragraphs: [
          "Once we approve your request, we schedule a pickup from the address you gave and email you the date. Keep the piece in its original packaging. If the pickup cannot be completed we will reschedule it with you.",
        ],
      },
      {
        heading: "Quality inspection",
        paragraphs: [
          "When the piece reaches us we check it against your request. You are told the result by email. If the inspection does not confirm the problem we review it with you before closing the request.",
        ],
      },
      {
        heading: "How refunds work",
        paragraphs: [
          "Refunds go to your original payment method. We refund the price you paid for the returned items. If you return the whole order because it was damaged, defective or wrong, we refund the shipping you paid too.",
          "A refund is marked complete only after the payment provider confirms it. After that, your bank may take about 5–7 business days to show it. If a refund to the original method is not possible, we will agree a UPI or bank transfer with you.",
        ],
      },
      {
        heading: "How replacements work",
        paragraphs: [
          "If you ask for a replacement and the item passes inspection, we send a new piece and give you a tracking number. If it is out of stock we will tell you, and offer to make it again or refund you instead.",
        ],
      },
      {
        heading: "Help and escalation",
        paragraphs: [
          `Write to ${siteConfig.contact.email} with your request number. If we have not resolved the matter, you can also contact the National Consumer Helpline (1915, consumerhelpline.gov.in).`,
        ],
      },
      {
        heading: "Your legal rights",
        paragraphs: [
          "Nothing in this policy limits your statutory rights under the Consumer Protection Act, 2019 and the rules made under it, including your remedies for defective goods or goods that are not as described.",
        ],
      },
    ],
  };
}
