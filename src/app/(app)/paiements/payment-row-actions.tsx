"use client";

import { BanIcon, CircleCheckIcon, FileTextIcon, HandshakeIcon, Loader2Icon, type LucideIcon, PenLineIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { upperFirst } from "@/lib/format";
import type { PaymentStatus, PaymentType } from "@/lib/labels";
import {
  type ActionResult,
  cancelPayment,
  markDebited,
  markDelivered,
  markGuaranteeDestroyed,
  markGuaranteeReturned,
} from "./actions";
import { StopPaymentDialog } from "./opposition-dialogs";
import { PostponeDialog } from "./postpone-dialog";
import { RegularizeDialog, RejectDialog } from "./rejection-dialogs";

/**
 * Actions sur un paiement : remise au fournisseur (chèque, LCN), débit d'un virement
 * en attente, rejet, report, opposition, annulation avec motif.
 */
export function PaymentRowActions({
  paymentId,
  label,
  type,
  status,
  regularized = false,
  dueDate = null,
  issueDate,
  stopOrderId = null,
  today,
}: {
  paymentId: string;
  label: string;
  type: PaymentType;
  status: PaymentStatus;
  /** Rejet déjà régularisé (par un autre moyen noté). */
  regularized?: boolean;
  /** Échéance actuelle (LCN). */
  dueDate?: string | null;
  issueDate?: string;
  /** Opposition enregistrée (paiement en opposition) : lien vers la lettre à la banque. */
  stopOrderId?: string | null;
  today: string;
}) {
  const canDeliver = status === "issued" && type !== "transfer";
  const guaranteeOut = type === "guarantee_check" && (status === "issued" || status === "delivered");
  const canDebit = (status === "issued" && type === "transfer") || guaranteeOut;
  const canReject = (type === "check" || type === "lcn") && ["issued", "delivered", "paid"].includes(status);
  const canRegularize = status === "rejected" && !regularized;
  const canPostpone = type === "lcn" && (status === "issued" || status === "delivered") && dueDate !== null;
  const canStop = type !== "transfer" && (status === "issued" || status === "delivered");
  const stopLetter = status === "stopped" && stopOrderId ? `/paiements/oppositions/${stopOrderId}/lettre` : null;
  // Un chèque de garantie se clôt par restitution ou destruction, pas par annulation
  const canCancel = type !== "guarantee_check" && ["issued", "delivered", "rejected", "lost", "stopped"].includes(status);
  if (!canDeliver && !canDebit && !canReject && !canRegularize && !canPostpone && !canStop && !stopLetter && !canCancel) {
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
          description={`${upperFirst(label)} — la date de remise peut servir de date de paiement (loi 69-21).`}
          fieldLabel="Remis le"
          submitLabel="Enregistrer la remise"
          success="Remise enregistrée."
          action={markDelivered}
        />
      )}
      {canDeliver && (
        // Remise signée à l'écran par le fournisseur ou son livreur (accusé de réception)
        <Link href={`/paiements/remise?paiement=${paymentId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <PenLineIcon aria-hidden />
          Faire signer
        </Link>
      )}
      {canDebit && (
        <DateDialog
          paymentId={paymentId}
          today={today}
          icon={CircleCheckIcon}
          trigger={type === "guarantee_check" ? "Encaissé" : "Débité"}
          title={type === "guarantee_check" ? "Chèque de garantie encaissé" : "Virement débité"}
          description={`${upperFirst(label)} — date à laquelle le compte a été débité.`}
          fieldLabel="Débité le"
          submitLabel="Enregistrer le débit"
          success="Débit enregistré."
          action={markDebited}
        />
      )}
      {guaranteeOut && (
        <>
          <DateDialog
            paymentId={paymentId}
            today={today}
            icon={ShieldCheckIcon}
            trigger="Restitué"
            title="Chèque de garantie restitué"
            description={`${upperFirst(label)} — rendu par le fournisseur : il sort du risque d'encaissement.`}
            fieldLabel="Restitué le"
            submitLabel="Enregistrer la restitution"
            success="Restitution enregistrée."
            action={markGuaranteeReturned}
          />
          <DateDialog
            paymentId={paymentId}
            today={today}
            icon={Trash2Icon}
            trigger="Détruit"
            title="Chèque de garantie détruit"
            description={`${upperFirst(label)} — détruit (par le fournisseur ou en votre présence).`}
            fieldLabel="Détruit le"
            submitLabel="Enregistrer la destruction"
            success="Destruction enregistrée."
            action={markGuaranteeDestroyed}
          />
        </>
      )}
      {canRegularize && <RegularizeDialog paymentId={paymentId} label={label} today={today} />}
      {canPostpone && dueDate && <PostponeDialog paymentId={paymentId} label={label} dueDate={dueDate} today={today} />}
      {stopLetter && (
        <a href={stopLetter} target="_blank" rel="noopener" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <FileTextIcon aria-hidden />
          Lettre d&apos;opposition
        </a>
      )}
      {canStop && <StopPaymentDialog paymentId={paymentId} label={label} isLcn={type === "lcn"} issueDate={issueDate} today={today} />}
      {canReject && <RejectDialog paymentId={paymentId} label={label} isCheck={type === "check"} today={today} />}
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
