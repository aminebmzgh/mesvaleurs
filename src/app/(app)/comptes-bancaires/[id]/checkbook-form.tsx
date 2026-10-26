"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { FormSelect } from "@/components/form-select";
import { Field, FieldDescription, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { INSTRUMENT_LABELS } from "@/lib/checkbooks";
import { initialFormState } from "@/lib/forms";
import { createCheckbook } from "../actions";

const TYPE_OPTIONS = Object.entries(INSTRUMENT_LABELS).map(([value, label]) => ({ value, label }));

export function CheckbookForm({ accountId }: { accountId: string }) {
  const [state, action] = useActionState(createCheckbook.bind(null, accountId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  // Formulaire vidé après un enregistrement réussi
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} noValidate className="rounded-lg border p-4">
      <FieldSet>
        <FieldLegend>Ajouter un carnet</FieldLegend>
        <FormMessage state={state} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[12rem_1fr_1fr_11rem_auto] lg:items-start">
          <Field>
            <FieldLabel htmlFor="type">Type</FieldLabel>
            <FormSelect id="type" name="type" options={TYPE_OPTIONS} defaultValue="check" />
            <FieldErrors state={state} name="type" />
          </Field>
          <Field>
            <FieldLabel htmlFor="first_number">Premier numéro</FieldLabel>
            <Input
              id="first_number"
              name="first_number"
              inputMode="numeric"
              placeholder="0001000"
              className="font-mono"
              {...invalidProps(state, "first_number")}
            />
            <FieldDescription>Saisissez les zéros initiaux tels qu&apos;imprimés.</FieldDescription>
            <FieldErrors state={state} name="first_number" />
          </Field>
          <Field>
            <FieldLabel htmlFor="last_number">Dernier numéro</FieldLabel>
            <Input
              id="last_number"
              name="last_number"
              inputMode="numeric"
              placeholder="0001049"
              className="font-mono"
              {...invalidProps(state, "last_number")}
            />
            <FieldErrors state={state} name="last_number" />
          </Field>
          <Field>
            <FieldLabel htmlFor="received_at">Reçu le</FieldLabel>
            <Input id="received_at" name="received_at" type="date" {...invalidProps(state, "received_at")} />
            <FieldErrors state={state} name="received_at" />
          </Field>
          <SubmitButton className="lg:mt-6">Ajouter</SubmitButton>
        </div>
      </FieldSet>
    </form>
  );
}
