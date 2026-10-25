"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/forms";
import { sendMagicLink, signIn } from "../actions";

const LINK_ERRORS: Record<string, string> = {
  "lien-invalide": "Ce lien est invalide.",
  "lien-expire": "Ce lien a expiré ou a déjà été utilisé. Connectez-vous ou demandez-en un nouveau.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const linkError = LINK_ERRORS[searchParams.get("erreur") ?? ""];
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [passwordState, passwordAction] = useActionState(signIn, { error: linkError });
  const [magicState, magicAction] = useActionState(sendMagicLink, initialFormState);

  if (mode === "magic-link") {
    return (
      <form action={magicAction} noValidate>
        <FieldGroup>
          <FormMessage state={magicState} />
          <Field>
            <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" required {...invalidProps(magicState, "email")} />
            <FieldErrors state={magicState} name="email" />
          </Field>
          <SubmitButton className="w-full">Recevoir un lien de connexion</SubmitButton>
          <Button type="button" variant="link" onClick={() => setMode("password")}>
            Se connecter avec un mot de passe
          </Button>
        </FieldGroup>
      </form>
    );
  }

  return (
    <form action={passwordAction} noValidate>
      <input type="hidden" name="suivant" value={searchParams.get("suivant") ?? ""} />
      <FieldGroup>
        <FormMessage state={passwordState} />
        <Field>
          <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required {...invalidProps(passwordState, "email")} />
          <FieldErrors state={passwordState} name="email" />
        </Field>
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <Link href="/mot-de-passe-oublie" className="text-sm text-muted-foreground hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            {...invalidProps(passwordState, "password")}
          />
          <FieldErrors state={passwordState} name="password" />
        </Field>
        <SubmitButton className="w-full">Se connecter</SubmitButton>
        <Button type="button" variant="link" onClick={() => setMode("magic-link")}>
          Recevoir un lien de connexion par e-mail
        </Button>
      </FieldGroup>
    </form>
  );
}
