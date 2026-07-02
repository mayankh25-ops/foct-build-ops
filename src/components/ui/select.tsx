"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function Select({
  label,
  placeholder = "Select…",
  options,
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
}: SelectProps) {
  const id = React.useId();
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-body-sm font-medium text-fg">
          {label}
        </label>
      )}
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          id={id}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-control border border-edge-strong",
            "bg-surface px-3 text-body text-fg transition-colors duration-150",
            "data-[placeholder]:text-fg-muted",
            "disabled:cursor-not-allowed disabled:bg-hover disabled:text-fg-disabled"
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown aria-hidden className="size-4 text-fg-muted" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        {/* No portal: content stays inside the data-theme scope that opened it. */}
        <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className={cn(
              "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-control",
              "border border-edge bg-raised shadow-raised"
            )}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={cn(
                    "flex cursor-default items-center justify-between gap-2 rounded-sm px-2.5 py-2",
                    "text-body text-fg outline-none",
                    "data-[highlighted]:bg-hover data-[disabled]:text-fg-disabled"
                  )}
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check aria-hidden className="size-4 text-accent-text" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
      </SelectPrimitive.Root>
    </div>
  );
}
