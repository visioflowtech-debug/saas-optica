"use client";

import { useState } from "react";

interface MesVenta {
  mes: string; // "YYYY-MM-DD" (primer día del mes)
  total_ventas: number;
  total_pagado: number;
  total_pendiente: number;
}

// Hex fijos (no ligados a las variables --color-t-green/amber del tema):
// validados contra fondo claro y oscuro con el validador de paleta —
// el mismo par de tonos pasa las seis verificaciones en ambos modos.
const COLOR_PAGADO = "#059669";
const COLOR_PENDIENTE = "#d97706";
const TRACK_H = 200; // alto del área de trazado en px
const GAP = 2; // separador entre segmentos apilados

function niceCeil(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalizado = value / magnitude;
  const niceNormalizado = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
  return niceNormalizado * magnitude;
}

const fmtMes = (dateStr: string) =>
  new Date(dateStr + "T12:00:00Z").toLocaleDateString("es-SV", {
    timeZone: "America/El_Salvador",
    month: "short",
    year: "2-digit",
  });

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(n);
const fmtMoneyCorto = (n: number) =>
  new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function VentasMensualChart({ datos }: { datos: MesVenta[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const maxVentas = Math.max(...datos.map((d) => d.total_ventas), 0);
  const niceMax = niceCeil(maxVentas);

  return (
    <div className="bg-card border border-b-default rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 border-b border-b-subtle bg-a-blue-bg/20 flex items-center justify-between hover:bg-a-blue-bg/30 transition"
        aria-expanded={isOpen}
      >
        <h2 className="text-sm font-semibold text-t-blue uppercase tracking-wider flex items-center gap-2">
          <span>📊</span> Ventas Mensuales — Pagado vs Pendiente
        </h2>
        <span className="text-lg text-t-secondary">{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div className="p-6">
          {/* Leyenda + toggle tabla */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-t-secondary">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_PAGADO }} />
                Pagado
              </span>
              <span className="flex items-center gap-1.5 text-xs text-t-secondary">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_PENDIENTE }} />
                Pendiente
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowTable(!showTable)}
              className="text-xs text-t-muted hover:text-t-primary underline transition"
            >
              {showTable ? "Ver gráfico" : "Ver como tabla"}
            </button>
          </div>

          {showTable ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-b-subtle">
                    <th scope="col" className="text-left py-2 text-t-muted uppercase tracking-wider">Mes</th>
                    <th scope="col" className="text-right py-2 text-t-muted uppercase tracking-wider">Ventas</th>
                    <th scope="col" className="text-right py-2 text-t-muted uppercase tracking-wider">Pagado</th>
                    <th scope="col" className="text-right py-2 text-t-muted uppercase tracking-wider">Pendiente</th>
                    <th scope="col" className="text-right py-2 text-t-muted uppercase tracking-wider">% Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-b-subtle">
                  {datos.map((d) => {
                    const pct = d.total_ventas > 0 ? (d.total_pendiente / d.total_ventas) * 100 : 0;
                    return (
                      <tr key={d.mes}>
                        <td className="py-2 text-t-primary font-medium">{fmtMes(d.mes)}</td>
                        <td className="py-2 text-right text-t-primary font-mono">{fmtMoney(d.total_ventas)}</td>
                        <td className="py-2 text-right font-mono" style={{ color: COLOR_PAGADO }}>{fmtMoney(d.total_pagado)}</td>
                        <td className="py-2 text-right font-mono" style={{ color: COLOR_PENDIENTE }}>{fmtMoney(d.total_pendiente)}</td>
                        <td className="py-2 text-right text-t-muted font-mono">{pct > 0 ? `${pct.toFixed(0)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex gap-3">
              {/* Eje Y */}
              <div
                className="relative shrink-0 text-right pr-2"
                style={{ height: `${TRACK_H}px`, width: "52px" }}
              >
                {[1, 0.5, 0].map((frac) => (
                  <span
                    key={frac}
                    className="absolute text-[10px] text-t-muted -translate-y-1/2"
                    style={{ top: `${(1 - frac) * TRACK_H}px`, right: 0 }}
                  >
                    {fmtMoneyCorto(niceMax * frac)}
                  </span>
                ))}
              </div>

              {/* Área de trazado */}
              <div className="flex-1 relative" style={{ height: `${TRACK_H}px` }}>
                {/* Gridlines */}
                {[1, 0.5, 0].map((frac) => (
                  <div
                    key={frac}
                    className="absolute left-0 right-0 border-t border-b-subtle"
                    style={{ top: `${(1 - frac) * TRACK_H}px` }}
                  />
                ))}

                {/* Barras */}
                <div className="absolute inset-0 flex items-end justify-around">
                  {datos.map((d, idx) => {
                    const pagadoPx = niceMax > 0 ? (d.total_pagado / niceMax) * TRACK_H : 0;
                    const pendientePx = niceMax > 0 ? (d.total_pendiente / niceMax) * TRACK_H : 0;
                    const hayPendiente = d.total_pendiente > 0.01;
                    const pct = d.total_ventas > 0 ? Math.round((d.total_pendiente / d.total_ventas) * 100) : 0;
                    const tooltipAlign = idx === 0 ? "left-0 translate-x-0" : idx === datos.length - 1 ? "right-0 translate-x-0 left-auto" : "left-1/2 -translate-x-1/2";

                    return (
                      <button
                        type="button"
                        key={d.mes}
                        className="relative flex-1 h-full flex flex-col items-center justify-end max-w-[44px] group"
                        onMouseEnter={() => setHoverIdx(idx)}
                        onMouseLeave={() => setHoverIdx(null)}
                        onFocus={() => setHoverIdx(idx)}
                        onBlur={() => setHoverIdx(null)}
                        aria-label={`${fmtMes(d.mes)}: ventas ${fmtMoney(d.total_ventas)}, pagado ${fmtMoney(d.total_pagado)}, pendiente ${fmtMoney(d.total_pendiente)}`}
                      >
                        {/* Etiqueta directa: % pendiente (la métrica que cuenta la historia) */}
                        {hayPendiente && (
                          <span
                            className="absolute text-[10px] font-semibold whitespace-nowrap"
                            style={{ color: COLOR_PENDIENTE, bottom: `${pagadoPx + GAP + pendientePx + 4}px` }}
                          >
                            {pct}%
                          </span>
                        )}

                        {/* Segmento Pendiente (arriba) */}
                        {hayPendiente && (
                          <div
                            className={`absolute w-full ${!hayPendiente ? "" : "rounded-t-[4px]"} transition-opacity`}
                            style={{
                              background: COLOR_PENDIENTE,
                              height: `${Math.max(pendientePx, 2)}px`,
                              bottom: `${pagadoPx + GAP}px`,
                              opacity: hoverIdx === null || hoverIdx === idx ? 1 : 0.45,
                            }}
                          />
                        )}

                        {/* Segmento Pagado (abajo) */}
                        {d.total_pagado > 0 && (
                          <div
                            className={`absolute w-full ${!hayPendiente ? "rounded-t-[4px]" : ""} transition-opacity`}
                            style={{
                              background: COLOR_PAGADO,
                              height: `${Math.max(pagadoPx, 2)}px`,
                              bottom: 0,
                              opacity: hoverIdx === null || hoverIdx === idx ? 1 : 0.45,
                            }}
                          />
                        )}

                        {/* Tooltip */}
                        {hoverIdx === idx && (
                          <div
                            className={`absolute z-10 bottom-full mb-2 w-40 p-3 rounded-lg bg-sidebar border border-b-default shadow-[0_8px_24px_rgba(0,0,0,0.25)] text-left ${tooltipAlign}`}
                          >
                            <p className="text-xs font-semibold text-t-primary mb-1.5 capitalize">{fmtMes(d.mes)}</p>
                            <p className="text-[11px] text-t-muted flex justify-between gap-2">
                              <span>Ventas</span><span className="font-mono text-t-primary">{fmtMoney(d.total_ventas)}</span>
                            </p>
                            <p className="text-[11px] flex justify-between gap-2">
                              <span className="flex items-center gap-1 text-t-muted"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_PAGADO }} />Pagado</span>
                              <span className="font-mono" style={{ color: COLOR_PAGADO }}>{fmtMoney(d.total_pagado)}</span>
                            </p>
                            <p className="text-[11px] flex justify-between gap-2">
                              <span className="flex items-center gap-1 text-t-muted"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_PENDIENTE }} />Pendiente</span>
                              <span className="font-mono" style={{ color: COLOR_PENDIENTE }}>{fmtMoney(d.total_pendiente)}</span>
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Eje X */}
          {!showTable && (
            <div className="flex gap-3 mt-2">
              <div className="shrink-0" style={{ width: "52px" }} />
              <div className="flex-1 flex items-start justify-around">
                {datos.map((d) => (
                  <span key={d.mes} className="flex-1 max-w-[44px] text-center text-[10px] text-t-muted capitalize">
                    {fmtMes(d.mes)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
