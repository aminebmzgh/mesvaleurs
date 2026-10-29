"use client";

import { FileTextIcon } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TemplateOption } from "@/lib/letters/templates";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

/** Choix du modèle (et d'une date facultative), puis ouverture du courrier PDF. */
export function LetterDialog({
  trigger,
  title,
  description,
  href,
  templates,
  date,
}: {
  trigger: string;
  title: string;
  description: string;
  /** Route du PDF, sans paramètres. */
  href: string;
  templates: TemplateOption[];
  date?: { param: string; label: string; defaultValue: string; max?: string };
}) {
  // Par défaut, le premier modèle de l'entreprise remplace le modèle intégré
  const [template, setTemplate] = useState(templates.find((t) => t.custom)?.key ?? templates[0]?.key ?? "");
  const [value, setValue] = useState(date?.defaultValue ?? "");
  const query = new URLSearchParams({ ...(template ? { modele: template } : {}), ...(date && value ? { [date.param]: value } : {}) });
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={buttonVariants({ variant: "outline" })} />}>
        <FileTextIcon aria-hidden />
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {templates.length > 1 && (
          <Field>
            <FieldLabel htmlFor={`template-${href}`}>Modèle</FieldLabel>
            <select id={`template-${href}`} className={SELECT_CLASS} value={template} onChange={(event) => setTemplate(event.target.value)}>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                  {t.custom ? "" : " (intégré)"}
                </option>
              ))}
            </select>
          </Field>
        )}
        {date && (
          <Field>
            <FieldLabel htmlFor={`date-${href}`}>{date.label}</FieldLabel>
            <Input id={`date-${href}`} type="date" value={value} max={date.max} onChange={(event) => setValue(event.target.value)} />
          </Field>
        )}
        <DialogFooter>
          <a
            href={`${href}?${query}`}
            target="_blank"
            rel="noopener"
            aria-disabled={date && !value ? true : undefined}
            className={buttonVariants({ className: date && !value ? "pointer-events-none opacity-50" : undefined })}
          >
            <FileTextIcon aria-hidden />
            Ouvrir le PDF
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
