"use client";

import { CircleCheckIcon, CircleXIcon, Loader2Icon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { approveBatch, refuseBatch } from "./actions";

/** Valider ou refuser un lot préparé (double signature). */
export function ApprovalActions({ batchId, label }: { batchId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await approveBatch(batchId);
            if (result.error) {
              toast.error(result.error);
            } else {
              toast.success("Lot validé : il peut être imprimé.");
            }
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <CircleCheckIcon aria-hidden />}
        Valider
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" disabled={pending} />}>
          <CircleXIcon aria-hidden />
          Refuser
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser {label}</DialogTitle>
            <DialogDescription>
              Les paiements sont annulés avec le motif ; leurs numéros restent dans l&apos;historique. Les formules réservées sont à
              détruire.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`refusal-${batchId}`}>Motif du refus</FieldLabel>
            <Textarea id={`refusal-${batchId}`} rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={pending || reason.trim().length < 3}
              onClick={() =>
                startTransition(async () => {
                  const result = await refuseBatch(batchId, reason);
                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    toast.success("Lot refusé.");
                    setOpen(false);
                  }
                })
              }
            >
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
