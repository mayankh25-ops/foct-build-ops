"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

/** Standalone search field for filter bars and list headers. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ label = "Search", className, ...props }, ref) => (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
      />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        className={cn(
          "h-10 w-full rounded-control border border-edge bg-surface pr-3 pl-9 text-body-sm text-fg",
          "placeholder:text-fg-muted transition-colors"
        )}
        {...props}
      />
    </div>
  )
);
SearchInput.displayName = "SearchInput";
