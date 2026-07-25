"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

type ToastTone = "success" | "warning" | "critical" | "neutral";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (t: Omit<ToastItem, "id">) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const icons: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 aria-hidden className="size-4 text-success" />,
  warning: <AlertTriangle aria-hidden className="size-4 text-warning" />,
  critical: <XCircle aria-hidden className="size-4 text-critical" />,
  neutral: null,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);

  const toast = React.useCallback((t: Omit<ToastItem, "id">) => {
    setItems((prev) => [...prev, { ...t, id: nextId.current++ }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((i) => i.id !== item.id));
            }}
            className="flex items-start gap-3 rounded-card border border-edge bg-raised p-4 shadow-raised"
          >
            {icons[item.tone]}
            <div className="flex-1">
              <ToastPrimitive.Title className="text-body-sm font-medium text-fg">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="mt-0.5 text-body-sm text-fg-muted">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="rounded-sm p-0.5 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
            >
              <X aria-hidden className="size-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport
          className="fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
