"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatAmount, formatMAD } from "@/lib/format";
/**
 * Plafond journalier (double signature) d'un membre ou d'un fournisseur : au-delà, les lots
 * passent en validation. `action` : Server Action liée à l'objet, montant saisi (vide = aucun).
 */
export function CeilingDialog({
  id,
  name,
  ceiling,
  description,
  action,
}: {
  id: string;
  name: string;
  ceiling: number | null;
  description: string;
  action: (amount: string) => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(ceiling != null ? formatAmount(ceiling) : "");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Plafond journalier de ${name}`} />}>
        {ceiling != null ? formatMAD(ceiling) : "Aucun"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plafond journalier de {name}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`ceiling-${id}`}>Plafond (DH)</FieldLabel>
          <Input id={`ceiling-${id}`} inputMode="decimal" value={value} placeholder="Aucun" onChange={(event) => setValue(event.target.value)} />
          <FieldDescription>Laissez vide pour ne fixer aucun plafond.</FieldDescription>
        </Field>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action(value);
                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success("Plafond enregistré.");
                  setOpen(false);
                }
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
