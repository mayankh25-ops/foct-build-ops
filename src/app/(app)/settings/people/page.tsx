"use client";

/**
 * Settings → People. Who can sign in to the portal, and how somebody new gets
 * in: you type their email, they open a link, they're in. No dashboard, no SQL.
 *
 * Not to be confused with Settings → Cleaners & kiosks, which is about people
 * with a PIN on a tablet — most of whom never sign in here at all.
 */
import * as React from "react";
import { Info, Loader2, Mail, ShieldCheck, UserPlus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  fetchPeople,
  invitePerson,
  inviteAge,
  revokeInvite,
  INVITABLE_ROLES,
  PEOPLE_LIVE,
  type OrgInvite,
  type OrgMember,
} from "@/lib/people-live";
import { useSessionStore } from "@/lib/session";

const seen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "never";

export default function PeoplePage() {
  const { toast } = useToast();
  const profile = useSessionStore((s) => s.profile);
  const orgId = useSessionStore((s) => s.activeOrgId);
  const org = profile?.memberships.find((m) => m.org_id === orgId) ?? profile?.memberships[0];

  const [members, setMembers] = React.useState<OrgMember[]>([]);
  const [invites, setInvites] = React.useState<OrgInvite[]>([]);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("manager");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const live = PEOPLE_LIVE && Boolean(org);

  const load = React.useCallback(() => {
    if (!live || !org) return;
    fetchPeople(org.org_id)
      .then((r) => {
        setMembers(r.members);
        setInvites(r.invites);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [live, org]);

  React.useEffect(load, [load]);

  const invite = async () => {
    if (!org) return;
    setBusy(true);
    const res = await invitePerson({ orgId: org.org_id, email, role });
    setBusy(false);
    if (!res.ok) {
      toast({ tone: "critical", title: "Not invited", description: res.error });
      return;
    }
    toast({
      tone: "success",
      title: `Invited ${res.email ?? email}`,
      description: "They get access the moment they sign in with that address.",
    });
    setEmail("");
    load();
  };

  const drop = async (i: OrgInvite) => {
    const res = await revokeInvite(i.id);
    if (!res.ok) {
      toast({ tone: "critical", title: "Not revoked", description: res.error });
      return;
    }
    toast({ tone: "neutral", title: `Invitation to ${i.email} revoked` });
    load();
  };

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="People"
        description={
          org
            ? `Who can sign in for ${org.org_name}. Cleaners with a kiosk PIN live under Cleaners & kiosks.`
            : "Who can sign in to the portal."
        }
      />

      <Card className="mb-6">
        <CardBody className="flex gap-3 text-body-sm text-fg-secondary">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
          <span>
            {live ? (
              <>
                Invite an email address and the person is in as soon as they sign in with it —
                they don&rsquo;t need a password, and you don&rsquo;t need the Supabase dashboard.
                An invitation lasts 14 days, works once, and can be revoked.
              </>
            ) : (
              <>
                <span className="font-medium text-fg">Demo mode.</span> Sign in against a live
                database to manage real people.
              </>
            )}
          </span>
        </CardBody>
      </Card>

      {error && (
        <Card className="mb-6">
          <CardBody className="text-body-sm text-critical-text">{error}</CardBody>
        </Card>
      )}

      {live && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Invite somebody</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap items-end gap-3">
            <Input
              className="min-w-56 flex-1"
              label="Email"
              type="email"
              placeholder="colleague@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void invite()}
            />
            <Select
              className="min-w-56"
              label="Role"
              options={INVITABLE_ROLES}
              value={role}
              onValueChange={setRole}
            />
            <Button disabled={busy || email.trim() === ""} onClick={() => void invite()}>
              {busy ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <UserPlus aria-hidden className="size-4" />
              )}
              Send invitation
            </Button>
          </CardBody>
        </Card>
      )}

      {invites.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Waiting to sign in</CardTitle>
            <Badge tone="warning">{invites.length}</Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {invites.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-medium text-fg">
                    <Mail aria-hidden className="size-4 text-fg-muted" />
                    {i.email}
                  </p>
                  <p className="mt-0.5 text-caption text-fg-muted">
                    {i.role_name} · {inviteAge(i)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void drop(i)}>
                  <X aria-hidden className="size-4" />
                  Revoke
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={live ? "Nobody else yet" : "Sign in to manage people"}
          description={
            live
              ? "Invite a colleague above — they'll appear here once they sign in."
              : "This screen manages real portal logins, so it needs a live database."
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Last signed in</Th>
              </Tr>
            </THead>
            <TBody>
              {members.map((m) => (
                <Tr key={m.user_id}>
                  <Td className="font-medium text-fg">{m.name}</Td>
                  <Td className="text-fg-secondary">{m.email}</Td>
                  <Td>
                    <Badge tone={m.role === "org_admin" || m.role === "super_admin" ? "accent" : "neutral"}>
                      {m.role_name}
                    </Badge>
                  </Td>
                  <Td className="text-fg-muted">
                    {/* "never" is worth seeing: it usually means an account
                        somebody created and nobody ever used */}
                    {seen(m.last_seen_at)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
