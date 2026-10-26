"use client";

import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/forms";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialFormState);

  return (
    <ActionForm action={action} pending={pending} noValidate>
      <FieldGroup>
        <FormMessage state={state} />
        <Field>
          <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required {...invalidProps(state, "email")} />
          <FieldErrors state={state} name="email" />
        </Field>
        <SubmitButton className="w-full">Envoyer le lien</SubmitButton>
      </FieldGroup>
    </ActionForm>
  );
}
