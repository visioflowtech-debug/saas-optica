"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/(auth)/actions";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface Props {
  navItems: NavItem[];
  nombre: string;
  rol: string;
  sucursalNombre: string;
}

export default function MobileNav({ navItems, nombre, rol, sucursalNombre }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Top bar — mobile only */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3 border-b border-b-default shrink-0"
        style={{ background: "var(--bg-sidebar)" }}
      >
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Óptica Nueva Imagen
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sucursalNombre}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center min-h-11 min-w-[44px] rounded-lg transition-colors"
          style={{ color: "var(--text-secondary, #475569)", touchAction: "manipulation" }}
          aria-label="Abrir menú"
          aria-expanded={open}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col md:hidden transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-default)",
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div>
            <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Óptica Nueva Imagen
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sucursalNombre}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center min-h-11 min-w-[44px] rounded-lg"
            style={{ color: "var(--text-muted, #94a3b8)", touchAction: "manipulation" }}
            aria-label="Cerrar menú"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
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
                }}
              >
                <span className="text-lg">{item.icon}</span>
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
              className="w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left"
              style={{ color: "var(--text-muted)" }}
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
