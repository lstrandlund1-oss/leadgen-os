"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const duration = toast.duration ?? 3500;
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id, toast.duration, onRemove]);

  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    info: "◈",
    warning: "⚠",
  };

  const styles: Record<ToastType, string> = {
    success: "border-emerald-500/30 bg-[#0a1a0f] text-emerald-300",
    error: "border-rose-500/30 bg-[#1a0a0a] text-rose-300",
    info: "border-[rgba(201,168,76,0.3)] bg-[#12100a] text-[#c9a84c]",
    warning: "border-amber-500/30 bg-[#1a1200] text-amber-300",
  };

  const iconStyles: Record<ToastType, string> = {
    success: "text-emerald-400",
    error: "text-rose-400",
    info: "text-[#c9a84c]",
    warning: "text-amber-400",
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl shadow-black/50 text-[13px] max-w-sm w-full transition-all duration-300 ${styles[toast.type]} ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <span className={`text-[12px] mt-0.5 font-bold shrink-0 ${iconStyles[toast.type]}`}>
        {icons[toast.type]}
      </span>
      <span className="text-[#d0c8b8] leading-snug flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }}
        className="text-[#444] hover:text-[#888] transition-colors text-[11px] shrink-0 mt-0.5"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: import("react").ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration?: number) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
  }, []);

  const success = useCallback((message: string) => toast(message, "success"), [toast]);
  const error = useCallback((message: string) => toast(message, "error", 5000), [toast]);
  const info = useCallback((message: string) => toast(message, "info"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      {/* Toast container — bottom right */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
