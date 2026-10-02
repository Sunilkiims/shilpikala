"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteButtonProps = {
  endpoint: string;
  confirmMessage: string;
  label?: string;
};

export function DeleteButton({
  endpoint,
  confirmMessage,
  label = "Delete",
}: DeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;

    setDeleting(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        window.alert("Couldn't delete that. Please try again.");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Couldn't delete that. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={deleting}
      className="text-xs text-earth-brown/55 transition-colors hover:text-terracotta disabled:opacity-50"
    >
      {deleting ? "Deleting…" : label}
    </button>
  );
}
