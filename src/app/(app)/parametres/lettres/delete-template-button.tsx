"use client";

import { Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteLetterTemplate } from "./actions";

export function DeleteTemplateButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Supprimer le modèle ${name}`}
      onClick={() => {
        if (!window.confirm(`Supprimer le modèle « ${name} » ?`)) {
          return;
        }
        startTransition(async () => {
          const result = await deleteLetterTemplate(id);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Modèle supprimé.");
          }
        });
      }}
    >
      <Trash2Icon aria-hidden />
    </Button>
  );
}
