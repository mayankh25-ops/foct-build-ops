/**
 * Integration credential handling. Two properties matter more than the rest:
 * a secret must never be classified as ordinary config (it would be stored
 * unencrypted and readable back), and validation must reject a malformed key
 * before it is written to Vault where nobody can inspect it again.
 */
import { describe, expect, it } from "vitest";
import {
  CATALOGUE,
  maskValue,
  providerBySlug,
  secretFieldKeys,
  splitSecretValues,
  validateSchemaValues,
} from "@/lib/integrations/catalogue";

describe("catalogue integrity", () => {
  it("has a unique slug and a renderable schema for every provider", () => {
    const slugs = CATALOGUE.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const p of CATALOGUE) {
      expect(p.configSchema["x-field-order"].length).toBeGreaterThan(0);
      for (const key of p.configSchema["x-field-order"]) {
        expect(p.configSchema.properties[key], `${p.slug}.${key} has no field`).toBeDefined();
      }
      for (const key of p.configSchema.required) {
        expect(p.configSchema.properties[key], `${p.slug} requires unknown ${key}`).toBeDefined();
      }
    }
  });

  it("marks at least one secret field on every provider that takes a credential", () => {
    for (const p of CATALOGUE) {
      expect(secretFieldKeys(p.configSchema).length, `${p.slug} has no secret field`).toBeGreaterThan(0);
    }
  });

  it("resolves providers by slug and returns undefined for an unknown one", () => {
    expect(providerBySlug(CATALOGUE[0]!.slug)?.slug).toBe(CATALOGUE[0]!.slug);
    expect(providerBySlug("not-a-provider")).toBeUndefined();
  });
});

describe("splitSecretValues", () => {
  it("routes every secret field to `secrets` and never to `config`", () => {
    for (const p of CATALOGUE) {
      const values = Object.fromEntries(
        p.configSchema["x-field-order"].map((k) => [k, `value-for-${k}`])
      );
      const { config, secrets } = splitSecretValues(p.configSchema, values);
      for (const key of secretFieldKeys(p.configSchema)) {
        expect(secrets[key], `${p.slug}.${key} missing from secrets`).toBeDefined();
        expect(config[key], `${p.slug}.${key} leaked into config`).toBeUndefined();
      }
    }
  });

  it("drops empty values so a blank field never overwrites a stored secret", () => {
    const schema = CATALOGUE[0]!.configSchema;
    const { config, secrets } = splitSecretValues(schema, { [schema["x-field-order"][0]!]: "" });
    expect(Object.keys(config)).toHaveLength(0);
    expect(Object.keys(secrets)).toHaveLength(0);
  });
});

describe("validateSchemaValues", () => {
  const resend = providerBySlug("resend")!;

  it("requires the fields the provider marks required", () => {
    const errors = validateSchemaValues(resend.configSchema, {});
    for (const key of resend.configSchema.required) {
      expect(errors[key], `${key} should be required`).toBeDefined();
    }
  });

  it("rejects an API key that doesn't match the provider's documented shape", () => {
    const [firstRequired] = resend.configSchema.required;
    const field = resend.configSchema.properties[firstRequired!]!;
    if (!field.pattern) return; // provider has no pattern to violate
    const errors = validateSchemaValues(resend.configSchema, { [firstRequired!]: "obviously-wrong" });
    expect(errors[firstRequired!]).toBeDefined();
  });

  it("rejects a malformed email in an email-format field", () => {
    const emailKey = Object.entries(resend.configSchema.properties).find(
      ([, f]) => f.format === "email"
    )?.[0];
    if (!emailKey) return;
    expect(validateSchemaValues(resend.configSchema, { [emailKey]: "not-an-email" })[emailKey]).toBeDefined();
    expect(
      validateSchemaValues(resend.configSchema, { [emailKey]: "alerts@aurora.example" })[emailKey]
    ).toBeUndefined();
  });
});

describe("maskValue", () => {
  it("shows only the last four characters", () => {
    expect(maskValue("re_supersecret_abcd")).toBe("•••• abcd");
    expect(maskValue("re_supersecret_abcd")).not.toContain("supersecret");
  });
});
