"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";
import type { AppRole } from "@/types/app";

/** Liste déroulante des rôles, utilisable dans un formulaire (champ `name`) ou contrôlée. */
export function RoleSelect({
  id,
  name,
  defaultValue,
  value,
  onValueChange,
  disabled,
  size,
}: {
  id?: string;
  name?: string;
  defaultValue?: AppRole;
  value?: AppRole;
  onValueChange?: (role: AppRole) => void;
  disabled?: boolean;
  size?: "sm" | "default";
}) {
  return (
    <Select
      name={name}
      items={ROLE_LABELS}
      defaultValue={defaultValue}
      value={value}
      onValueChange={(next) => next && onValueChange?.(next as AppRole)}
      disabled={disabled}
    >
      <SelectTrigger id={id} size={size} className="w-full" aria-label="Rôle">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
