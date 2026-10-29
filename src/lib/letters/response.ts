import "server-only";
import { NextResponse } from "next/server";

/** PDF affiché dans le navigateur (impression ou téléchargement), jamais mis en cache. */
export function pdfResponse(bytes: Uint8Array, filename: string): NextResponse {
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
