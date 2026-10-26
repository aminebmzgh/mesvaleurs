"use client";

import { BanIcon, HandshakeIcon, Loader2Icon } from "lucide-react";
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
import type { PaymentStatus } from "@/lib/labels";
import { cancelPayment, markDelivered } from "./actions";

/** Actions sur un chèque ou une LCN : remise au fournisseur, annulation avec motif. */
export function PaymentRowActions({
  paymentId,
  label,
  status,
  today,
}: {
  paymentId: string;
  label: string;
  status: PaymentStatus;
  today: string;
}) {
  const canDeliver = status === "issued";
  const canCancel = ["issued", "delivered", "rejected", "lost", "stopped"].includes(status);
  if (!canDeliver && !canCancel) {
    return null;
  }
  return (
    <div className="flex justify-end gap-1">
      {canDeliver && <DeliverDialog paymentId={paymentId} label={label} today={today} />}
      {canCancel && <CancelDialog paymentId={paymentId} label={label} />}
    </div>
  );
}

function DeliverDialog({ paymentId, label, today }: { paymentId: string; label: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <HandshakeIcon aria-hidden />
        Remis
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remise au fournisseur</DialogTitle>
          <DialogDescription>{label} — la date de remise peut servir de date de paiement (loi 69-21).</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`delivered-${paymentId}`}>Remis le</FieldLabel>
          <Input id={`delivered-${paymentId}`} type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <DialogFooter>
          <Button
            disabled={pending || !date}
            onClick={() =>
              startTransition(async () => {
                const result = await markDelivered(paymentId, date);
                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success("Remise enregistrée.");
                  setOpen(false);
                }
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Enregistrer la remise
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
