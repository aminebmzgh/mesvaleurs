"use client";

import { useActionState } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/forms";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { initialFormState } from "@/lib/forms";
import { setEmailAlerts } from "./actions";

export function EmailAlertsForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(setEmailAlerts, initialFormState);
  return (
    <ActionForm action={action} pending={pending} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Field orientation="horizontal">
        <input id="enabled" name="enabled" type="checkbox" defaultChecked={enabled} className="mt-0.5 size-4 accent-primary" />
        <FieldContent>
          <FieldLabel htmlFor="enabled">Recevoir le récapitulatif des alertes chaque matin</FieldLabel>
          <FieldDescription>Un e-mail par jour, seulement s&apos;il y a des alertes, à l&apos;adresse de votre compte.</FieldDescription>
        </FieldContent>
      </Field>
      <SubmitButton variant="outline" className="w-fit">
        Enregistrer
      </SubmitButton>
    </ActionForm>
  );
}
