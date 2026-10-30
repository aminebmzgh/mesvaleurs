"use client";

import { CalendarPlusIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { addDays } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { postponeLcn } from "./actions";

/**
 * Report de l'échéance d'une LCN : nouvelle échéance, motif, accord du fournisseur. La
 * demande de prorogation (PDF) se prépare avec les mêmes champs, avant l'accord.
 */
export function PostponeDialog({ paymentId, label, dueDate, today }: { paymentId: string; label: string; dueDate: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [newDue, setNewDue] = useState(addDays(dueDate, 30));
  const [reason, setReason] = useState("");
  const [agreedAt, setAgreedAt] = useState(today);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <CalendarPlusIcon aria-hidden />
        Reporter
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reporter l&apos;échéance</DialogTitle>
          <DialogDescription>
            {label} — échéance actuelle le {formatDate(dueDate)}. Le report est conservé dans l&apos;historique de la LCN.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`due-${paymentId}`}>Nouvelle échéance</FieldLabel>
          <Input id={`due-${paymentId}`} type="date" value={newDue} min={addDays(dueDate, 1)} onChange={(event) => setNewDue(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`postpone-reason-${paymentId}`}>Motif</FieldLabel>
          <Textarea
            id={`postpone-reason-${paymentId}`}
            rows={2}
            value={reason}
            maxLength={300}
            placeholder="Ex. décalage de trésorerie, accord commercial…"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`agreed-${paymentId}`}>Accord du fournisseur le</FieldLabel>
          <Input id={`agreed-${paymentId}`} type="date" value={agreedAt} max={today} onChange={(event) => setAgreedAt(event.target.value)} />
          <FieldDescription>Un report d&apos;échéance suppose l&apos;accord du bénéficiaire de la LCN.</FieldDescription>
        </Field>
        <DialogFooter>
          {newDue > dueDate && (
            <a
              href={`/paiements/${paymentId}/prorogation?${new URLSearchParams({ echeance: newDue, motif: reason.trim() })}`}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "outline" })}
            >
              <FileTextIcon aria-hidden />
              Demande de prorogation (PDF)
            </a>
          )}
          <Button
            disabled={pending || !newDue || newDue <= dueDate || reason.trim().length < 3 || !agreedAt}
            onClick={() =>
              startTransition(async () => {
                const result = await postponeLcn(paymentId, newDue, reason, agreedAt);
                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success(`Échéance reportée au ${formatDate(newDue)}.`);
                  setOpen(false);
                }
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Reporter l&apos;échéance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
