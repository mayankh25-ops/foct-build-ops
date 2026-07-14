"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Plug,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SchemaForm } from "@/components/ui/schema-form";
import { SectionHeader } from "@/components/ui/section-header";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  CATALOGUE,
  CATEGORY_LABELS,
  COMING_SOON_CATEGORIES,
  providerBySlug,
  validateSchemaValues,
  type CatalogueProvider,
  type IntegrationCategory,
} from "@/lib/integrations/catalogue";
import {
  INTEGRATIONS_LIVE_FLAG,
  useIntegrationsStore,
  type SavedCredential,
  type TestOutcome,
} from "@/lib/integrations-store";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------- */
/* Configure modal — form auto-rendered from the provider's schema   */
/* ---------------------------------------------------------------- */

interface ConfigureState {
  provider: CatalogueProvider;
  /** id of the credential this save replaces (replace-only editing). */
  replaces?: string;
}

function ConfigureModal({
  state,
  onClose,
}: {
  state: ConfigureState | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const testConnection = useIntegrationsStore((s) => s.testConnection);
  const saveCredential = useIntegrationsStore((s) => s.saveCredential);
  const activate = useIntegrationsStore((s) => s.activate);

  const [values, setValues] = React.useState<Record<string, string>>({});
  const [label, setLabel] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [testing, setTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [test, setTest] = React.useState<TestOutcome | null>(null);

  React.useEffect(() => {
    if (!state) return;
    const defaults: Record<string, string> = {};
    for (const [key, field] of Object.entries(state.provider.configSchema.properties)) {
      if (field.default) defaults[key] = field.default;
    }
    setValues(defaults);
    setLabel("");
    setErrors({});
    setTest(null);
  }, [state]);

  if (!state) return null;
  const { provider } = state;

  const runValidation = () => {
    const nextErrors = validateSchemaValues(provider.configSchema, values);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleTest = async () => {
    if (!runValidation()) return;
    setTesting(true);
    setTest(null);
    try {
      setTest(await testConnection(provider.slug, values));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (thenActivate: boolean) => {
    if (!runValidation()) return;
    setSaving(true);
    try {
      const id = await saveCredential(provider.slug, values, label, test, state.replaces);
      if (thenActivate) {
        const outcome = await activate(id);
        toast(
          outcome.ok
            ? { tone: "success", title: `${provider.brand} is now active`, description: "The previous credentials were kept, deactivated." }
            : { tone: "critical", title: "Saved, but activation failed", description: outcome.detail }
        );
      } else {
        toast({
          tone: "success",
          title: "Credentials saved",
          description: `${provider.brand} saved inactive — activate it when you're ready.`,
        });
      }
      onClose();
    } catch (err) {
      toast({
        tone: "critical",
        title: "Save failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>
            {state.replaces ? `Replace ${provider.brand} credentials` : `Connect ${provider.brand}`}
          </ModalTitle>
          <p className="mt-1 text-body-sm text-fg-secondary">
            Credentials are encrypted with Supabase Vault on save and can never be read back —
            only replaced.
          </p>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <Input
            label="Label (optional)"
            placeholder={`e.g. ${provider.brand} — production`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <SchemaForm
            schema={provider.configSchema}
            values={values}
            onChange={(key, value) => {
              setValues((v) => ({ ...v, [key]: value }));
              setTest(null);
            }}
            errors={errors}
            disabled={saving}
          />
          {test && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-control border px-3.5 py-3 text-body-sm",
                test.ok
                  ? "border-success bg-success-subtle text-success-text"
                  : "border-critical bg-critical-subtle text-critical-text"
              )}
            >
              {test.ok ? (
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
              ) : (
                <XCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              <span>{test.detail}</span>
            </div>
          )}
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-body-sm text-accent-text hover:underline"
          >
            <ExternalLink aria-hidden className="size-3.5" /> {provider.brand} API documentation
          </a>
        </ModalBody>
        <ModalFooter className="flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleTest} loading={testing}>
            <ShieldCheck aria-hidden /> Test connection
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => handleSave(false)} loading={saving}>
            Save only
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave(true)}
            disabled={!test?.ok}
            loading={saving}
            title={test?.ok ? undefined : "Run a passing connection test first"}
          >
            Save &amp; activate
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* Category panel — brand cards + saved credentials                  */
/* ---------------------------------------------------------------- */

function CategoryPanel({
  category,
  credentials,
  onConfigure,
}: {
  category: IntegrationCategory;
  credentials: SavedCredential[];
  onConfigure: (state: ConfigureState) => void;
}) {
  const { toast } = useToast();
  const activate = useIntegrationsStore((s) => s.activate);
  const deactivate = useIntegrationsStore((s) => s.deactivate);
  const providers = CATALOGUE.filter((p) => p.category === category);
  const saved = credentials.filter((c) => c.category === category);
  const activeCredential = saved.find((c) => c.active);

  const handleActivate = async (credential: SavedCredential) => {
    const outcome = await activate(credential.id);
    toast(
      outcome.ok
        ? { tone: "success", title: `${credential.brand} activated` }
        : { tone: "critical", title: "Activation refused", description: outcome.detail }
    );
  };

  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionHeader
          title="Choose a provider"
          description={`Pick the ${CATEGORY_LABELS[category]} brand this organisation sends through — switching later is a form change, not a code change.`}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {providers.map((provider) => {
            const isActive = activeCredential?.providerSlug === provider.slug;
            return (
              <Card key={provider.slug} className={cn(isActive && "border-accent")}>
                <CardBody className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-10 items-center justify-center rounded-control bg-accent-subtle text-body font-semibold text-accent-text">
                      {provider.brand.slice(0, 2)}
                    </span>
                    {isActive && <StatusPill tone="success">Active</StatusPill>}
                  </div>
                  <div>
                    <h3 className="text-body font-semibold text-fg">{provider.brand}</h3>
                    <p className="mt-1 text-body-sm text-fg-muted">
                      {provider.capabilities.filter((c) => c !== "verifyCredentials").join(" · ")}
                    </p>
                  </div>
                  <div className="flex-1" />
                  <Button
                    variant={isActive ? "ghost" : "secondary"}
                    size="sm"
                    onClick={() => onConfigure({ provider })}
                  >
                    <Plug aria-hidden /> {isActive ? "Reconfigure" : "Configure"}
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Saved credentials"
          description="Secrets live in Supabase Vault — masked here, replace-only. Old credentials stay for rollback when you switch."
        />
        {saved.length === 0 ? (
          <EmptyState
            title={`No ${CATEGORY_LABELS[category]} credentials yet`}
            description="Configure a provider above — every save is tested, encrypted and audit-logged."
          />
        ) : (
          <Card>
            <Table>
              <THead>
                <Tr>
                  <Th>Provider</Th>
                  <Th>Credential</Th>
                  <Th>Last test</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {saved.map((credential) => (
                  <Tr key={credential.id}>
                    <Td>
                      <div className="font-medium text-fg">{credential.brand}</div>
                      <div className="text-body-sm text-fg-muted">{credential.label}</div>
                    </Td>
                    <Td className="font-numeric">{credential.masked}</Td>
                    <Td>
                      {credential.lastTestAt ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-body-sm",
                            credential.lastTestOk ? "text-success-text" : "text-critical-text"
                          )}
                        >
                          {credential.lastTestOk ? (
                            <CheckCircle2 aria-hidden className="size-4" />
                          ) : (
                            <XCircle aria-hidden className="size-4" />
                          )}
                          {new Date(credential.lastTestAt).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      ) : (
                        <span className="text-body-sm text-fg-muted">Never</span>
                      )}
                    </Td>
                    <Td>
                      <StatusPill tone={credential.active ? "success" : "neutral"}>
                        {credential.active ? "Active" : "Inactive"}
                      </StatusPill>
                    </Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onConfigure({
                              provider: providerBySlug(credential.providerSlug)!,
                              replaces: credential.id,
                            })
                          }
                        >
                          <RefreshCw aria-hidden /> Replace
                        </Button>
                        {credential.active ? (
                          <Button variant="ghost" size="sm" onClick={() => deactivate(credential.id)}>
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleActivate(credential)}
                            disabled={credential.lastTestOk !== true}
                            title={
                              credential.lastTestOk === true
                                ? undefined
                                : "Requires a passing connection test"
                            }
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function IntegrationsPage() {
  const credentials = useIntegrationsStore((s) => s.credentials);
  const audit = useIntegrationsStore((s) => s.audit);
  const [configure, setConfigure] = React.useState<ConfigureState | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div>
      <PageHeader
        eyebrow="Settings · Super admin"
        title="Integrations"
        description="GUI-configured providers — nothing third-party is hardcoded. Every send resolves the active brand at runtime."
        actions={
          <div className="flex items-center gap-3">
            {!INTEGRATIONS_LIVE_FLAG && <Badge tone="info">Demo mode</Badge>}
            <Link
              href="/settings/integrations/test"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-control border border-edge bg-surface px-3.5 text-body-sm font-medium text-fg shadow-card transition-colors hover:bg-hover"
            >
              <Send aria-hidden className="size-4" /> Send a test
            </Link>
          </div>
        }
      />

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
        </TabsList>
        <TabsContent value="email" className="pt-8">
          <CategoryPanel
            category="email"
            credentials={mounted ? credentials : []}
            onConfigure={setConfigure}
          />
        </TabsContent>
        <TabsContent value="sms" className="pt-8">
          <CategoryPanel
            category="sms"
            credentials={mounted ? credentials : []}
            onConfigure={setConfigure}
          />
        </TabsContent>
      </Tabs>

      <section className="pt-12">
        <SectionHeader
          title="Coming soon"
          description="Registered categories — visible, never half-built (CLAUDE.md rule)."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {COMING_SOON_CATEGORIES.map((category) => (
            <Card key={category.key} className="opacity-70">
              <CardBody>
                <div className="flex items-center justify-between">
                  <h3 className="text-body font-semibold text-fg">{category.label}</h3>
                  <Badge tone="neutral">Coming soon</Badge>
                </div>
                <p className="mt-2 text-body-sm text-fg-muted">{category.brands}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="pt-12">
        <SectionHeader
          title="Recent activity"
          description="Every credential change is written to the audit log."
        />
        {!mounted || audit.length === 0 ? (
          <EmptyState title="No integration changes yet" />
        ) : (
          <Card>
            <CardBody className="flex flex-col gap-0 p-0">
              {audit.slice(0, 8).map((event, index) => (
                <div
                  key={event.id}
                  className={cn(
                    "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4",
                    index > 0 && "border-t border-edge"
                  )}
                >
                  <div>
                    <span className="font-numeric text-body-sm text-fg-muted">{event.action}</span>
                    <p className="text-body text-fg">{event.detail}</p>
                  </div>
                  <span className="font-numeric text-body-sm text-fg-muted">
                    {new Date(event.at).toLocaleString("en-AU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </section>

      <ConfigureModal state={configure} onClose={() => setConfigure(null)} />
    </div>
  );
}
