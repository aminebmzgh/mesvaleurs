import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { listBanks } from "@/lib/bank-accounts/queries";
import { createBankAccount } from "../actions";
import { BankAccountForm } from "../bank-account-form";

export const metadata: Metadata = { title: "Nouveau compte bancaire" };

export default function NewBankAccountPage() {
  return (
    <>
      <PageHeader title="Nouveau compte bancaire" />
      <Suspense fallback={<Skeleton className="h-72 w-full max-w-3xl rounded-xl" />}>
        <NewBankAccount />
      </Suspense>
    </>
  );
}

async function NewBankAccount() {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const banks = await listBanks();
  return (
    <Card className="max-w-3xl">
      <CardContent>
        <BankAccountForm
          action={createBankAccount}
          banks={banks.map((bank) => ({ value: bank.id, label: bank.name }))}
          submitLabel="Créer le compte"
        />
      </CardContent>
    </Card>
  );
}
