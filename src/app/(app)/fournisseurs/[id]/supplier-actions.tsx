"use client";

import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setSupplierActive } from "../actions";

export function SupplierActiveToggle({ supplierId, isActive }: { supplierId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (isActive && !window.confirm("Archiver ce fournisseur ? Il ne sera plus proposé pour de nouveaux paiements.")) {
          return;
        }
        startTransition(async () => {
          const result = await setSupplierActive(supplierId, !isActive);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success(isActive ? "Fournisseur archivé." : "Fournisseur réactivé.");
          }
        });
      }}
    >
      {isActive ? <ArchiveIcon aria-hidden /> : <ArchiveRestoreIcon aria-hidden />}
      {isActive ? "Archiver" : "Réactiver"}
    </Button>
  );
}
