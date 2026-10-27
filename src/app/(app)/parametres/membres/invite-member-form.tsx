"use client";

import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/lib/auth/roles";
import { initialFormState } from "@/lib/forms";
import { inviteMember } from "./actions";
import { RoleSelect } from "./role-select";

export function InviteMemberForm() {
  const [state, action, pending] = useActionState(inviteMember, initialFormState);

  return (
    <ActionForm action={action} pending={pending} noValidate className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[1fr_16rem_auto] sm:items-start">
        <Field>
          <FieldLabel htmlFor="invite-email">Adresse e-mail</FieldLabel>
          <Input id="invite-email" name="email" type="email" required {...invalidProps(state, "email")} />
          <FieldErrors state={state} name="email" />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite-role">Rôle</FieldLabel>
          <RoleSelect id="invite-role" name="role" defaultValue="preparer" />
          <FieldErrors state={state} name="role" />
        </Field>
        <SubmitButton className="sm:mt-6">Inviter</SubmitButton>
      </div>
      <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {ROLES.map((role) => (
          <li key={role}>
            <span className="font-medium text-foreground">{ROLE_LABELS[role]}</span> : {ROLE_DESCRIPTIONS[role]}
          </li>
        ))}
      </ul>
    </ActionForm>
  );
}
