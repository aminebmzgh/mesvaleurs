"use client";

import { CircleAlertIcon, CircleCheckIcon, Loader2Icon } from "lucide-react";
import { type ComponentProps, createContext, startTransition, use } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

const PendingContext = createContext(false);

/**
 * Formulaire relié à une Server Action (via useActionState) qui ne se vide pas
 * après l'envoi : par défaut, React 19 réinitialise un <form action={…}>, ce qui
 * effacerait la saisie quand la validation échoue.
 */
export function ActionForm({
  action,
  pending,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <PendingContext value={pending}>
      <form
        {...props}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => action(formData));
        }}
      />
    </PendingContext>
  );
}

/** Bouton d'envoi qui se désactive pendant le traitement du formulaire. */
export function SubmitButton({ children, ...props }: ComponentProps<typeof Button>) {
  const { pending: formPending } = useFormStatus();
  const pending = use(PendingContext) || formPending;
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/** Message global d'erreur ou de succès d'un formulaire. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.success) {
    return (
      <Alert>
        <CircleCheckIcon aria-hidden />
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

/** Erreurs de validation d'un champ. */
export function FieldErrors({ state, name }: { state: FormState; name: string }) {
  const messages = state.fieldErrors?.[name];
  if (!messages?.length) {
    return null;
  }
  return <FieldError id={`${name}-error`} errors={messages.map((message) => ({ message }))} />;
}

/** Attributs d'accessibilité d'un champ en erreur. */
export function invalidProps(state: FormState, name: string) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return invalid ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {};
}
