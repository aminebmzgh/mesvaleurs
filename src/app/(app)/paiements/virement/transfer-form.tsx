"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fromCents, parseAmount, toCents } from "@/lib/amount";
import { formatAmount, formatDate, formatMAD } from "@/lib/format";
import type { OpenInvoice, ReplacedPayment, TransferFormData } from "@/lib/payments/queries";
import { loadOpenInvoices } from "../nouveau/actions";
import { recordTransfer } from "./actions";

const SELECT_CLASS = "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

export function TransferForm({ data, today, replacing }: { data: TransferFormData; today: string; replacing: ReplacedPayment | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [amountText, setAmountText] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [transferDate, setTransferDate] = useState(today);
  const [reference, setReference] = useState("");
  const [debited, setDebited] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string>();

  const selectSupplier = (id: string, preselected?: string[]) => {
    setSupplierId(id);
    setInvoices([]);
    setSelectedIds([]);
    setAmountTouched(false);
    if (!id) {
      return;
    }
    setLoadingInvoices(true);
    loadOpenInvoices(id).then((result) => {
      setLoadingInvoices(false);
      if (result.ok) {
        setInvoices(result.data);
        // Remplacement : les factures réglées par le paiement rejeté ; sinon toutes
        const ids = result.data.map((invoice) => invoice.id);
        setSelectedIds(preselected?.length ? ids.filter((invoiceId) => preselected.includes(invoiceId)) : ids);
      } else {
        toast.error(result.error);
      }
    });
  };

  // Remplacement d'un paiement rejeté : fournisseur et factures pré-sélectionnés, une fois
  const prefilled = useRef(false);
  useEffect(() => {
    if (replacing && !prefilled.current) {
      prefilled.current = true;
      selectSupplier(replacing.supplierId, replacing.invoiceIds);
    }
  });

  const selectedInvoices = invoices.filter((invoice) => selectedIds.includes(invoice.id));
  const dueCents = selectedInvoices.reduce((sum, invoice) => sum + toCents(invoice.amountInclTax) - toCents(invoice.amountPaid), 0);
  // Montant par défaut : reste dû des factures cochées
  const effectiveAmountText = amountTouched ? amountText : dueCents > 0 ? formatAmount(fromCents(dueCents)) : "";
  const parsedAmount = parseAmount(effectiveAmountText);
  const amountCents = parsedAmount !== null ? toCents(parsedAmount) : 0;

  const errors: string[] = [];
  if (!accountId) errors.push("Choisissez le compte débité.");
  if (!supplierId) errors.push("Choisissez le fournisseur.");
  if (amountCents <= 0) errors.push("Saisissez le montant du virement.");
  if (!reference.trim()) errors.push("Indiquez la référence du virement.");
  if (debited && transferDate > today) errors.push("Un virement débité ne peut pas être daté dans le futur.");
  const overpay = selectedInvoices.length > 0 && amountCents > dueCents;

  const submit = () => {
    if (errors.length > 0) {
      return;
    }
    setSubmitError(undefined);
    startTransition(async () => {
      const result = await recordTransfer({
        bankAccountId: accountId,
        supplierId,
        amountCents,
        transferDate,
        reference: reference.trim(),
        debited,
        invoiceIds: selectedInvoices.map((invoice) => invoice.id),
        notes,
        replacesPaymentId: replacing?.id,
      });
      if (result.ok) {
        toast.success(replacing ? `Virement enregistré : ${replacing.label} régularisé.` : "Virement enregistré.");
        if (result.data.warning) {
          toast.warning(result.data.warning);
        }
        router.push("/paiements?type=transfer&statut=all");
      } else {
        setSubmitError(result.error);
      }
    });
  };

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {replacing && (
        <Alert>
          <AlertDescription>
            Régularisation du {replacing.label.toLowerCase()} rejeté ({formatMAD(replacing.amount)}) : une fois enregistré, ce virement le remplace et
            le paiement rejeté est annulé.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Virement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="account">Compte débité</FieldLabel>
            <select id="account" className={SELECT_CLASS} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {data.accounts.length === 0 && <option value="">Aucun compte en service</option>}
              {data.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                  {account.bankName ? ` · ${account.bankName}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="supplier">Fournisseur</FieldLabel>
            <select
              id="supplier"
              className={SELECT_CLASS}
              value={supplierId}
              disabled={replacing !== null}
              onChange={(event) => selectSupplier(event.target.value)}
            >
              <option value="">Choisir un fournisseur…</option>
              {data.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="reference">Référence du virement</FieldLabel>
            <Input id="reference" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={100} placeholder="Ex. VIR-2026-118" />
          </Field>
          <Field>
            <FieldLabel htmlFor="transfer-date">Date du virement</FieldLabel>
            <Input id="transfer-date" type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value || today)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="amount">Montant (DH)</FieldLabel>
            <Input
              id="amount"
              inputMode="decimal"
              className="tabular-nums"
              value={effectiveAmountText}
              onChange={(event) => {
                setAmountTouched(true);
                setAmountText(event.target.value);
              }}
            />
            {selectedInvoices.length > 0 && <FieldDescription>Reste dû des factures cochées : {formatMAD(fromCents(dueCents))}</FieldDescription>}
          </Field>
          <Field>
            <FieldLabel>Statut</FieldLabel>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={debited} onChange={(event) => setDebited(event.target.checked)} />
              Déjà débité du compte à cette date
            </label>
            <FieldDescription>Sinon, le virement reste en attente et sera rapproché avec le relevé.</FieldDescription>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea id="notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Factures réglées</CardTitle>
          <CardDescription>Le virement solde les factures cochées, les plus anciennes d&apos;abord.</CardDescription>
        </CardHeader>
        <CardContent>
          {!supplierId ? (
            <p className="text-sm text-muted-foreground">Choisissez d&apos;abord un fournisseur.</p>
          ) : loadingInvoices ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden /> Chargement des factures…
            </p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune facture à payer pour ce fournisseur.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <span className="sr-only">Sélection</span>
                    </TableHead>
                    <TableHead>Facture</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-end">TTC</TableHead>
                    <TableHead className="text-end">Reste dû</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const checked = selectedIds.includes(invoice.id);
                    return (
                      <TableRow key={invoice.id} data-state={checked ? "selected" : undefined}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            aria-label={`Régler la facture ${invoice.number}`}
                            checked={checked}
                            onChange={() =>
                              setSelectedIds((current) =>
                                checked
                                  ? current.filter((id) => id !== invoice.id)
                                  : invoices.filter((i) => i.id === invoice.id || current.includes(i.id)).map((i) => i.id),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">{invoice.number}</TableCell>
                        <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatMAD(invoice.amountInclTax)}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatMAD(invoice.amountInclTax - invoice.amountPaid)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {overpay && (
        <Alert>
          <AlertDescription>Le montant dépasse le reste dû des factures cochées : l&apos;excédent est affecté à la dernière facture.</AlertDescription>
        </Alert>
      )}
      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col items-end gap-2">
        {errors.length > 0 && supplierId && <p className="text-sm text-muted-foreground">{errors[0]}</p>}
        <Button onClick={submit} disabled={pending || errors.length > 0}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          Enregistrer le virement
        </Button>
      </div>
    </div>
  );
}
