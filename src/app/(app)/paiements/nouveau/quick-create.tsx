"use client";

import { Loader2Icon, PlusIcon, UserPlusIcon } from "lucide-react";
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
import type { OpenInvoice } from "@/lib/payments/queries";
import { quickCreateInvoice, quickCreateSupplier } from "./actions";

type CreatedSupplier = { id: string; name: string; payeeName: string; printCoverLetter: boolean };

/** Création d'un fournisseur sans quitter l'assistant. */
export function QuickSupplierDialog({ onCreated }: { onCreated: (supplier: CreatedSupplier) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [ice, setIce] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await quickCreateSupplier({ name, payee_name: payeeName, ice });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Fournisseur créé.");
      onCreated(result.data);
      setOpen(false);
      setName("");
      setPayeeName("");
      setIce("");
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" aria-label="Nouveau fournisseur" />}>
        <UserPlusIcon aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau fournisseur</DialogTitle>
          <DialogDescription>Les autres informations pourront être complétées depuis sa fiche.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="quick-name">Raison sociale</FieldLabel>
            <Input id="quick-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>
          <Field>
            <FieldLabel htmlFor="quick-payee">Nom imprimé sur les chèques</FieldLabel>
            <Input id="quick-payee" value={payeeName} onChange={(event) => setPayeeName(event.target.value)} placeholder="Par défaut : la raison sociale" />
          </Field>
          <Field>
            <FieldLabel htmlFor="quick-ice">ICE</FieldLabel>
            <Input id="quick-ice" value={ice} onChange={(event) => setIce(event.target.value)} inputMode="numeric" />
          </Field>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" onClick={submit} disabled={pending || !name.trim()}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Saisie rapide d'une facture du fournisseur choisi. */
export function QuickInvoiceForm({
  supplierId,
  today,
  onCreated,
}: {
  supplierId: string;
  today: string;
  onCreated: (invoice: OpenInvoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant="link" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden />
        Saisir une nouvelle facture
      </Button>
    );
  }

  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await quickCreateInvoice({
        supplier_id: supplierId,
        number,
        issue_date: issueDate,
        amount_incl_tax: amount,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Facture ${result.data.number} enregistrée.`);
      onCreated(result.data);
      setOpen(false);
      setNumber("");
      setAmount("");
    });

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
        <Field>
          <FieldLabel htmlFor="quick-invoice-number">Numéro de facture</FieldLabel>
          <Input id="quick-invoice-number" value={number} onChange={(event) => setNumber(event.target.value)} autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="quick-invoice-date">Date</FieldLabel>
          <Input id="quick-invoice-date" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="quick-invoice-amount">Montant TTC (DH)</FieldLabel>
          <Input id="quick-invoice-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button type="button" onClick={submit} disabled={pending || !number.trim() || !amount.trim()}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Ajouter
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
