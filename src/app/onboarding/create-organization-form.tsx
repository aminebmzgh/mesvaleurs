"use client";

import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/forms";
import { createOrganization } from "@/lib/organizations/actions";

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganization, initialFormState);

  return (
    <ActionForm action={action} pending={pending} noValidate>
      <FieldGroup>
        <FormMessage state={state} />
        <Field>
          <FieldLabel htmlFor="name">Raison sociale</FieldLabel>
          <Input id="name" name="name" placeholder="Ex. Atlas Distribution SARL" required {...invalidProps(state, "name")} />
          <FieldErrors state={state} name="name" />
        </Field>
        <Field>
          <FieldLabel htmlFor="city">Ville</FieldLabel>
          <Input id="city" name="city" placeholder="Ex. Casablanca" {...invalidProps(state, "city")} />
          <FieldDescription>Lieu d&apos;émission imprimé par défaut sur les chèques et LCN.</FieldDescription>
          <FieldErrors state={state} name="city" />
        </Field>
        <SubmitButton className="w-full">Créer l&apos;entreprise</SubmitButton>
      </FieldGroup>
    </ActionForm>
  );
}
