"use client";

import { CircleAlertIcon, Loader2Icon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { InstrumentPreview } from "@/components/instrument-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fromCents, parseAmount, toCents } from "@/lib/amount";
import { amountInWords } from "@/lib/amount-in-words";
import { availableCount, availableNumbers, formatInstrumentNumber } from "@/lib/checkbooks";
import { daysBetween } from "@/lib/dates";
import { formatAmount, formatDate, formatMAD } from "@/lib/format";
import type { AssistantData, OpenInvoice, ReplacedPayment } from "@/lib/payments/queries";
import { checkCustomSplit, MAX_INSTRUMENTS, scheduleDueDates, splitEqual } from "@/lib/payments/split";
import { issuePayments, loadOpenInvoices } from "./actions";
import { QuickInvoiceForm, QuickSupplierDialog } from "./quick-create";

type InstrumentType = "check" | "lcn";
type SplitMode = "equal" | "custom";

/** Paiement proposé par l'optimiseur : fournisseur, factures, moyen et échéance de la LCN. */
export type PaymentPrefill = { supplierId: string; invoiceIds: string[]; type: InstrumentType; dueDate: string | null };

const TYPE_LABELS: Record<InstrumentType, { one: string; many: string }> = {
  check: { one: "chèque", many: "chèques" },
  lcn: { one: "LCN", many: "LCN" },
};

export function PaymentAssistant({
  data,
  today,
  replacing = null,
  prefill = null,
}: {
  data: AssistantData;
  today: string;
  /** Paiement rejeté que cette émission régularise. */
  replacing?: ReplacedPayment | null;
  prefill?: PaymentPrefill | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 1. Moyen de paiement
  const availableTypes = (["check", "lcn"] as const).filter((t) => data.checkbooks.some((c) => c.type === t));
  // Plan de l'optimiseur : moyen de paiement proposé, s'il existe un carnet de ce type
  const prefillType = prefill && availableTypes.includes(prefill.type) ? prefill.type : null;
  const prefillDays =
    prefillType === "lcn" && prefill?.dueDate && prefill.dueDate > today ? Math.min(daysBetween(today, prefill.dueDate), 365) : null;
  const [type, setType] = useState<InstrumentType>(prefillType ?? availableTypes[0] ?? "check");
  const checkbooks = data.checkbooks.filter((c) => c.type === type);
  const [checkbookId, setCheckbookId] = useState(checkbooks[0]?.id ?? "");
  const checkbook = checkbooks.find((c) => c.id === checkbookId) ?? checkbooks[0];

  // 2. Fournisseur
  const [suppliers, setSuppliers] = useState(data.suppliers);
  const [supplierId, setSupplierId] = useState("");
  const supplier = suppliers.find((s) => s.id === supplierId);
  const [payeeName, setPayeeName] = useState("");

  // 3. Factures
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 4. Montant et répartition
  const [amountText, setAmountText] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [count, setCount] = useState(1);
  const [mode, setMode] = useState<SplitMode>("equal");
  const [customAmounts, setCustomAmounts] = useState<string[]>([""]);
  const [issueDate, setIssueDate] = useState(today);
  const [issuePlace, setIssuePlace] = useState(data.city);
  const [intervalDays, setIntervalDays] = useState(prefillDays ?? 30);
  const [dueDates, setDueDates] = useState<string[]>(() => scheduleDueDates(today, 1, prefillDays ?? 30));
  const [overpayConfirmed, setOverpayConfirmed] = useState(false);
  const [fundsConfirmed, setFundsConfirmed] = useState(false);
  // Lettre d'accompagnement : cochée selon la préférence du fournisseur
  const [coverLetter, setCoverLetter] = useState(true);
  const [submitError, setSubmitError] = useState<string>();

  const selectSupplier = (id: string, preselected?: string[]) => {
    setSupplierId(id);
    setSelectedIds([]);
    setInvoices([]);
    setAmountTouched(false);
    const next = suppliers.find((s) => s.id === id);
    setPayeeName(next?.payeeName ?? "");
    setCoverLetter(next?.printCoverLetter ?? true);
    if (!id) {
      return;
    }
    setLoadingInvoices(true);
    loadOpenInvoices(id).then((result) => {
      setLoadingInvoices(false);
      if (result.ok) {
        setInvoices(result.data);
        // Toutes les factures ouvertes cochées par défaut, les plus anciennes d'abord ;
        // en remplacement, celles que réglait le paiement rejeté
        const ids = result.data.map((invoice) => invoice.id);
        setSelectedIds(preselected?.length ? ids.filter((invoiceId) => preselected.includes(invoiceId)) : ids);
      } else {
        toast.error(result.error);
      }
    });
  };

  // Remplacement d'un paiement rejeté ou plan de l'optimiseur : fournisseur et factures pré-sélectionnés, une fois
  const prefilled = useRef(false);
  const initial = replacing ?? prefill;
  useEffect(() => {
    if (initial && !prefilled.current) {
      prefilled.current = true;
      selectSupplier(initial.supplierId, initial.invoiceIds);
    }
  });

  const selectedInvoices = invoices.filter((invoice) => selectedIds.includes(invoice.id));
  const dueCents = selectedInvoices.reduce(
    (sum, invoice) => sum + toCents(invoice.amountInclTax) - toCents(invoice.amountPaid),
    0,
  );

  // Montant par défaut : reste dû des factures cochées
  const effectiveAmountText = amountTouched ? amountText : dueCents > 0 ? formatAmount(fromCents(dueCents)) : "";
  const parsedAmount = parseAmount(effectiveAmountText);
  const totalCents = parsedAmount !== null ? toCents(parsedAmount) : 0;

  // Nombre de formules : ajuste les montants personnalisés et les échéances
  const changeCount = (value: number) => {
    const next = Math.min(Math.max(Number.isFinite(value) ? Math.trunc(value) : 1, 1), MAX_INSTRUMENTS);
    setCount(next);
    setCustomAmounts((current) => Array.from({ length: next }, (_, i) => current[i] ?? ""));
    setDueDates(scheduleDueDates(issueDate, next, intervalDays));
  };

  // Échéancier recalculé quand la date d'émission ou l'intervalle change
  const changeIssueDate = (value: string) => {
    const date = value || today;
    setIssueDate(date);
    setDueDates(scheduleDueDates(date, count, intervalDays));
  };
  const changeInterval = (value: number) => {
    const days = Math.min(Math.max(Math.trunc(value) || 0, 0), 365);
    setIntervalDays(days);
    setDueDates(scheduleDueDates(issueDate, count, days));
  };

  const parts = useMemo(() => {
    if (mode === "custom") {
      return customAmounts.map((text) => {
        const value = parseAmount(text);
        return value !== null ? toCents(value) : 0;
      });
    }
    try {
      return totalCents > 0 ? splitEqual(totalCents, count) : Array.from({ length: count }, () => 0);
    } catch {
      return Array.from({ length: count }, () => 0);
    }
  }, [mode, customAmounts, totalCents, count]);

  // Contrôles bloquants
  const errors: string[] = [];
  if (!checkbook) {
    errors.push(`Aucun ${type === "check" ? "chéquier" : "carnet de LCN"} en service : enregistrez-en un dans Comptes et chéquiers.`);
  }
  if (!supplier) {
    errors.push("Choisissez le fournisseur.");
  }
  if (!payeeName.trim()) {
    errors.push("Le bénéficiaire est obligatoire.");
  }
  if (totalCents <= 0) {
    errors.push("Saisissez le montant à régler.");
  }
  const remainingForms = checkbook ? availableCount(checkbook.nextNumber, checkbook.lastNumber, checkbook.stoppedRanges) : 0;
  // Stock restant après ce lot sur le compte (tous ses carnets du même type en service)
  const stockAfter = checkbook
    ? data.checkbooks
        .filter((b) => b.type === checkbook.type && b.bankAccountId === checkbook.bankAccountId)
        .reduce((sum, b) => sum + availableCount(b.nextNumber, b.lastNumber, b.stoppedRanges), 0) - count
    : 0;
  const lowStockAfter = checkbook !== undefined && count <= remainingForms && stockAfter <= data.lowStockThreshold;
  // Numéros attribués à l'émission : à la suite, sans les formules vierges en opposition
  const numbers = checkbook ? availableNumbers(checkbook.nextNumber, checkbook.lastNumber, checkbook.stoppedRanges, count) : [];
  if (checkbook && count > remainingForms) {
    errors.push(`Il ne reste que ${remainingForms} formule(s) dans ce carnet.`);
  }
  if (mode === "equal" && totalCents > 0 && totalCents < count) {
    errors.push("Le montant est trop faible pour autant de formules.");
  }
  if (mode === "custom" && totalCents > 0) {
    const check = checkCustomSplit(totalCents, parts);
    if (!check.ok) {
      errors.push(
        check.invalidIndexes.length > 0
          ? "Chaque formule doit avoir un montant valide et positif."
          : `La somme des formules diffère du total de ${formatMAD(fromCents(Math.abs(check.difference)))} ${check.difference > 0 ? "(reste à répartir)" : "(en trop)"}.`,
      );
    }
  }
  if (type === "lcn" && dueDates.some((date) => !date || date < issueDate)) {
    errors.push("Chaque LCN doit avoir une échéance postérieure ou égale à la date d'émission.");
  }

  // Alertes (non bloquantes, sauf dépassement à confirmer)
  const overpay = selectedInvoices.length > 0 && totalCents > dueCents;
  if (overpay && !overpayConfirmed) {
    errors.push("Le montant dépasse le reste dû : confirmez le dépassement.");
  }
  const projectedBalance = checkbook ? toCents(checkbook.availableBalance) - totalCents : 0;
  const insufficientFunds = checkbook !== undefined && totalCents > 0 && projectedBalance < 0;
  // Prévention des rejets (loi 71-24) : émission sans provision à confirmer explicitement
  if (insufficientFunds && !fundsConfirmed) {
    errors.push("Provision insuffisante : confirmez l'émission malgré le risque de rejet.");
  }

  const submit = () => {
    if (errors.length > 0 || !checkbook || !supplier) {
      return;
    }
    const label = count > 1 ? TYPE_LABELS[type].many : TYPE_LABELS[type].one;
    if (!window.confirm(`Émettre ${count} ${label} pour un total de ${formatMAD(fromCents(totalCents))} ?`)) {
      return;
    }
    setSubmitError(undefined);
    startTransition(async () => {
      const result = await issuePayments({
        checkbookId: checkbook.id,
        supplierId: supplier.id,
        payeeName: payeeName.trim(),
        issueDate,
        issuePlace: issuePlace.trim(),
        instruments: parts.map((amountCents, i) => ({ amountCents, dueDate: type === "lcn" ? dueDates[i] : null })),
        invoiceIds: selectedInvoices.map((invoice) => invoice.id),
        replacesPaymentId: replacing?.id,
      });
      if (result.ok) {
        toast.success(
          result.data.pendingApproval
            ? "Lot préparé : numéros réservés, à valider avant impression."
            : replacing
              ? `Paiements émis : ${replacing.label} régularisé.`
              : "Paiements émis : les numéros sont attribués.",
        );
        if (result.data.warning) {
          toast.warning(result.data.warning);
        }
        router.push(`/paiements/lots/${result.data.batchId}${coverLetter ? "?lettre=1" : ""}`);
      } else {
        setSubmitError(result.error);
      }
    });
  };

  const typeLabel = (n: number) => (n > 1 ? TYPE_LABELS[type].many : TYPE_LABELS[type].one);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex flex-col gap-6">
        {replacing && (
          <Alert>
            <AlertDescription>
              Remplacement du {replacing.label.toLowerCase()} rejeté ({formatMAD(replacing.amount)}) : une fois émis, le nouveau
              paiement le régularise et le paiement rejeté est annulé.
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle>1. Moyen de paiement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <div role="radiogroup" aria-label="Type de paiement" className="flex gap-2">
              {(["check", "lcn"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={type === value}
                  variant={type === value ? "default" : "outline"}
                  onClick={() => {
                    setType(value);
                    setCheckbookId(data.checkbooks.find((c) => c.type === value)?.id ?? "");
                  }}
                >
                  {value === "check" ? "Chèque" : "LCN"}
                </Button>
              ))}
            </div>
            <Field>
              <FieldLabel htmlFor="checkbook">{type === "check" ? "Chéquier" : "Carnet de LCN"}</FieldLabel>
              <select
                id="checkbook"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                value={checkbook?.id ?? ""}
                onChange={(event) => setCheckbookId(event.target.value)}
                disabled={checkbooks.length === 0}
              >
                {checkbooks.length === 0 && <option value="">Aucun carnet en service</option>}
                {checkbooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.accountLabel} · {book.bankName} · prochain n° {formatInstrumentNumber(book.nextNumber, book.numberWidth)} (
                    {availableCount(book.nextNumber, book.lastNumber, book.stoppedRanges)} restantes)
                  </option>
                ))}
              </select>
              {lowStockAfter && (
                <FieldDescription className="text-destructive">
                  Après ce lot, il restera {Math.max(stockAfter, 0)} formule(s) sur ce compte : commandez un nouveau{" "}
                  {type === "check" ? "chéquier" : "carnet de LCN"} à votre banque.
                </FieldDescription>
              )}
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Bénéficiaire</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="supplier">Fournisseur</FieldLabel>
              <div className="flex gap-2">
                <select
                  id="supplier"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                  value={supplierId}
                  disabled={replacing !== null}
                  onChange={(event) => selectSupplier(event.target.value)}
                >
                  <option value="">Choisir un fournisseur…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <QuickSupplierDialog
                  onCreated={(created) => {
                    setSuppliers((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, "fr")));
                    selectSupplier(created.id);
                    setPayeeName(created.payeeName);
                  }}
                />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="payee">Bénéficiaire imprimé</FieldLabel>
              <Input id="payee" value={payeeName} onChange={(event) => setPayeeName(event.target.value)} maxLength={200} />
              <FieldDescription>Nom exact attendu par le fournisseur sur la formule.</FieldDescription>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Factures réglées</CardTitle>
            <CardDescription>Les paiements soldent les factures cochées, les plus anciennes d&apos;abord.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!supplier ? (
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
                      <TableHead>Date limite</TableHead>
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
                          <TableCell>
                            {invoice.legalDueDate ? (
                              <span className={invoice.legalDueDate < today ? "font-medium text-destructive" : undefined}>
                                {formatDate(invoice.legalDueDate)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">{formatMAD(invoice.amountInclTax)}</TableCell>
                          <TableCell className="text-end tabular-nums">
                            {formatMAD(invoice.amountInclTax - invoice.amountPaid)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {supplier && (
              <QuickInvoiceForm
                supplierId={supplier.id}
                today={today}
                onCreated={(invoice) => {
                  setInvoices((current) =>
                    [...current, invoice].sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number)),
                  );
                  setSelectedIds((current) => [...current, invoice.id]);
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Montant et répartition</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="amount">Montant à régler (DH)</FieldLabel>
                <Input
                  id="amount"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={effectiveAmountText}
                  onChange={(event) => {
                    setAmountTouched(true);
                    setAmountText(event.target.value);
                  }}
                  aria-invalid={effectiveAmountText !== "" && parsedAmount === null ? true : undefined}
                />
                {selectedInvoices.length > 0 && (
                  <FieldDescription>Reste dû des factures cochées : {formatMAD(fromCents(dueCents))}</FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="count">Nombre de {TYPE_LABELS[type].many}</FieldLabel>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={MAX_INSTRUMENTS}
                  value={count}
                  onChange={(event) => changeCount(Number(event.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="issue-date">Date d&apos;émission</FieldLabel>
                <Input id="issue-date" type="date" value={issueDate} onChange={(event) => changeIssueDate(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="issue-place">Lieu d&apos;émission</FieldLabel>
                <Input id="issue-place" value={issuePlace} onChange={(event) => setIssuePlace(event.target.value)} maxLength={120} />
              </Field>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div role="radiogroup" aria-label="Mode de répartition" className="flex gap-2">
                {(
                  [
                    ["equal", "Parts égales"],
                    ["custom", "Montants personnalisés"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    variant={mode === value ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setMode(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {type === "lcn" && (
                <Field className="w-auto">
                  <FieldLabel htmlFor="interval">Échelonnement (jours entre échéances)</FieldLabel>
                  <Input
                    id="interval"
                    type="number"
                    min={0}
                    max={365}
                    className="w-28"
                    value={intervalDays}
                    onChange={(event) => changeInterval(Number(event.target.value))}
                  />
                </Field>
              )}
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead className="text-end">Montant (DH)</TableHead>
                    {type === "lcn" && <TableHead>Échéance</TableHead>}
                    <TableHead>En lettres</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parts.map((cents, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono tabular-nums">
                        {checkbook && numbers[i] !== undefined ? formatInstrumentNumber(numbers[i], checkbook.numberWidth) : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        {mode === "custom" ? (
                          <Input
                            aria-label={`Montant de la formule ${i + 1}`}
                            inputMode="decimal"
                            className="ms-auto w-36 text-end tabular-nums"
                            value={customAmounts[i] ?? ""}
                            onChange={(event) =>
                              setCustomAmounts((current) => current.map((value, j) => (j === i ? event.target.value : value)))
                            }
                          />
                        ) : (
                          <span className="tabular-nums">{formatAmount(fromCents(cents))}</span>
                        )}
                      </TableCell>
                      {type === "lcn" && (
                        <TableCell>
                          <Input
                            type="date"
                            aria-label={`Échéance de la LCN ${i + 1}`}
                            className="w-40"
                            value={dueDates[i] ?? ""}
                            onChange={(event) =>
                              setDueDates((current) => current.map((value, j) => (j === i ? event.target.value : value)))
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell className="min-w-64 text-xs text-muted-foreground">
                        {cents > 0 ? amountInWords(fromCents(cents), { rectified: data.amountWordsRectified }) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {overpay && (
              <Alert>
                <TriangleAlertIcon aria-hidden />
                <AlertDescription className="flex flex-col gap-2">
                  Le montant dépasse le reste dû de {formatMAD(fromCents(totalCents - dueCents))}.
                  <label className="flex items-center gap-2 text-foreground">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={overpayConfirmed}
                      onChange={(event) => setOverpayConfirmed(event.target.checked)}
                    />
                    Je confirme le dépassement (l&apos;excédent est affecté à la dernière facture).
                  </label>
                </AlertDescription>
              </Alert>
            )}
            {insufficientFunds && (
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden />
                <AlertDescription>
                  Provision insuffisante : après les paiements déjà en circulation et ce règlement, le solde prévisionnel du
                  compte serait de {formatMAD(fromCents(projectedBalance))}. Un chèque présenté sans provision est rejeté
                  (loi 71-24).
                  <label className="mt-2 flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      className="size-4 accent-destructive"
                      checked={fundsConfirmed}
                      onChange={(event) => setFundsConfirmed(event.target.checked)}
                    />
                    J&apos;émets quand même : la provision sera faite avant la présentation.
                  </label>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>5. Aperçu</CardTitle>
            <CardDescription>
              {count} {typeLabel(count)} · total {formatMAD(fromCents(totalCents))}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {parts.slice(0, 3).map((cents, i) => (
              <InstrumentPreview
                key={i}
                type={type}
                bankName={checkbook?.bankName ?? ""}
                number={numbers[i] ?? null}
                numberWidth={checkbook?.numberWidth ?? 7}
                amount={fromCents(cents)}
                payee={payeeName}
                place={issuePlace}
                issueDate={issueDate}
                dueDate={type === "lcn" ? dueDates[i] : null}
                rectified={data.amountWordsRectified}
              />
            ))}
            {parts.length > 3 && (
              <p className="text-center text-xs text-muted-foreground">+ {parts.length - 3} autre(s) formule(s)</p>
            )}

            {submitError && (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            {errors.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-muted-foreground" aria-live="polite">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={coverLetter} onChange={(event) => setCoverLetter(event.target.checked)} />
              Imprimer la lettre d&apos;accompagnement
            </label>
            <Button size="lg" onClick={submit} disabled={pending || errors.length > 0}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <PlusIcon aria-hidden />}
              Émettre {count} {typeLabel(count)}
            </Button>
            <p className="text-xs text-muted-foreground">
              Les numéros sont attribués à l&apos;émission ; l&apos;impression se fait ensuite depuis le lot.
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
