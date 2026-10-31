"use client";

import { CircleXIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
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
import { upperFirst } from "@/lib/format";
import {
  LEGAL_DISCLAIMER,
  REGULARIZATION_METHOD_LABELS,
  REJECTION_KIND_LABELS,
  type RegularizationMethod,
  type RejectionKind,
} from "@/lib/labels";
import { regularizePayment, rejectPayment } from "./actions";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

/** Déclaration d'un rejet (impayé) : motif, date, ouverture du délai de régularisation. */
export function RejectDialog({
  paymentId,
  label,
  isCheck,
  today,
  triggerLabel = "Rejeté",
}: {
  paymentId: string;
  label: string;
  isCheck: boolean;
  today: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RejectionKind>("insufficient_funds");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <CircleXIcon aria-hidden />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rejet {label.startsWith("LCN") ? "de la" : "du"} {label}</DialogTitle>
          <DialogDescription>
            {isCheck
              ? "Le délai légal de régularisation (un mois par défaut, loi 71-24) démarre à la date du rejet. "
              : "Une LCN impayée reste à régulariser auprès du fournisseur. "}
            Les factures réglées par ce paiement redeviennent à payer.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`kind-${paymentId}`}>Motif</FieldLabel>
          <select id={`kind-${paymentId}`} className={SELECT_CLASS} value={kind} onChange={(event) => setKind(event.target.value as RejectionKind)}>
            {(Object.entries(REJECTION_KIND_LABELS) as [RejectionKind, string][]).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`rejected-${paymentId}`}>Rejeté le</FieldLabel>
          <Input id={`rejected-${paymentId}`} type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`rejection-${paymentId}`}>Précisions</FieldLabel>
          <Textarea id={`rejection-${paymentId}`} rows={2} value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
          {isCheck && <FieldDescription>{LEGAL_DISCLAIMER}</FieldDescription>}
        </Field>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={pending || !date}
            onClick={() =>
              startTransition(async () => {
                const result = await rejectPayment(paymentId, kind, reason, date);
                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success("Rejet enregistré : régularisation à suivre.");
                  setOpen(false);
                }
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Enregistrer le rejet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Régularisation d'un rejet : nouvelle provision (le chèque est représenté), chèque
 * ou LCN de remplacement et virement (saisis dans leur écran), ou autre moyen noté.
 */
export function RegularizeDialog({ paymentId, label, today }: { paymentId: string; label: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<RegularizationMethod>("new_provision");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const direct = method === "new_provision" || method === "other";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <RotateCcwIcon aria-hidden />
        Régulariser
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Régulariser le rejet</DialogTitle>
          <DialogDescription>{upperFirst(label)}</DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Moyen de régularisation</legend>
          {(Object.entries(REGULARIZATION_METHOD_LABELS) as [RegularizationMethod, string][]).map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="radio" name={`method-${paymentId}`} className="size-4 accent-primary" checked={method === value} onChange={() => setMethod(value)} />
              {text}
            </label>
          ))}
        </fieldset>
        {direct ? (
          <>
            <Field>
              <FieldLabel htmlFor={`regularized-${paymentId}`}>Régularisé le</FieldLabel>
              <Input id={`regularized-${paymentId}`} type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
              {method === "new_provision" && (
                <FieldDescription>Le compte est approvisionné : le paiement revient en circulation pour être représenté.</FieldDescription>
              )}
            </Field>
            {method === "other" && (
              <Field>
                <FieldLabel htmlFor={`notes-${paymentId}`}>Moyen utilisé</FieldLabel>
                <Textarea id={`notes-${paymentId}`} rows={2} value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} />
              </Field>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {method === "transfer"
              ? "Saisissez le virement : il règle les mêmes factures et le paiement rejeté est annulé."
              : "Émettez le paiement de remplacement : il règle les mêmes factures et le paiement rejeté est annulé."}
          </p>
        )}
        <DialogFooter>
          {direct ? (
            <Button
              disabled={pending || !date || (method === "other" && notes.trim().length < 3)}
              onClick={() =>
                startTransition(async () => {
                  const result = await regularizePayment(paymentId, method as "new_provision" | "other", date, notes);
                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    toast.success("Régularisation enregistrée.");
                    setOpen(false);
                  }
                })
              }
            >
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              Enregistrer la régularisation
            </Button>
          ) : (
            <Link
              href={`${method === "transfer" ? "/paiements/virement" : "/paiements/nouveau"}?remplace=${paymentId}`}
              className={buttonVariants()}
            >
              {method === "transfer" ? "Saisir le virement" : "Émettre le remplaçant"}
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
