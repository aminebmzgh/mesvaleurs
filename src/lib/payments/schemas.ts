import { z } from "zod";
import { MAX_INSTRUMENTS } from "./split";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date invalide." });

/** Demande d'émission envoyée par l'assistant (montants en centimes). */
export const issueRequestSchema = z
  .object({
    checkbookId: z.uuid({ error: "Choisissez un chéquier ou un carnet de LCN." }),
    supplierId: z.uuid({ error: "Choisissez un fournisseur." }),
    payeeName: z.string().trim().min(1, { error: "Le bénéficiaire est obligatoire." }).max(200),
    issueDate: isoDate,
    issuePlace: z.string().trim().max(120),
    instruments: z
      .array(
        z.object({
          amountCents: z.number().int().positive({ error: "Chaque formule doit avoir un montant positif." }),
          dueDate: isoDate.nullable(),
        }),
      )
      .min(1, { error: "Au moins une formule est nécessaire." })
      .max(MAX_INSTRUMENTS, { error: `${MAX_INSTRUMENTS} formules au maximum par émission.` }),
    /** Factures à régler, dans l'ordre d'affectation (les plus anciennes d'abord). */
    invoiceIds: z.array(z.uuid()).max(50),
  })
  .refine((request) => request.instruments.every((instrument) => !instrument.dueDate || instrument.dueDate >= request.issueDate), {
    error: "Une échéance ne peut pas précéder la date d'émission.",
    path: ["instruments"],
  });

export type IssueRequest = z.infer<typeof issueRequestSchema>;
