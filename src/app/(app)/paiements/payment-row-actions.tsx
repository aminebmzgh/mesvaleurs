"use client";

import { BanIcon, CircleCheckIcon, HandshakeIcon, Loader2Icon, type LucideIcon } from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentStatus, PaymentType } from "@/lib/labels";
import { type ActionResult, cancelPayment, markDelivered, markTransferDebited } from "./actions";

/**
 * Actions sur un paiement : remise au fournisseur (chèque, LCN), débit d'un virement
 * en attente, annulation avec motif.
 */
export function PaymentRowActions({
  paymentId,
  label,
  type,
  status,
  today,
}: {
  paymentId: string;
  label: string;
  type: PaymentType;
  status: PaymentStatus;
  today: string;
}) {
  const canDeliver = status === "issued" && type !== "transfer";
  const canDebit = status === "issued" && type === "transfer";
  const canCancel = ["issued", "delivered", "rejected", "lost", "stopped"].includes(status);
  if (!canDeliver && !canDebit && !canCancel) {
    return null;
  }
  return (
    <div className="flex justify-end gap-1">
      {canDeliver && (
        <DateDialog
          paymentId={paymentId}
          today={today}
          icon={HandshakeIcon}
          trigger="Remis"
          title="Remise au fournisseur"
          description={`${label} — la date de remise peut servir de date de paiement (loi 69-21).`}
          fieldLabel="Remis le"
          submitLabel="Enregistrer la remise"
          success="Remise enregistrée."
          action={markDelivered}
        />
      )}
      {canDebit && (
        <DateDialog
          paymentId={paymentId}
          today={today}
          icon={CircleCheckIcon}
          trigger="Débité"
          title="Virement débité"
          description={`${label} — date à laquelle le compte a été débité.`}
          fieldLabel="Débité le"
          submitLabel="Enregistrer le débit"
          success="Débit enregistré."
          action={markTransferDebited}
        />
      )}
      {canCancel && <CancelDialog paymentId={paymentId} label={label} />}
    </div>
  );
}

/** Action datée sur un paiement (remise, débit). */
function DateDialog({
  paymentId,
  today,
  icon: Icon,
  trigger,
  title,
  description,
  fieldLabel,
  submitLabel,
  success,
  action,
}: {
  paymentId: string;
  today: string;
  icon: LucideIcon;
  trigger: string;
  title: string;
  description: string;
  fieldLabel: string;
  submitLabel: string;
  success: string;
  action: (paymentId: string, date: string) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [pending, startTransition] = useTransition();
  const inputId = `${trigger}-${paymentId}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Icon aria-hidden />
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={inputId}>{fieldLabel}</FieldLabel>
          <Input id={inputId} type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <DialogFooter>
          <Button
            disabled={pending || !date}
            onClick={() =>
              startTransition(async () => {
                const result = await action(paymentId, date);
                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success(success);
                  setOpen(false);
                }
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ paymentId, label }: { paymentId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <BanIcon aria-hidden />
        Annuler
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler {label}</DialogTitle>
          <DialogDescription>
            Le numéro reste dans l&apos;historique avec le motif. Les factures réglées par ce paiement redeviennent à payer.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`reason-${paymentId}`}>Motif</FieldLabel>
          <Textarea
            id={`reason-${paymentId}`}
            rows={3}
            value={reason}
            placeholder="Ex. formule gâchée à l'impression, erreur de montant…"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                const result = await cancelPayment(paymentId, reason);
                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success("Paiement annulé.");
                  setOpen(false);
                }
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Confirmer l&apos;annulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
