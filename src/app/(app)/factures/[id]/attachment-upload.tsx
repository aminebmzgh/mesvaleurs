"use client";

import { FileIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES, attachmentPath } from "@/lib/invoices/schemas";
import { createClient } from "@/lib/supabase/client";
import { setInvoiceAttachment } from "../actions";

/**
 * Pièce jointe d'une facture : le fichier part directement du navigateur vers
 * Supabase Storage (la RLS du bucket vérifie l'organisation), sans passer par les
 * fonctions Vercel ; le serveur n'enregistre ensuite que son chemin.
 */
export function AttachmentUpload({
  organizationId,
  invoiceId,
  attachmentUrl,
  canEdit,
}: {
  organizationId: string;
  invoiceId: string;
  attachmentUrl: string | null;
  canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const upload = (file: File) => {
    if (!(ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Format non accepté : PDF, JPEG ou PNG uniquement.");
      return;
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.error("Fichier trop volumineux : 20 Mo maximum.");
      return;
    }
    startTransition(async () => {
      const path = attachmentPath(organizationId, invoiceId, file.name, crypto.randomUUID());
      const { error } = await createClient().storage.from("factures").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        toast.error("L'envoi du fichier a échoué. Réessayez.");
        return;
      }
      const result = await setInvoiceAttachment(invoiceId, path);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Pièce jointe enregistrée.");
      }
    });
  };

  const remove = () =>
    startTransition(async () => {
      const result = await setInvoiceAttachment(invoiceId, null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Pièce jointe retirée.");
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {attachmentUrl ? (
        <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
          <FileIcon aria-hidden />
          Voir la pièce jointe
        </a>
      ) : (
        <span className="text-sm text-muted-foreground">Aucune pièce jointe.</span>
      )}
      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ATTACHMENT_MIME_TYPES.join(",")}
            className="sr-only"
            aria-label="Choisir la pièce jointe"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                upload(file);
              }
            }}
          />
          <Button variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <UploadIcon aria-hidden />}
            {attachmentUrl ? "Remplacer" : "Joindre la facture (PDF ou photo)"}
          </Button>
          {attachmentUrl && (
            <Button variant="ghost" disabled={pending} onClick={remove} aria-label="Retirer la pièce jointe">
              <Trash2Icon aria-hidden />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
