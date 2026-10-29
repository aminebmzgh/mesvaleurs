"use client";

import { MailIcon } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ENVELOPE_FORMATS, type EnvelopeFormat } from "@/lib/printing/envelope";

/** Enveloppe (PDF au format choisi) : `href` est la route de l'enveloppe, sans paramètres. */
export function EnvelopeButton({ href }: { href: string }) {
  const [format, setFormat] = useState<EnvelopeFormat>("DL");
  return (
    <span className="inline-flex items-center gap-1">
      <select
        aria-label="Format d'enveloppe"
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        value={format}
        onChange={(event) => setFormat(event.target.value as EnvelopeFormat)}
      >
        {(Object.keys(ENVELOPE_FORMATS) as EnvelopeFormat[]).map((key) => (
          <option key={key} value={key}>
            {ENVELOPE_FORMATS[key].label}
          </option>
        ))}
      </select>
      <a href={`${href}?format=${format}`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>
        <MailIcon aria-hidden />
        Enveloppe (PDF)
      </a>
    </span>
  );
}
