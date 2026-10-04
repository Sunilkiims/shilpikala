"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewModerationActionsProps = {
  reviewId: string;
};

export function ReviewModerationActions({ reviewId }: ReviewModerationActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"approved" | "rejected" | null>(null);

  async function setStatus(status: "approved" | "rejected") {
    setPending(status);
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        window.alert("Couldn't update that review. Please try again.");
        setPending(null);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Couldn't update that review. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => setStatus("approved")}
        disabled={pending !== null}
        className="text-xs text-olive transition-colors hover:text-terracotta disabled:opacity-50"
      >
        {pending === "approved" ? "Approving…" : "Approve"}
      </button>
      <button
        type="button"
        onClick={() => setStatus("rejected")}
        disabled={pending !== null}
        className="text-xs text-earth-brown/55 transition-colors hover:text-terracotta disabled:opacity-50"
      >
        {pending === "rejected" ? "Rejecting…" : "Reject"}
      </button>
    </div>
  );
}
