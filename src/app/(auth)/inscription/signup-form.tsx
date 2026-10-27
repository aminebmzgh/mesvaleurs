"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/forms";
import { signUp } from "../actions";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, initialFormState);

  if (state.success) {
    return <FormMessage state={state} />;
  }

  return (
    <ActionForm action={action} pending={pending} noValidate>
      <FieldGroup>
        <FormMessage state={state} />
        <Field>
          <FieldLabel htmlFor="fullName">Nom complet</FieldLabel>
          <Input id="fullName" name="fullName" autoComplete="name" required {...invalidProps(state, "fullName")} />
          <FieldErrors state={state} name="fullName" />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Adresse e-mail professionnelle</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required {...invalidProps(state, "email")} />
          <FieldErrors state={state} name="email" />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
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
        <Field orientation="horizontal">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            {...invalidProps(state, "consent")}
          />
          <FieldLabel htmlFor="consent" className="font-normal">
            J&apos;accepte la{" "}
            <Link href="/confidentialite" className="underline" target="_blank">
              politique de confidentialité
            </Link>{" "}
            et le traitement de mes données conformément à la loi 09-08.
          </FieldLabel>
        </Field>
        <FieldErrors state={state} name="consent" />
        <SubmitButton className="w-full">Créer mon compte</SubmitButton>
      </FieldGroup>
    </ActionForm>
  );
}
