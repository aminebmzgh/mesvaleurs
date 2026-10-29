import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization, requireUser } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate, formatMAD } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CeilingDialog } from "@/components/ceiling-dialog";
import { setMemberCeiling } from "./actions";
import { InvitationActions, MemberActions } from "./member-actions";
import { InviteMemberForm } from "./invite-member-form";

export const metadata: Metadata = { title: "Membres" };

export default function MembersPage() {
  return (
    <>
      <PageHeader title="Membres" description="Personnes ayant accès à l'entreprise et leur rôle." />
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <Members />
      </Suspense>
    </>
  );
}

async function Members() {
  const [organization, user] = await Promise.all([requireActiveOrganization(), requireUser()]);
  const isAdmin = organization.role === "admin";
  const supabase = await createClient();

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, role, user_id, created_at, daily_ceiling, profiles ( full_name, email )")
      .eq("organization_id", organization.organizationId)
      .order("created_at"),
    // Lisibles uniquement par les administrateurs (RLS) : liste vide sinon
    supabase
      .from("invitations")
      .select("id, email, role, expires_at")
      .eq("organization_id", organization.organizationId)
      .is("accepted_at", null)
      .order("created_at"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Inviter un collaborateur</CardTitle>
            <CardDescription>
              Il recevra un e-mail pour créer son compte et rejoindre l&apos;entreprise.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMemberForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Membres ({members?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Depuis le</TableHead>
                <TableHead>Plafond / jour</TableHead>
                {isAdmin && <TableHead className="text-end">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.profiles?.full_name ?? "—"}
                    {member.user_id === user.id && (
                      <Badge variant="secondary" className="ms-2">
                        Vous
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{member.profiles?.email}</TableCell>
                  <TableCell>{ROLE_LABELS[member.role]}</TableCell>
                  <TableCell>{formatDate(member.created_at)}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <CeilingDialog
                        id={member.id}
                        name={member.profiles?.full_name || member.profiles?.email || "ce membre"}
                        ceiling={member.daily_ceiling}
                        description="Au-delà de ce total de paiements préparés et datés du même jour, ses lots sont validés par une autre personne avant impression."
                        action={setMemberCeiling.bind(null, member.id)}
                      />
                    ) : member.daily_ceiling != null ? (
                      formatMAD(member.daily_ceiling)
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-end">
                      <MemberActions membershipId={member.id} role={member.role} isSelf={member.user_id === user.id} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdmin && invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>{ROLE_LABELS[invitation.role]}</TableCell>
                    <TableCell>{formatDate(invitation.expires_at)}</TableCell>
                    <TableCell className="text-end">
                      <InvitationActions invitationId={invitation.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
