"use client";

import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type ActionResult, setBankAccountActive, setCheckbookArchived } from "../actions";

function useAction() {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(success);
      }
    });
  return { pending, run };
}

export function AccountActiveToggle({ accountId, isActive }: { accountId: string; isActive: boolean }) {
  const { pending, run } = useAction();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (isActive && !window.confirm("Archiver ce compte ? Il ne sera plus proposé pour de nouveaux paiements.")) {
          return;
        }
        run(() => setBankAccountActive(accountId, !isActive), isActive ? "Compte archivé." : "Compte réactivé.");
      }}
    >
      {isActive ? <ArchiveIcon aria-hidden /> : <ArchiveRestoreIcon aria-hidden />}
      {isActive ? "Archiver le compte" : "Réactiver le compte"}
    </Button>
  );
}

export function CheckbookArchiveButton({ checkbookId, archived }: { checkbookId: string; archived: boolean }) {
  const { pending, run } = useAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => run(() => setCheckbookArchived(checkbookId, !archived), archived ? "Carnet remis en service." : "Carnet archivé.")}
    >
      {archived ? "Remettre en service" : "Archiver"}
    </Button>
  );
}
