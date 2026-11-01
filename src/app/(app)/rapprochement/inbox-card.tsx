"use client";

import { CopyIcon, EyeOffIcon, InboxIcon, Loader2Icon, RefreshCwIcon, RotateCcwIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { renewInbox, setInboundIgnored } from "./inbox-actions";

type Item = { id: string; received_at: string; sender: string; subject: string | null; filename: string; status: string };

/** Relevés reçus par e-mail : adresse de réception de l'entreprise et fichiers à importer. */
export function InboxCard({ address, pending, recent, canManage }: { address: string | null; pending: Item[]; recent: Item[]; canManage: boolean }) {
  const [busy, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string }>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
      } else if (success) {
        toast.success(success);
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <InboxIcon className="size-4" aria-hidden />
          Relevés reçus par e-mail
        </CardTitle>
        <CardDescription>
          Donnez cette adresse à votre banque, ou transférez-y vos relevés (PDF, Excel, CSV, photo) : ils arrivent ici, prêts à
          importer. Adresse confidentielle, propre à votre entreprise.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {address ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm" aria-label="Adresse de réception des relevés">
              {address}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(address);
                toast.success("Adresse copiée.");
              }}
            >
              <CopyIcon aria-hidden />
              Copier
            </Button>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Créer une nouvelle adresse ? L'adresse actuelle ne recevra plus rien.")) {
                    run(renewInbox, "Nouvelle adresse créée.");
                  }
                }}
              >
                <RefreshCwIcon aria-hidden />
                Nouvelle adresse
              </Button>
            )}
          </div>
        ) : canManage ? (
          <Button className="w-fit" disabled={busy} onClick={() => run(renewInbox, "Adresse de réception créée.")}>
            {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <InboxIcon aria-hidden />}
            Créer l&apos;adresse de réception
          </Button>
        ) : (
          <p className="text-muted-foreground">Un administrateur ou un gestionnaire peut créer l&apos;adresse de réception.</p>
        )}

        {pending.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Relevés à importer">
            {pending.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.filename}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    De {item.sender} · {formatDateTime(item.received_at)}
                    {item.subject && ` · ${item.subject}`}
                  </span>
                </span>
                {canManage && (
                  <>
                    <Link href={`/rapprochement/importer?boite=${item.id}`} className={buttonVariants({ size: "sm" })}>
                      <UploadIcon aria-hidden />
                      Importer
                    </Link>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setInboundIgnored(item.id, true))}>
                      <EyeOffIcon aria-hidden />
                      Ignorer
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {address && pending.length === 0 && <p className="text-muted-foreground">Aucun relevé en attente.</p>}

        {recent.length > 0 && (
          <details className="text-muted-foreground">
            <summary className="cursor-pointer">Déjà traités</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {recent.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {item.filename} · {item.status === "imported" ? "importé" : "ignoré"} · {formatDateTime(item.received_at)}
                  </span>
                  {canManage && item.status === "ignored" && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setInboundIgnored(item.id, false))}>
                      <RotateCcwIcon aria-hidden />
                      Remettre à importer
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
