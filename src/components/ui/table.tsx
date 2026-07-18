import * as React from "react";
import { cn } from "@/lib/cn";

export function Table({
  className,
  sticky,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & {
  /** Long tables: cap height and keep the header row pinned while scrolling. */
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-card border border-edge bg-surface shadow-card",
        sticky && "max-h-[65vh] overflow-y-auto"
      )}
    >
      <table
        className={cn(
          "w-full caption-bottom text-body-sm",
          sticky && "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-surface",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-edge", className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-edge", className)} {...props} />;
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-hover", className)} {...props} />;
}

export function Th({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "h-11 px-6 py-3 text-left align-middle text-caption font-semibold tracking-[0.05em] text-fg-secondary uppercase",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "h-14 px-6 py-3.5 align-middle text-body-sm text-fg",
        numeric && "text-right font-numeric tabular-nums",
        className
      )}
      {...props}
    />
  );
}
