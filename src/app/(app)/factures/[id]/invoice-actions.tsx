"use client";

import { ShieldAlertIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteInvoice, setInvoiceDisputed } from "../actions";

export function InvoiceActions({
  invoiceId,
  disputed,
  canEdit,
  canDelete,
}: {
  invoiceId: string;
  disputed: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setInvoiceDisputed(invoiceId, !disputed);
              if (result.error) {
                toast.error(result.error);
              } else {
                toast.success(disputed ? "Contestation levée." : "Facture marquée comme contestée.");
              }
            })
          }
        >
          {disputed ? <ShieldCheckIcon aria-hidden /> : <ShieldAlertIcon aria-hidden />}
          {disputed ? "Lever la contestation" : "Contester"}
        </Button>
      )}
      {canDelete && (
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Supprimer définitivement cette facture ?")) {
              return;
            }
            startTransition(async () => {
              const result = await deleteInvoice(invoiceId);
              if (result?.error) {
                toast.error(result.error);
              }
            });
          }}
        >
          <Trash2Icon aria-hidden />
          Supprimer
        </Button>
      )}
    </div>
  );
}
