"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setCheckbookTemplate } from "../modeles/actions";

/** Modèle d'impression d'un carnet ; vide = modèle par défaut de la banque. */
export function CheckbookTemplateSelect({
  checkbookId,
  value,
  options,
  defaultLabel,
}: {
  checkbookId: string;
  value: string | null;
  options: { value: string; label: string }[];
  defaultLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Modèle d'impression du carnet"
      className="h-7 max-w-52 rounded-lg border border-input bg-transparent px-2 text-xs dark:bg-input/30"
      value={value ?? ""}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value || null;
        startTransition(async () => {
          const result = await setCheckbookTemplate(checkbookId, next);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Modèle d'impression associé.");
          }
        });
      }}
    >
      <option value="">{defaultLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
