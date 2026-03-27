"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition, useState, useEffect, useRef } from "react";

interface Props {
  defaultValue: string;
  total: number;
}

export default function ExamenesSearch({ defaultValue, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (value.trim()) params.set("q", value.trim());
        const qs = params.toString();
        router.push(`${pathname}${qs ? `?${qs}` : ""}`);
      });
    }, 380);
    return () => clearTimeout(timer);
  }, [value, pathname, router]);

  const handleClear = () => {
    setValue("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-t-muted pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar por nombre de paciente..."
          aria-label="Buscar exámenes"
          className="w-full pl-10 pr-10 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-base sm:text-sm"
        />
        {isPending ? (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-t-muted animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </span>
        ) : value ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpiar búsqueda"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-t-muted/20 hover:bg-t-muted/40 text-t-muted hover:text-t-primary transition"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
      <span className="hidden sm:block text-sm text-t-muted whitespace-nowrap shrink-0">
        {total} examen{total !== 1 ? "es" : ""}
      </span>
    </div>
  );
}
