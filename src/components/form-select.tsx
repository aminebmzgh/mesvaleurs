"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

/** Liste déroulante soumise avec le formulaire (champ caché `name`). */
export function FormSelect({
  id,
  name,
  options,
  defaultValue,
  placeholder = "Choisir…",
  disabled,
  invalid,
}: {
  id?: string;
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <Select name={name} items={options} defaultValue={defaultValue ?? null} disabled={disabled}>
      <SelectTrigger
        id={id}
        className="w-full"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : undefined}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
