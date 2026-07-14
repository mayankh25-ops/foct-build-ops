"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ProviderConfigSchema } from "@/lib/integrations/catalogue";

/**
 * SchemaForm — renders a credential form straight from a provider's JSON
 * Schema (integration_providers.config_schema). Field order comes from
 * x-field-order; x-secret fields render as password inputs with a reveal
 * toggle. Adding a provider to the catalogue needs NO new form code.
 */
export interface SchemaFormProps {
  schema: ProviderConfigSchema;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function SchemaForm({ schema, values, onChange, errors, disabled }: SchemaFormProps) {
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      {schema["x-field-order"].map((key) => {
        const field = schema.properties[key];
        if (!field) return null;
        const required = schema.required.includes(key);
        const label = required ? field.title : `${field.title} (optional)`;
        const value = values[key] ?? field.default ?? "";
        const error = errors?.[key];

        if (field.enum) {
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <Select
                label={label}
                options={field.enum.map((option) => ({ value: option, label: option }))}
                value={value}
                onValueChange={(next) => onChange(key, next)}
                disabled={disabled}
              />
              {field.description && (
                <p className="text-body-sm text-fg-muted">{field.description}</p>
              )}
              {error && <p className="text-body-sm text-critical-text">{error}</p>}
            </div>
          );
        }

        if (field["x-secret"]) {
          const show = revealed[key] ?? false;
          return (
            <div key={key} className="relative">
              <Input
                label={label}
                type={show ? "text" : "password"}
                autoComplete="off"
                value={value}
                onChange={(e) => onChange(key, e.target.value)}
                hint={field.description}
                error={error}
                disabled={disabled}
                className="pr-11"
              />
              <button
                type="button"
                aria-label={show ? "Hide secret" : "Show secret"}
                onClick={() => setRevealed((r) => ({ ...r, [key]: !show }))}
                className="absolute top-[34px] right-3 rounded-sm p-1 text-fg-muted transition-colors hover:text-fg"
              >
                {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
              </button>
            </div>
          );
        }

        return (
          <Input
            key={key}
            label={label}
            type={field.format === "email" ? "email" : "text"}
            value={value}
            onChange={(e) => onChange(key, e.target.value)}
            hint={field.description}
            error={error}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}
