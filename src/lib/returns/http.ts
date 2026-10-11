import { NextResponse } from "next/server";
import { ReturnError, type ReturnRequest } from "@/lib/returns/types";

/** Maps business-rule failures to JSON errors; anything unexpected is logged and hidden behind a 500. */
export function returnErrorResponse(error: unknown): NextResponse {
  if (error instanceof ReturnError) {
    return NextResponse.json({ error: error.code, ...(error.detail ? { detail: error.detail } : {}) }, { status: error.status });
  }
  console.error("[returns] unexpected error:", error);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

export function evidenceResponse(file: { mime: string; filename: string; data: Buffer }): Response {
  return new Response(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.data.length),
      "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
      // Customer evidence is private: never cached by shared caches, never sniffed.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** A request as the customer's browser may see it: never the emailed tracking secret. */
export function publicRequest(r: ReturnRequest): Omit<ReturnRequest, "trackToken"> {
  const copy: Partial<ReturnRequest> = { ...r };
  delete copy.trackToken;
  return copy as Omit<ReturnRequest, "trackToken">;
}
