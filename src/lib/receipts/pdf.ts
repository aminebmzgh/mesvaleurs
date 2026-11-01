import { PDFDocument, StandardFonts } from "pdf-lib";
import { amountInWords } from "@/lib/amount-in-words";
import { formatDate, formatDateTime, formatMAD } from "@/lib/format";
import type { LetterOrganization } from "@/lib/letters/data";
import { header, MARGIN, MUTED, WIDTH, Writer } from "@/lib/letters/pdf";

export type ReceiptPdfData = {
  organization: LetterOrganization;
  supplier: { name: string; address: string | null; city: string | null; ice: string | null };
  reference: string;
  signedAt: string;
  deliveredOn: string;
  signerName: string;
  signerIdNumber: string | null;
  /** Image PNG de la signature tracée à l'écran. */
  signature: Uint8Array | null;
  payments: { label: string; bank: string; dueDate: string | null; amount: number }[];
  total: number;
};

/**
 * Reçu de remise des valeurs (spec §11 bis G) : valeurs remises, signataire, date et
 * heure, signature tracée à l'écran. Preuve de la date de remise (loi 69-21).
 */
export async function receiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Accusé de réception ${data.reference}`);
  pdf.setCreator("MesValeurs");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(pdf, font, bold, `${data.reference} · signé électroniquement le ${formatDateTime(data.signedAt)}`);

  await header(w, pdf, {
    organization: data.organization,
    recipient: { name: data.supplier.name, lines: [data.supplier.address, data.supplier.city, data.supplier.ice && `ICE ${data.supplier.ice}`].filter(Boolean) as string[] },
    place: data.organization.city ?? "",
    date: data.deliveredOn,
    reference: data.reference,
  });
  w.y -= 24;
  w.paragraph("Objet : accusé de réception de règlement", 10.5, bold);
  w.y -= 8;
  const count = data.payments.length;
  w.paragraph(
    `${data.signerName}${data.signerIdNumber ? `, CIN ${data.signerIdNumber},` : ""} reconnaît avoir reçu de ${data.organization.name}, pour le compte de ${data.supplier.name}, le ${formatDate(data.deliveredOn)}, ${count} valeur${count > 1 ? "s" : ""} pour un total de ${formatMAD(data.total)} :`,
  );
  w.y -= 6;
  w.table(
    [
      { header: "Valeur", width: 150 },
      { header: "Banque", width: 150 },
      { header: "Échéance", width: 90 },
      { header: "Montant", width: 105, align: "right" },
    ],
    data.payments.map((payment) => [payment.label, payment.bank, payment.dueDate ? formatDate(payment.dueDate) : "—", formatMAD(payment.amount)]),
    [`${count} valeur${count > 1 ? "s" : ""}`, "", "", formatMAD(data.total)],
  );
  // En milieu de phrase : sans majuscule initiale
  const words = amountInWords(data.total);
  w.paragraph(`Soit la somme de : ${words.charAt(0).toLocaleLowerCase("fr")}${words.slice(1)}.`, 9.5);

  // Signature du destinataire
  w.ensure(150);
  w.y -= 24;
  const boxWidth = (WIDTH - 2 * MARGIN) / 2;
  w.box(MARGIN, boxWidth, 120, "Reçu par");
  const top = w.y;
  w.y = top - 30;
  w.text(data.signerName, MARGIN + 8, 10, bold);
  if (data.signerIdNumber) {
    w.y -= 14;
    w.text(`CIN ${data.signerIdNumber}`, MARGIN + 8, 9);
  }
  w.y -= 14;
  w.text(`Le ${formatDateTime(data.signedAt)}`, MARGIN + 8, 9, font, MUTED);
  if (data.signature) {
    try {
      const image = await pdf.embedPng(data.signature);
      const scale = Math.min((boxWidth - 16) / image.width, 55 / image.height);
      w.page.drawImage(image, { x: MARGIN + 8, y: top - 115, width: image.width * scale, height: image.height * scale });
    } catch {
      // Image illisible : le reçu reste généré, sans la signature
    }
  }
  w.y = top - 120;
  w.y -= 20;
  w.paragraph(
    "Signature tracée à l'écran au moment de la remise et conservée par MesValeurs avec la date et l'heure de signature. Ce reçu fait foi de la date de remise des valeurs.",
    7.5,
  );
  return pdf.save();
}
