"use client";

import { Trash2Icon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/types/database";
import { type ActionResult, changeMemberRole, removeMember, revokeInvitation } from "./actions";
import { RoleSelect } from "./role-select";

function useServerAction() {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, successMessage: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(successMessage);
      }
    });
  return { pending, run };
}

export function MemberActions({
  membershipId,
  role,
  isSelf,
}: {
  membershipId: string;
  role: AppRole;
  isSelf: boolean;
}) {
  const { pending, run } = useServerAction();

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-48">
        <RoleSelect
          size="sm"
          value={role}
          disabled={pending}
          onValueChange={(next) => run(() => changeMemberRole(membershipId, next), "Rôle modifié.")}
        />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={isSelf ? "Quitter l'entreprise" : "Retirer ce membre"}
        onClick={() => {
          const message = isSelf
            ? "Quitter cette entreprise ? Vous n'y aurez plus accès."
            : "Retirer ce membre ? Il n'aura plus accès aux données de l'entreprise.";
          if (window.confirm(message)) {
            run(() => removeMember(membershipId), "Membre retiré.");
          }
        }}
      >
        <Trash2Icon aria-hidden />
      </Button>
    </div>
  );
}

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const { pending, run } = useServerAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => run(() => revokeInvitation(invitationId), "Invitation annulée.")}
    >
      <XIcon aria-hidden />
      Annuler
    </Button>
  );
}
