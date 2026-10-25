"use client";

import { useActionState } from "react";
import { FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/forms";
import { updatePassword } from "../actions";

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initialFormState);

  return (
    <form action={action} noValidate>
      <FieldGroup>
        <FormMessage state={state} />
        <Field>
          <FieldLabel htmlFor="password">Nouveau mot de passe</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            {...invalidProps(state, "password")}
          />
          <FieldDescription>Au moins 8 caractères, avec des lettres et des chiffres.</FieldDescription>
          <FieldErrors state={state} name="password" />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmation">Confirmation</FieldLabel>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            {...invalidProps(state, "confirmation")}
          />
          <FieldErrors state={state} name="confirmation" />
        </Field>
        <SubmitButton className="w-full">Enregistrer</SubmitButton>
      </FieldGroup>
    </form>
  );
}
