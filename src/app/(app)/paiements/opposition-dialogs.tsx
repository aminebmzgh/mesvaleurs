"use client";

import { Loader2Icon, OctagonXIcon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { formatInstrumentNumber } from "@/lib/checkbooks";
import { LEGAL_DISCLAIMER, STOP_ORDER_REASON_LABELS, type StopOrderReason, stopOrderReasonsFor } from "@/lib/labels";
import { type StopOrderInput, type StopOrderResult, stopBlankForms, stopPayment } from "./actions";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

/** Lettre d'opposition à confirmer par écrit à la banque, proposée dès l'opposition enregistrée. */
function onStopped(result: StopOrderResult, close: () => void) {
  if (result.error || !result.stopOrderId) {
    toast.error(result.error ?? "Impossible d'enregistrer l'opposition.");
    return;
  }
  const letter = `/paiements/oppositions/${result.stopOrderId}/lettre`;
  toast.success("Opposition enregistrée. Confirmez-la par écrit à la banque.", {
    action: { label: "Lettre d'opposition", onClick: () => window.open(letter, "_blank", "noopener") },
    duration: 15000,
  });
  close();
}

/** Motif, date du constat, récépissé de déclaration et notes d'une opposition. */
function StopOrderFields({
  id,
  reasons,
  value,
  onChange,
  today,
  minDate,
}: {
  id: string;
  reasons: StopOrderReason[];
  value: StopOrderInput;
  onChange: (value: StopOrderInput) => void;
  today: string;
  minDate?: string;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`stop-reason-${id}`}>Motif</FieldLabel>
        <select
          id={`stop-reason-${id}`}
          className={SELECT_CLASS}
          value={value.reason}
          onChange={(event) => onChange({ ...value, reason: event.target.value as StopOrderReason })}
        >
          {reasons.map((reason) => (
            <option key={reason} value={reason}>
              {STOP_ORDER_REASON_LABELS[reason]}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`stop-date-${id}`}>Constaté le</FieldLabel>
        <Input
          id={`stop-date-${id}`}
          type="date"
          value={value.occurredOn}
          min={minDate}
          max={today}
          onChange={(event) => onChange({ ...value, occurredOn: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`stop-report-${id}`}>Récépissé de déclaration (facultatif)</FieldLabel>
        <Input
          id={`stop-report-${id}`}
          value={value.policeReport}
          maxLength={120}
          placeholder="Ex. PV n° 1234/2026, commissariat de Maârif"
          onChange={(event) => onChange({ ...value, policeReport: event.target.value })}
        />
        <FieldDescription>La perte ou le vol se déclare aussi auprès de la police ou de la gendarmerie.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`stop-notes-${id}`}>Notes (facultatif)</FieldLabel>
        <Textarea
          id={`stop-notes-${id}`}
          rows={2}
          value={value.notes}
          maxLength={500}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
        />
      </Field>
      <p className="text-xs text-muted-foreground">{LEGAL_DISCLAIMER}</p>
    </>
  );
}

/** Opposition sur un chèque ou une LCN en circulation. */
export function StopPaymentDialog({
  paymentId,
  label,
  isLcn,
  issueDate,
  today,
}: {
  paymentId: string;
  label: string;
  isLcn: boolean;
  issueDate?: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<StopOrderInput>({ reason: "lost", occurredOn: today, policeReport: "", notes: "" });
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <OctagonXIcon aria-hidden />
        Opposition
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opposition sur {isLcn ? "la" : "le"} {label}</DialogTitle>
          <DialogDescription>
            Prévenez la banque sans attendre, puis confirmez l&apos;opposition par écrit avec la lettre générée. Les factures réglées
            par ce paiement redeviennent à payer.
          </DialogDescription>
        </DialogHeader>
        <StopOrderFields
          id={paymentId}
          reasons={stopOrderReasonsFor(isLcn ? "lcn" : "check")}
          value={value}
          onChange={setValue}
          today={today}
          minDate={issueDate}
        />
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={pending || !value.occurredOn}
            onClick={() => startTransition(async () => onStopped(await stopPayment(paymentId, value), () => setOpen(false)))}
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Enregistrer l&apos;opposition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type BlankCheckbook = { id: string; label: string; nextNumber: number; lastNumber: number; numberWidth: number };

/** Opposition sur des formules vierges : chéquier ou carnet perdu, formules volées. */
export function StopBlankFormsDialog({ checkbooks, today }: { checkbooks: BlankCheckbook[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [bookId, setBookId] = useState(checkbooks[0]?.id ?? "");
  const book = checkbooks.find((b) => b.id === bookId) ?? checkbooks[0];
  const [first, setFirst] = useState(String(book?.nextNumber ?? ""));
  const [last, setLast] = useState(String(book?.lastNumber ?? ""));
  const [value, setValue] = useState<StopOrderInput>({ reason: "lost", occurredOn: today, policeReport: "", notes: "" });
  const [pending, startTransition] = useTransition();
  if (!book) {
    return null;
  }
  const selectBook = (id: string) => {
    const next = checkbooks.find((b) => b.id === id);
    setBookId(id);
    if (next) {
      setFirst(String(next.nextNumber));
      setLast(String(next.lastNumber));
    }
  };
  const [firstNumber, lastNumber] = [Number(first), Number(last)];
  const valid =
    /^\d+$/.test(first) && /^\d+$/.test(last) && firstNumber >= book.nextNumber && lastNumber <= book.lastNumber && lastNumber >= firstNumber;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <OctagonXIcon aria-hidden />
        Opposition sur formules vierges
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Opposition sur formules vierges</DialogTitle>
          <DialogDescription>
            Chéquier ou carnet perdu, formules volées : ces numéros ne seront plus jamais attribués à l&apos;émission.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="stop-checkbook">Carnet</FieldLabel>
          <select id="stop-checkbook" className={SELECT_CLASS} value={book.id} onChange={(event) => selectBook(event.target.value)}>
            {checkbooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <FieldDescription>
            Formules non utilisées : n° {formatInstrumentNumber(book.nextNumber, book.numberWidth)} à{" "}
            {formatInstrumentNumber(book.lastNumber, book.numberWidth)}.
          </FieldDescription>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="stop-first">Du n°</FieldLabel>
            <Input id="stop-first" inputMode="numeric" value={first} onChange={(event) => setFirst(event.target.value.trim())} />
          </Field>
          <Field>
            <FieldLabel htmlFor="stop-last">Au n°</FieldLabel>
            <Input id="stop-last" inputMode="numeric" value={last} onChange={(event) => setLast(event.target.value.trim())} />
          </Field>
        </div>
        <StopOrderFields id="blank" reasons={stopOrderReasonsFor("blank")} value={value} onChange={setValue} today={today} />
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={pending || !valid || !value.occurredOn}
            onClick={() =>
              startTransition(async () => onStopped(await stopBlankForms(book.id, firstNumber, lastNumber, value), () => setOpen(false)))
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Enregistrer l&apos;opposition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
