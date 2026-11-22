"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, LinkIcon, Loader2Icon, MailIcon, RefreshCwIcon, UnlinkIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import type { SupplierPortalLink } from "@/lib/suppliers/portal-queries";
import { emailPortalLink, renewPortalLink, revokePortalLink } from "./actions";

/** Lien du portail fournisseur : création, copie, envoi par e-mail, renouvellement, désactivation. */
export function PortalCard({
  supplierId,
  supplierName,
  supplierEmail,
  link,
  canManage,
}: {
  supplierId: string;
  supplierName: string;
  supplierEmail: string | null;
  link: SupplierPortalLink | null;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [sending, startSending] = useTransition();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(supplierEmail ?? "");

  const run = (action: () => Promise<{ error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(success);
      }
    });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible : sélectionnez le lien et copiez-le à la main.");
    }
  };

  if (!link) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          Aucun lien actif. Avec un lien, {supplierName} suit ses règlements (prêts, remis, encaissés) et ses factures en attente, sans
          compte ni mot de passe : moins d&apos;appels pour demander où en est un paiement.
        </p>
        {canManage ? (
          <Button onClick={() => run(() => renewPortalLink(supplierId), "Lien du portail créé.")} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <LinkIcon aria-hidden />}
            Créer le lien
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Un administrateur ou un gestionnaire peut créer le lien.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input readOnly value={link.url} aria-label="Lien du portail" className="min-w-64 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button variant="outline" onClick={copy}>
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          {copied ? "Copié" : "Copier le lien"}
        </Button>
        <a href={link.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
          <ExternalLinkIcon aria-hidden />
          Voir comme le fournisseur
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Créé le {formatDateTime(link.createdAt)} ·{" "}
        {link.lastViewedAt
          ? `consulté ${link.viewCount} fois, dernière fois le ${formatDateTime(link.lastViewedAt)}`
          : "pas encore consulté"}
        . Le lien figure aussi sur les lettres d&apos;accompagnement (QR code) et dans les e-mails d&apos;accusé de réception.
      </p>

      {canManage && (
        <>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              startSending(async () => {
                const result = await emailPortalLink(supplierId, email);
                if (result.error) toast.error(result.error);
                else toast.success(result.success);
              });
            }}
          >
            <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
              E-mail du fournisseur
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="comptabilite@fournisseur.ma" required />
            </label>
            <Button type="submit" disabled={sending || !email.trim()}>
              {sending ? <Loader2Icon className="animate-spin" aria-hidden /> : <MailIcon aria-hidden />}
              Envoyer le lien
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Créer un nouveau lien ? L'ancien cessera aussitôt de fonctionner, y compris sur les lettres déjà envoyées.")) {
                  run(() => renewPortalLink(supplierId), "Nouveau lien créé. Pensez à l'envoyer au fournisseur.");
                }
              }}
            >
              <RefreshCwIcon aria-hidden />
              Nouveau lien
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Désactiver le lien ? ${supplierName} ne pourra plus consulter son suivi.`)) {
                  run(() => revokePortalLink(supplierId), "Lien désactivé.");
                }
              }}
            >
              <UnlinkIcon aria-hidden />
              Désactiver
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
