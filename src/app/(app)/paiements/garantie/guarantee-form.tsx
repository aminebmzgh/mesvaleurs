"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parseAmount, toCents } from "@/lib/amount";
import { formatInstrumentNumber } from "@/lib/checkbooks";
import { addDays } from "@/lib/dates";
import { formatMAD } from "@/lib/format";
import type { AssistantData } from "@/lib/payments/queries";
import { issueGuarantee } from "./actions";

const SELECT_CLASS = "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

/** Restitution prévue par défaut : trois mois après l'émission. */
const DEFAULT_RETURN_DAYS = 90;

export function GuaranteeForm({ data, today }: { data: AssistantData; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const checkbooks = data.checkbooks.filter((book) => book.type === "check");
  const [checkbookId, setCheckbookId] = useState(checkbooks[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [issuePlace, setIssuePlace] = useState(data.city);
  const [purpose, setPurpose] = useState("");
  const [returnDue, setReturnDue] = useState(addDays(today, DEFAULT_RETURN_DAYS));
  const [submitError, setSubmitError] = useState<string>();

  const checkbook = checkbooks.find((book) => book.id === checkbookId);
  const parsed = parseAmount(amountText);
  const amountCents = parsed !== null ? toCents(parsed) : 0;

  const errors: string[] = [];
  if (!checkbook) errors.push("Aucun chéquier en service : enregistrez-en un dans Comptes et chéquiers.");
  if (!supplierId) errors.push("Choisissez le fournisseur.");
  if (!payeeName.trim()) errors.push("Le bénéficiaire est obligatoire.");
  if (amountCents <= 0) errors.push("Saisissez le montant du chèque.");
  if (purpose.trim().length < 3) errors.push("Indiquez l'objet de la garantie.");
  if (!returnDue || returnDue < issueDate) errors.push("La restitution prévue doit suivre la date d'émission.");

  const submit = () => {
    if (errors.length > 0 || !checkbook) {
      return;
    }
    if (!window.confirm(`Émettre un chèque de garantie de ${formatMAD(amountCents / 100)} ?`)) {
      return;
    }
    setSubmitError(undefined);
    startTransition(async () => {
      const result = await issueGuarantee({
        checkbookId: checkbook.id,
        supplierId,
        payeeName: payeeName.trim(),
        amountCents,
        issueDate,
        issuePlace: issuePlace.trim(),
        purpose: purpose.trim(),
        returnDue,
      });
      if (result.ok) {
        toast.success(
          result.data.pendingApproval
            ? "Chèque de garantie préparé : numéro réservé, à valider avant impression."
            : "Chèque de garantie émis : le numéro est attribué.",
        );
        router.push(`/paiements/lots/${result.data.batchId}`);
      } else {
        setSubmitError(result.error);
      }
    });
  };

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Chèque de garantie</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="checkbook">Chéquier</FieldLabel>
            <select id="checkbook" className={SELECT_CLASS} value={checkbookId} onChange={(event) => setCheckbookId(event.target.value)}>
              {checkbooks.length === 0 && <option value="">Aucun chéquier en service</option>}
              {checkbooks.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.accountLabel} · {book.bankName} · prochain n° {formatInstrumentNumber(book.nextNumber, book.numberWidth)}
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
              onChange={(event) => {
                setSupplierId(event.target.value);
                setPayeeName(data.suppliers.find((s) => s.id === event.target.value)?.payeeName ?? "");
              }}
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
            <FieldLabel htmlFor="payee">Bénéficiaire imprimé</FieldLabel>
            <Input id="payee" value={payeeName} maxLength={200} onChange={(event) => setPayeeName(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="amount">Montant (DH)</FieldLabel>
            <Input id="amount" inputMode="decimal" className="tabular-nums" value={amountText} onChange={(event) => setAmountText(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="issue-date">Date d&apos;émission</FieldLabel>
            <Input id="issue-date" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value || today)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="issue-place">Lieu d&apos;émission</FieldLabel>
            <Input id="issue-place" value={issuePlace} maxLength={120} onChange={(event) => setIssuePlace(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="purpose">Objet de la garantie</FieldLabel>
            <Input
              id="purpose"
              value={purpose}
              maxLength={200}
              placeholder="Ex. caution de bonne exécution, marché n° 12/2026"
              onChange={(event) => setPurpose(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="return-due">Restitution prévue le</FieldLabel>
            <Input id="return-due" type="date" value={returnDue} min={issueDate} onChange={(event) => setReturnDue(event.target.value)} />
            <FieldDescription>Un rappel apparaît sur le tableau de bord à l&apos;approche de cette date.</FieldDescription>
          </Field>
        </CardContent>
      </Card>

      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col items-end gap-2">
        {errors.length > 0 && supplierId && <p className="text-sm text-muted-foreground">{errors[0]}</p>}
        <Button onClick={submit} disabled={pending || errors.length > 0}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          Émettre le chèque de garantie
        </Button>
      </div>
    </div>
  );
}
