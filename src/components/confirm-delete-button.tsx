"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  onConfirm: () => Promise<{ error?: string; success?: boolean; redirectTo?: string }>;
  label?: string;
  confirmText?: string;
  className?: string;
}

export function ConfirmDeleteButton({
  onConfirm,
  label = "Eliminar",
  confirmText = "¿Estás seguro? Esta acción no se puede deshacer.",
  className,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function handleClick() {
    setShowConfirm(true);
  }

  function handleCancel() {
    setShowConfirm(false);
    setError("");
  }

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      const result = await onConfirm();
      if (result.error) {
        setError(result.error);
        setShowConfirm(false);
      } else if (result.redirectTo) {
        router.push(result.redirectTo);
      } else {
        setShowConfirm(false);
        router.refresh();
      }
    });
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div
          className="w-full max-w-sm p-6 rounded-2xl shadow-2xl space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)" }}
        >
          <h3 className="text-base font-bold text-t-primary">Confirmar eliminación</h3>
          <p className="text-sm text-t-muted">{confirmText}</p>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">{error}</p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="px-4 py-2 text-sm text-t-muted border border-b-default rounded-lg hover:text-t-primary transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition disabled:opacity-50"
            >
              {isPending ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={
        className ??
        "px-3 py-1.5 text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
      }
    >
      {label}
    </button>
  );
}
