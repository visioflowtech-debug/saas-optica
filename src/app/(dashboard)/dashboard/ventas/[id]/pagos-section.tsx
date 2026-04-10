"use client";

import { useState, useTransition } from "react";
import { registrarPago } from "../actions";
import { fmtFechaCorta } from "@/lib/date-sv";

interface Pago {
  id: string;
  monto: number;
  metodo_pago: string;
  referencia: string | null;
  notas: string | null;
  created_at: string;
}

interface CuentaOpcion {
  id: string;
  nombre: string;
  tipo: string;
}

interface Props {
  ordenId: string;
  totalOrden: number;
  pagos: Pago[];
  cuentas: CuentaOpcion[];
}

const METODOS_PAGO = [
  { value: "efectivo", label: "💵 Efectivo" },
  { value: "tarjeta", label: "💳 Tarjeta" },
  { value: "transferencia", label: "🏦 Transferencia" },
  { value: "cheque", label: "📝 Cheque" },
];

export default function PagosSection({ ordenId, totalOrden, pagos: initialPagos, cuentas }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");

  const totalAbonado = initialPagos.reduce((s, p) => s + Number(p.monto), 0);
  const saldo = totalOrden - totalAbonado;
  const porcentaje = totalOrden > 0 ? Math.min((totalAbonado / totalOrden) * 100, 100) : 0;

  const fmtCurrency = (val: number) =>
    new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(val);

  const handleSubmit = () => {
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) { setError("Ingresa un monto válido"); return; }
    if (montoNum > saldo + 0.01) { setError("El monto excede el saldo pendiente"); return; }

    setError("");
    startTransition(async () => {
      try {
        await registrarPago(ordenId, montoNum, metodo, referencia || undefined, notas || undefined, cuentaId || undefined);
        setMonto("");
        setReferencia("");
        setNotas("");
        setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al registrar pago");
      }
    });
  };

  return (
    <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-t-primary uppercase tracking-wider">Pagos / Abonos</h2>
        {saldo > 0.01 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-xs font-medium bg-a-green-bg text-t-green border border-a-green-border rounded-lg hover:opacity-80 transition"
          >
            {showForm ? "✕ Cerrar" : "+ Registrar Abono"}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-t-muted">Abonado: <span className="font-medium text-t-green">{fmtCurrency(totalAbonado)}</span></span>
          <span className="text-t-muted">Saldo: <span className={`font-medium ${saldo <= 0.01 ? "text-t-green" : "text-t-amber"}`}>{fmtCurrency(Math.max(saldo, 0))}</span></span>
        </div>
        <div className="w-full h-2.5 bg-input rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${saldo <= 0.01 ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-1">
          <span className="text-t-muted">{porcentaje.toFixed(0)}% pagado</span>
          <span className="text-t-muted">Total: {fmtCurrency(totalOrden)}</span>
        </div>
      </div>

      {/* New payment form */}
      {showForm && (
        <div className="p-4 bg-input/30 border border-b-subtle rounded-xl mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Monto *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={saldo}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder={`Max: ${saldo.toFixed(2)}`}
                className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Método</label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          {cuentas.length > 0 && (
            <div>
              <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Cuenta destino</label>
              <select
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-medium text-t-muted uppercase tracking-wider mb-1">Referencia (opcional)</label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="N° recibo, transferencia, etc."
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
          {error && <p className="text-xs text-t-red">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
            >
              {isPending ? "Registrando..." : `Registrar ${monto ? fmtCurrency(parseFloat(monto) || 0) : ""}`}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(""); }}
              className="px-4 py-2 text-t-muted text-sm hover:text-t-primary transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Payment history */}
      {initialPagos.length > 0 ? (
        <div className="divide-y divide-b-subtle">
          {initialPagos.map((p) => {
            const metodLabel = METODOS_PAGO.find(m => m.value === p.metodo_pago)?.label ?? p.metodo_pago;
            return (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm text-t-primary font-medium">{fmtCurrency(Number(p.monto))}</span>
                  <span className="text-xs text-t-muted ml-2">{metodLabel}</span>
                  {p.referencia && <span className="text-xs text-t-muted ml-2">· {p.referencia}</span>}
                </div>
                <span className="text-xs text-t-muted">
                  {fmtFechaCorta(p.created_at)}
                  {" "}
                  {new Date(p.created_at).toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-t-muted text-center py-2">No se han registrado pagos aún</p>
      )}

      {/* Paid in full badge */}
      {saldo <= 0.01 && totalAbonado > 0 && (
        <div className="mt-3 p-2 bg-a-green-bg border border-a-green-border rounded-lg text-center">
          <span className="text-xs font-medium text-t-green">✓ Pagado en su totalidad</span>
        </div>
      )}
    </div>
  );
}
