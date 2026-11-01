"use client";

import { Undo2Icon } from "lucide-react";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Quarter } from "@/lib/compliance/late-payments";
import { initialFormState } from "@/lib/forms";
import { declareQuarter, undoDeclaration } from "./actions";

/** Marquer le trimestre comme déclaré (date de dépôt, référence de la déclaration). */
export function DeclarationForm({ quarter, today }: { quarter: Quarter; today: string }) {
  const [state, action, pending] = useActionState(declareQuarter, initialFormState);
  return (
    <ActionForm action={action} pending={pending} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="year" value={quarter.year} />
      <input type="hidden" name="quarter" value={quarter.quarter} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="declared_on">Date de dépôt</FieldLabel>
          <Input id="declared_on" name="declared_on" type="date" defaultValue={today} max={today} {...invalidProps(state, "declared_on")} />
          <FieldErrors state={state} name="declared_on" />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference">Référence (facultative)</FieldLabel>
          <Input id="reference" name="reference" placeholder="N° de dépôt, accusé…" maxLength={100} />
        </Field>
      </div>
      <SubmitButton className="w-fit">Marquer comme déclaré</SubmitButton>
    </ActionForm>
  );
}

export function UndoDeclarationButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await undoDeclaration(id);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Déclaration annulée.");
          }
        })
      }
    >
      <Undo2Icon aria-hidden />
      Annuler
    </Button>
  );
}
