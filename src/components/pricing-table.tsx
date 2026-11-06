import { CheckIcon, MinusIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ANNUAL_MONTHS_BILLED,
  FEATURE_GROUP_LABELS,
  FEATURES,
  type FeatureGroup,
  type FeatureKey,
  hasFeature,
  INCLUDED_EVERYWHERE,
  PLAN_IDS,
  type PlanId,
  PLANS,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

// Espaces insécables du format français remplacés par des espaces simples (1 490 DH)
const price = (amount: number) => new Intl.NumberFormat("fr-FR").format(amount).replace(/\s/g, " ");
const limit = (value: number | null) => (value === null ? "Illimités" : String(value));

const Yes = () => <CheckIcon className="mx-auto size-4 text-primary" aria-label="Compris" />;
const No = () => <MinusIcon className="mx-auto size-4 text-muted-foreground/50" aria-label="Non compris" />;

/** Cartes des offres : prix, accroche et limites. `current` : offre de l'entreprise. */
export function PlanCards({ current, footer }: { current?: PlanId; footer?: (plan: PlanId) => ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {PLAN_IDS.map((id) => {
        const plan = PLANS[id];
        return (
          <Card key={id} className={cn(id === current && "border-primary ring-1 ring-primary")}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {plan.label}
                {id === current && <Badge>Votre offre</Badge>}
              </CardTitle>
              <CardDescription>{plan.tagline}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p>
                <span className="text-3xl font-semibold tabular-nums">{price(plan.monthlyPrice)} DH</span>
                <span className="text-sm text-muted-foreground"> HT / mois</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {plan.monthlyPrice === 0
                  ? "Sans engagement, sans carte bancaire."
                  : `ou ${price(plan.monthlyPrice * ANNUAL_MONTHS_BILLED)} DH HT par an (2 mois offerts)`}
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {plan.includedClients && (
                  <li>
                    {plan.includedClients} entreprises clientes, puis {plan.extraClientPrice} DH par entreprise
                  </li>
                )}
                <li>Comptes bancaires : {limit(plan.maxBankAccounts).toLowerCase()}</li>
                <li>Utilisateurs : {limit(plan.maxMembers).toLowerCase()}</li>
                <li>Paiements par mois : {limit(plan.maxMonthlyPayments).toLowerCase()}</li>
                <li>
                  IA : {plan.aiMonthlyQuota === 0 ? "non comprise" : `${plan.aiMonthlyQuota} par mois${plan.includedClients ? " et par client" : ""}`}
                </li>
              </ul>
              {footer && <div className="mt-auto pt-2">{footer(id)}</div>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const GROUPS = Object.keys(FEATURE_GROUP_LABELS) as FeatureGroup[];

/** Comparatif détaillé des fonctionnalités, par domaine. */
export function FeatureComparison({ current }: { current?: PlanId }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-64">Fonctionnalité</TableHead>
            {PLAN_IDS.map((id) => (
              <TableHead key={id} className={cn("w-28 text-center", id === current && "text-primary")}>
                {PLANS[id].label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {GROUPS.map((group) => {
            const everywhere = INCLUDED_EVERYWHERE.filter((item) => item.group === group);
            const gated = (Object.keys(FEATURES) as FeatureKey[]).filter((key) => FEATURES[key].group === group);
            return (
              <Fragment key={group}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={PLAN_IDS.length + 1} className="font-medium">
                    {FEATURE_GROUP_LABELS[group]}
                  </TableCell>
                </TableRow>
                {everywhere.map((item) => (
                  <TableRow key={item.label}>
                    <TableCell className="whitespace-normal">{item.label}</TableCell>
                    {PLAN_IDS.map((id) => (
                      <TableCell key={id}>
                        <Yes />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {gated.map((key) => (
                  <TableRow key={key}>
                    <TableCell className="whitespace-normal">{FEATURES[key].label}</TableCell>
                    {PLAN_IDS.map((id) => (
                      <TableCell key={id} className="text-center">
                        {key === "ai" && hasFeature(id, key) ? (
                          <span className="text-xs tabular-nums">{PLANS[id].aiMonthlyQuota} / mois</span>
                        ) : hasFeature(id, key) ? (
                          <Yes />
                        ) : (
                          <No />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
