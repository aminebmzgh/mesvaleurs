"use client";

import { FileTextIcon, Loader2Icon, MailIcon, Share2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailReceipt } from "../actions";

/** Reçu PDF : ouvrir, envoyer par e-mail au fournisseur, partager (WhatsApp…) depuis le téléphone. */
export function ReceiptActions({
  receiptId,
  reference,
  supplierEmail,
  shareText,
  canSend,
}: {
  receiptId: string;
  reference: string;
  supplierEmail: string | null;
  shareText: string;
  canSend: boolean;
}) {
  const [email, setEmail] = useState(supplierEmail ?? "");
  const [sending, startSending] = useTransition();
  const [sharing, startSharing] = useTransition();
  const pdfUrl = `/paiements/accuses/${receiptId}/pdf`;

  const send = () =>
    startSending(async () => {
      const result = await emailReceipt(receiptId, email);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
      }
    });

  // Partage du PDF lui-même (WhatsApp, e-mail…) quand l'appareil le permet, sinon message WhatsApp
  const share = () =>
    startSharing(async () => {
      try {
        const response = await fetch(pdfUrl);
        const file = new File([await response.blob()], `accuse-${reference}.pdf`, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `Accusé de réception ${reference}`, text: shareText });
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <a href={pdfUrl} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>
          <FileTextIcon aria-hidden />
          Reçu PDF
        </a>
        <Button variant="outline" onClick={share} disabled={sharing}>
          {sharing ? <Loader2Icon className="animate-spin" aria-hidden /> : <Share2Icon aria-hidden />}
          Partager (WhatsApp…)
        </Button>
      </div>
      {canSend && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
            E-mail du fournisseur
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="comptabilite@fournisseur.ma" required />
          </label>
          <Button type="submit" disabled={sending || !email.trim()}>
            {sending ? <Loader2Icon className="animate-spin" aria-hidden /> : <MailIcon aria-hidden />}
            Envoyer le reçu
          </Button>
        </form>
      )}
    </div>
  );
}
