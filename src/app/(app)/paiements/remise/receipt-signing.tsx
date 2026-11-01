"use client";

import { CameraIcon, CircleAlertIcon, Loader2Icon, PenLineIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate, formatMAD } from "@/lib/format";
import { imageCanvas } from "@/lib/ocr/worker";
import type { DeliverablePayment } from "@/lib/receipts/queries";
import { createClient } from "@/lib/supabase/client";
import { recordReceipt } from "../accuses/actions";

/** Photo des valeurs remises : réduite en JPEG avant l'envoi. */
async function photoBlob(file: File): Promise<Blob | null> {
  const canvas = await imageCanvas(file, 600, 1600);
  return canvas ? new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8)) : null;
}

export function ReceiptSigning({
  organizationId,
  supplierName,
  payments,
  selected: initialSelected,
}: {
  organizationId: string;
  supplierName: string;
  payments: DeliverablePayment[];
  selected: string[];
}) {
  const router = useRouter();
  const pad = useRef<SignaturePadHandle>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected.length ? initialSelected : payments.map((p) => p.id)));
  const [signerName, setSignerName] = useState("");
  const [signerIdNumber, setSignerIdNumber] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const onSignatureChange = useCallback((empty: boolean) => setSigned(!empty), []);

  const chosen = payments.filter((payment) => selected.has(payment.id));
  const total = chosen.reduce((sum, payment) => sum + payment.amount, 0);
  const ready = chosen.length > 0 && signerName.trim().length >= 2 && signed;

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const signature = await pad.current?.toBlob();
      if (!signature || pad.current?.isEmpty()) {
        setError("La signature est obligatoire.");
        return;
      }
      const storage = createClient().storage.from("cheques-scans");
      const signaturePath = `${organizationId}/accuses/${crypto.randomUUID()}.png`;
      const { error: signatureError } = await storage.upload(signaturePath, signature, { contentType: "image/png", upsert: false });
      if (signatureError) {
        setError("L'envoi de la signature a échoué. Vérifiez la connexion et réessayez.");
        return;
      }
      let photoPath: string | null = null;
      if (photo) {
        const blob = await photoBlob(photo);
        if (blob) {
          photoPath = `${organizationId}/accuses/${crypto.randomUUID()}.jpg`;
          const { error: photoError } = await storage.upload(photoPath, blob, { contentType: "image/jpeg", upsert: false });
          if (photoError) {
            photoPath = null;
          }
        }
      }
      const result = await recordReceipt({
        paymentIds: chosen.map((payment) => payment.id),
        signerName,
        signerIdNumber,
        signaturePath,
        photoPath,
      });
      if (result.error || !result.receiptId) {
        setError(result.error ?? "Impossible d'enregistrer la remise.");
        return;
      }
      router.push(`/paiements/accuses/${result.receiptId}?nouveau=1`);
    });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Valeurs remises à {supplierName}</CardTitle>
          <CardDescription>
            {chosen.length} valeur(s) cochée(s), total {formatMAD(total)}. La date de remise sera celle d&apos;aujourd&apos;hui (date de
            paiement retenue pour la loi 69-21).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {payments.map((payment) => (
            <label key={payment.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selected.has(payment.id)}
                onChange={(event) => toggle(payment.id, event.target.checked)}
                disabled={pending}
              />
              <span className="flex-1">
                <span className="font-medium">{payment.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {payment.bank} · émis le {formatDate(payment.issueDate)}
                  {payment.dueDate && ` · échéance ${formatDate(payment.dueDate)}`}
                </span>
              </span>
              <span className="tabular-nums">{formatMAD(payment.amount)}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLineIcon className="size-4" aria-hidden />
            Signature de la personne qui reçoit
          </CardTitle>
          <CardDescription>À remplir par le fournisseur ou son livreur, sur cet écran.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="signer_name">Nom et prénom</FieldLabel>
              <Input id="signer_name" value={signerName} onChange={(event) => setSignerName(event.target.value)} maxLength={120} autoComplete="off" disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="signer_id_number">CIN (facultatif)</FieldLabel>
              <Input
                id="signer_id_number"
                value={signerIdNumber}
                onChange={(event) => setSignerIdNumber(event.target.value.toUpperCase())}
                maxLength={20}
                autoComplete="off"
                disabled={pending}
              />
            </Field>
          </div>
          <SignaturePad ref={pad} label="Zone de signature" onChange={onSignatureChange} />
          <Field>
            <FieldLabel htmlFor="receipt_photo">
              <CameraIcon className="size-4" aria-hidden />
              Photo des valeurs remises (facultatif)
            </FieldLabel>
            <input
              id="receipt_photo"
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              className="text-sm file:me-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1"
              disabled={pending}
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            />
            <FieldDescription>Sur téléphone ou tablette, l&apos;appareil photo s&apos;ouvre directement.</FieldDescription>
          </Field>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button size="lg" className="w-fit" disabled={!ready || pending} onClick={submit}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <PenLineIcon aria-hidden />}
        Valider la remise signée
      </Button>
    </div>
  );
}
