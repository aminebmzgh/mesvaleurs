import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS, type InvoiceStatus, invoiceStatusVariant } from "@/lib/labels";

/** Statut d'une facture, signalée « en retard » si la date limite légale est dépassée. */
export function InvoiceStatusBadge({
  status,
  legalDueDate,
  today,
}: {
  status: InvoiceStatus;
  legalDueDate: string | null;
  today: string;
}) {
  const overdue = legalDueDate !== null && legalDueDate < today && (status === "unpaid" || status === "partially_paid");
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant={invoiceStatusVariant(status)}>{INVOICE_STATUS_LABELS[status]}</Badge>
      {overdue && <Badge variant="destructive">En retard</Badge>}
    </span>
  );
}
