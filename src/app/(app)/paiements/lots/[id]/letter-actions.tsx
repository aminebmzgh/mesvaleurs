"use client";

import { FileTextIcon, Loader2Icon, ReceiptTextIcon, Share2Icon } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { BUILTIN_LETTER_TEMPLATES } from "@/lib/letters/templates";

const noSubscription = () => () => {};

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

/**
 * Lettre d'accompagnement (A4, papier à en-tête) et bordereau de remise d'un lot :
 * ouverture du PDF pour impression, ou partage du fichier (e-mail, WhatsApp) depuis
 * un téléphone ou une tablette.
 */
export function LetterActions({ batchId, reference }: { batchId: string; reference: string }) {
  const [template, setTemplate] = useState("auto");
  const [copies, setCopies] = useState(true);
  // Partage de fichiers : navigateurs mobiles surtout (jamais au rendu serveur)
  const canShare = useSyncExternalStore(
    noSubscription,
    () => "canShare" in navigator,
    () => false,
  );
  const [pending, startTransition] = useTransition();

  const query = new URLSearchParams({ exemplaires: copies ? "2" : "1", ...(template !== "auto" ? { modele: template } : {}) });
  const letterUrl = `/paiements/lots/${batchId}/lettre?${query}`;

  const share = () =>
    startTransition(async () => {
      try {
        const response = await fetch(`/paiements/lots/${batchId}/lettre?${new URLSearchParams({ ...(template !== "auto" ? { modele: template } : {}) })}`);
        const file = new File([await response.blob()], `lettre-${reference}.pdf`, { type: "application/pdf" });
        if (!navigator.canShare({ files: [file] })) {
          toast.error("Le partage de fichiers n'est pas disponible sur cet appareil : téléchargez la lettre.");
          return;
        }
        await navigator.share({ files: [file], title: `Lettre d'accompagnement ${reference}` });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          toast.error("Le partage a échoué.");
        }
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field>
          <FieldLabel htmlFor="letter-template">Modèle de lettre</FieldLabel>
          <select id="letter-template" className={SELECT_CLASS} value={template} onChange={(event) => setTemplate(event.target.value)}>
            <option value="auto">Selon le règlement (standard, LCN ou acompte)</option>
            {BUILTIN_LETTER_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex h-8 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={copies} onChange={(event) => setCopies(event.target.checked)} />
          Double exemplaire
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={letterUrl} target="_blank" rel="noopener" className={buttonVariants()}>
          <FileTextIcon aria-hidden />
          Lettre d&apos;accompagnement (PDF)
        </a>
        <a href={`/paiements/lots/${batchId}/bordereau`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>
          <ReceiptTextIcon aria-hidden />
          Bordereau de remise (PDF)
        </a>
        {canShare && (
          <Button variant="outline" onClick={share} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <Share2Icon aria-hidden />}
            Partager la lettre
          </Button>
        )}
      </div>
    </div>
  );
}
