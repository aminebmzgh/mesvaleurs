"use client";

import { CameraIcon, CircleAlertIcon, CircleCheckIcon, Loader2Icon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { FormSelect } from "@/components/form-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { lastNumberOf } from "@/lib/cheque-scan/parse";
import type { ChequeScan } from "@/lib/cheque-scan/read";
import { INSTRUMENT_LABELS, type InstrumentType } from "@/lib/checkbooks";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { createCheckbook } from "../actions";

const TYPE_OPTIONS = Object.entries(INSTRUMENT_LABELS).map(([value, label]) => ({ value, label }));
const SIZE_OPTIONS = ["25", "50", "100"];
const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

const SOURCE_LABELS: Record<NonNullable<ChequeScan["source"]>, string> = {
  both: "numéro imprimé et bande CMC7 concordants",
  printed: "numéro imprimé",
  cmc7: "bande CMC7, à vérifier",
};

export function CheckbookForm({
  accountId,
  accountRib,
  allowScan = true,
}: {
  accountId: string;
  accountRib: string | null;
  /** Lecture du premier chèque par photo (offre Pro et supérieures). */
  allowScan?: boolean;
}) {
  const [state, action, pending] = useActionState(createCheckbook.bind(null, accountId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState("25");
  // Type proposé d'après la photo : la liste est recréée avec cette valeur par défaut
  const [type, setType] = useState<InstrumentType>("check");
  const [scan, setScan] = useState<{ status: "reading"; ratio: number } | { status: "done"; result: ChequeScan } | { status: "error"; message: string } | null>(
    null,
  );

  // Formulaire vidé après un enregistrement réussi
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  /** Dernier numéro déduit du premier et de la taille du carnet (reste modifiable). */
  const fillLast = (first: string, bookSize: string) => {
    const last = bookSize === "" ? null : lastNumberOf(first, Number(bookSize));
    if (last && lastRef.current) {
      lastRef.current.value = last;
    }
  };

  const onPhoto = async (file: File) => {
    setScan({ status: "reading", ratio: 0 });
    try {
      const { readChequePhoto } = await import("@/lib/cheque-scan/read");
      const result = await readChequePhoto(file, accountRib, (ratio) => setScan({ status: "reading", ratio }));
      if (result.number && firstRef.current) {
        firstRef.current.value = result.number;
        fillLast(result.number, size);
      }
      if (result.lcn) {
        setType("lcn");
      }
      setScan({ status: "done", result });
    } catch (error) {
      setScan({ status: "error", message: error instanceof Error ? error.message : "Lecture impossible." });
    }
  };

  return (
    <ActionForm ref={formRef} action={action} pending={pending} noValidate className="rounded-lg border p-4">
      <FieldSet>
        <FieldLegend>Ajouter un carnet</FieldLegend>
        <FormMessage state={state} />
        {allowScan && (
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), scan?.status === "reading" && "pointer-events-none opacity-50")}
          >
            {scan?.status === "reading" ? <Loader2Icon className="animate-spin" aria-hidden /> : <CameraIcon aria-hidden />}
            Lire le premier chèque (photo)
            <input
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              className="sr-only"
              disabled={scan?.status === "reading"}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void onPhoto(file);
                }
              }}
            />
          </label>
          <span className="text-xs text-muted-foreground">
            {scan?.status === "reading"
              ? `Lecture du chèque : ${Math.round(scan.ratio * 100)} %…`
              : "Photo nette, à plat, bande magnétique du bas visible. Lue dans votre navigateur."}
          </span>
        </div>
        )}
        {scan?.status === "done" && <ScanResult result={scan.result} />}
        {scan?.status === "error" && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{scan.message}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[11rem_1fr_8rem_1fr_11rem_auto] lg:items-start">
          <Field>
            <FieldLabel htmlFor="type">Type</FieldLabel>
            <FormSelect key={type} id="type" name="type" options={TYPE_OPTIONS} defaultValue={type} />
            <FieldErrors state={state} name="type" />
          </Field>
          <Field>
            <FieldLabel htmlFor="first_number">Premier numéro</FieldLabel>
            <Input
              ref={firstRef}
              id="first_number"
              name="first_number"
              inputMode="numeric"
              placeholder="0001000"
              className="font-mono"
              onChange={(event) => fillLast(event.target.value, size)}
              {...invalidProps(state, "first_number")}
            />
            <FieldDescription>Saisissez les zéros initiaux tels qu&apos;imprimés.</FieldDescription>
            <FieldErrors state={state} name="first_number" />
          </Field>
          <Field>
            <FieldLabel htmlFor="book_size">Formules</FieldLabel>
            <select
              id="book_size"
              className={SELECT_CLASS}
              value={size}
              onChange={(event) => {
                setSize(event.target.value);
                fillLast(firstRef.current?.value ?? "", event.target.value);
              }}
            >
              {SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value="">Autre</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="last_number">Dernier numéro</FieldLabel>
            <Input
              ref={lastRef}
              id="last_number"
              name="last_number"
              inputMode="numeric"
              placeholder="0001024"
              className="font-mono"
              {...invalidProps(state, "last_number")}
            />
            <FieldErrors state={state} name="last_number" />
          </Field>
          <Field>
            <FieldLabel htmlFor="received_at">Reçu le</FieldLabel>
            <Input id="received_at" name="received_at" type="date" {...invalidProps(state, "received_at")} />
            <FieldErrors state={state} name="received_at" />
          </Field>
          <SubmitButton className="lg:mt-6">Ajouter</SubmitButton>
        </div>
      </FieldSet>
    </ActionForm>
  );
}

function ScanResult({ result }: { result: ChequeScan }) {
  if (!result.number) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>Numéro non lu</AlertTitle>
        <AlertDescription>
          Saisissez-le, ou reprenez la photo : formule à plat, bien éclairée, sans reflet, numéro et bande du bas lisibles.
        </AlertDescription>
      </Alert>
    );
  }
  const warning = result.conflict !== null || result.account === "mismatch" || result.source === "cmc7";
  return (
    <Alert variant={result.account === "mismatch" ? "destructive" : "default"}>
      {warning ? <CircleAlertIcon aria-hidden /> : <CircleCheckIcon aria-hidden />}
      <AlertTitle>
        Premier numéro lu : <span className="font-mono">{result.number}</span> ({SOURCE_LABELS[result.source!]})
      </AlertTitle>
      <AlertDescription>
        {result.conflict && (
          <p>
            Le numéro imprimé ({result.conflict.printed}) et la bande CMC7 ({result.conflict.cmc7}) diffèrent : vérifiez sur la
            formule.
          </p>
        )}
        {result.account === "match" && <p>Le chèque correspond bien au RIB de ce compte.</p>}
        {result.account === "mismatch" && <p>Le RIB lu ne correspond pas à ce compte : vérifiez que le carnet est le bon.</p>}
        <p>Vérifiez le premier et le dernier numéro avant d&apos;ajouter le carnet.</p>
      </AlertDescription>
    </Alert>
  );
}
