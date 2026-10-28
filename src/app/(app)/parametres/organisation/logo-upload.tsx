"use client";

import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { setOrganizationLogo } from "./actions";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Logo imprimé en en-tête des lettres d'accompagnement. Envoyé directement du
 * navigateur vers Supabase Storage (bucket `logos`) ; PNG ou JPEG, 2 Mo au plus.
 */
export function LogoUpload({ organizationId, logoUrl, canEdit }: { organizationId: string; logoUrl: string | null; canEdit: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const upload = (file: File) => {
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error("Format non accepté : PNG ou JPEG uniquement.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Image trop volumineuse : 2 Mo maximum.");
      return;
    }
    startTransition(async () => {
      const path = `${organizationId}/logo-${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await createClient().storage.from("logos").upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast.error("L'envoi du logo a échoué. Réessayez.");
        return;
      }
      const result = await setOrganizationLogo(path);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Logo enregistré.");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-16 w-40 items-center justify-center rounded-lg border bg-white">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu d'une URL signée temporaire
          <img src={logoUrl} alt="Logo de l'entreprise" className="max-h-14 max-w-36 object-contain" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-label="Aucun logo" />
        )}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-label="Choisir le logo"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                upload(file);
              }
              event.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <UploadIcon aria-hidden />}
            {logoUrl ? "Remplacer le logo" : "Ajouter un logo"}
          </Button>
          {logoUrl && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setOrganizationLogo(null);
                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    toast.success("Logo retiré.");
                  }
                })
              }
            >
              <Trash2Icon aria-hidden />
              Retirer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
