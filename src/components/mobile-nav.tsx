"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/(auth)/actions";
import { SucursalSwitcher } from "@/components/sucursal-switcher";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface Sucursal {
  id: string;
  nombre: string;
  activa: boolean;
}

interface Props {
  navItems: NavItem[];
  nombre: string;
  rol: string;
  sucursalNombre: string;
  sucursales: Sucursal[];
  sucursalActualId: string;
}

export default function MobileNav({ navItems, nombre, rol, sucursalNombre, sucursales, sucursalActualId }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Move focus into drawer when it opens (ARIA dialog requirement)
  useEffect(() => {
    if (open && drawerRef.current) {
      const firstFocusable = drawerRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [open]);

  return (
    /* Clase mobile-nav-wrapper usa @media min-width tradicional (compatible Chrome < 113 / Honor) */
    <div className="shrink-0 mobile-nav-wrapper">
      {/* Top bar — sticky so it's always visible even if content scrolls */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-b-default"
        style={{ background: "var(--bg-sidebar)" }}
      >
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Óptica Nueva Imagen
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sucursalNombre}</p>
        </div>

        {/* Hamburger button — hardcoded color, no CSS var dependency for visibility */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center rounded-lg"
          style={{
            minHeight: 44,
            minWidth: 44,
            color: "#475569",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
          aria-label="Abrir menú"
          aria-expanded={open}
          aria-controls="mobile-drawer"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer — fixed so it escapes the wrapper div */}
      <div
        id="mobile-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-default)",
          willChange: "transform",
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="flex-1 min-w-0 mr-2">
            <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Óptica Nueva Imagen
            </p>
            <SucursalSwitcher
              sucursales={sucursales}
              sucursalActualId={sucursalActualId}
              sucursalActualNombre={sucursalNombre}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center rounded-lg"
            style={{
              minHeight: 44,
              minWidth: 44,
              color: "#94a3b8",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
            aria-label="Cerrar menú"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-3 text-sm rounded-lg transition-colors"
                style={{
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  background: isActive ? "var(--bg-card-hover)" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span className="text-lg" aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div
          className="p-4"
          style={{ borderTop: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: "var(--gradient-avatar)" }}
            >
              {nombre.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {nombre}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{rol}</p>
            </div>
          </div>
          <form>
            <button
              formAction={signout}
              type="submit"
              className="w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left"
              style={{
                color: "var(--text-muted)",
                minHeight: 44,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
