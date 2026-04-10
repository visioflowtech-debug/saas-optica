"use client";

import { useState, useTransition } from "react";
import { configurarCuenta, crearCuentaNueva, transferirEntreCuentas, registrarIngresoCuenta, obtenerMovimientos } from "./actions";
import type { CuentaInfo, Movimiento } from "./actions";

function formatCLP(n: number) {
  return n.toLocaleString("es-SV", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function tipoColor(tipo: string) {
  if (tipo === "ingreso" || tipo === "transferencia_in" || tipo === "ingreso_manual") return "text-green-600 dark:text-green-400";
  if (tipo === "egreso" || tipo === "transferencia_out") return "text-red-500 dark:text-red-400";
  return "text-blue-500";
}

function badgeCuenta(tipo: string) {
  if (tipo === "efectivo") return "bg-green-500/15 text-green-600 dark:text-green-400";
  if (tipo === "banco") return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
  return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
}

function labelTipo(tipo: string) {
  if (tipo === "efectivo") return "Efectivo";
  if (tipo === "banco") return "Banco";
  return tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

function tipoLabel(tipo: string) {
  const map: Record<string, string> = {
    ingreso: "Ingreso",
    egreso: "Egreso",
    ingreso_manual: "Ingreso Manual",
    transferencia_in: "Transferencia entrada",
    transferencia_out: "Transferencia salida",
    ajuste_inicial: "Saldo inicial",
  };
  return map[tipo] ?? tipo;
}

function tipoSigno(tipo: string) {
  return tipo === "ingreso" || tipo === "transferencia_in" || tipo === "ajuste_inicial" ? "+" : "−";
}

// ── Modal: Nueva Cuenta (tipo libre) ───────────────────────
function ModalNuevaCuenta({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(fd: FormData) {
    const nombre = (fd.get("nombre") as string).trim();
    const tipo = (fd.get("tipo") as string).trim();
    const saldo = parseFloat(fd.get("saldo_inicial") as string) || 0;
    setError(null);
    start(async () => {
      const res = await crearCuentaNueva(nombre, tipo, saldo);
      if (res?.error) { setError(res.error); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-b-default rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-bold text-t-primary">Nueva Cuenta</h2>
        {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
        <form className="space-y-4" action={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Nombre *</label>
            <input name="nombre" type="text" required placeholder="Ej: Caja Campaña, Cuenta Promerica..."
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Tipo</label>
            <select name="tipo" className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="efectivo">Efectivo</option>
              <option value="banco">Banco</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Saldo inicial ($)</label>
            <input name="saldo_inicial" type="number" min="0" step="0.01" defaultValue={0}
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-t-muted hover:text-t-primary border border-b-default rounded-lg transition">
              Cancelar
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 px-4 py-2 bg-[var(--accent-blue)] hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60">
              {pending ? "Creando..." : "Crear Cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Registrar Ingreso ────────────────────────────────
function ModalIngreso({ cuenta, onClose }: { cuenta: CuentaInfo; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(fd: FormData) {
    const monto = parseFloat(fd.get("monto") as string);
    const descripcion = (fd.get("descripcion") as string)?.trim() || "Ingreso manual";
    setError(null);
    start(async () => {
      const res = await registrarIngresoCuenta(cuenta.id, monto, descripcion);
      if (res?.error) { setError(res.error); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-b-default rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-bold text-t-primary">Registrar Ingreso</h2>
        <p className="text-sm text-t-muted">Cuenta: <span className="font-semibold text-t-primary">{cuenta.nombre}</span></p>
        {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
        <form className="space-y-4" action={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Monto ($) *</label>
            <input name="monto" type="number" min="0.01" step="0.01" required placeholder="0.00"
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Descripción *</label>
            <input name="descripcion" type="text" required placeholder="Ej: Cobro servicio, Ingreso campaña..."
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-t-muted hover:text-t-primary border border-b-default rounded-lg transition">
              Cancelar
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60">
              {pending ? "Registrando..." : "Registrar Ingreso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Configurar cuenta ────────────────────────────────
function ModalConfigurar({
  cuenta,
  esNueva,
  onClose,
}: {
  cuenta: { tipo: "efectivo" | "banco"; nombre: string; saldo_inicial: number } | null;
  esNueva: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(fd: FormData) {
    const tipo = fd.get("tipo") as "efectivo" | "banco";
    const nombre = (fd.get("nombre") as string).trim();
    const saldo = parseFloat(fd.get("saldo_inicial") as string) || 0;
    setError(null);
    start(async () => {
      const res = await configurarCuenta(tipo, nombre, saldo);
      if (res?.error) { setError(res.error); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-b-default rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-bold text-t-primary">
          {esNueva ? "Configurar cuenta" : "Editar cuenta"}
        </h2>

        {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

        <form className="space-y-4" action={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Tipo de cuenta</label>
            {/* Deshabilitado en edición para evitar crear una cuenta nueva por cambio de tipo */}
            <select name="tipo" defaultValue={cuenta?.tipo ?? "efectivo"}
              disabled={!esNueva}
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed">
              <option value="efectivo">Efectivo</option>
              <option value="banco">Banco</option>
            </select>
            {/* Campo hidden para que FormData siempre incluya el tipo aunque el select esté disabled */}
            {!esNueva && <input type="hidden" name="tipo" value={cuenta?.tipo ?? "efectivo"} />}
          </div>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Nombre</label>
            <input name="nombre" type="text" required defaultValue={cuenta?.nombre ?? ""}
              placeholder="Ej: Caja principal, Cuenta Agrícola..."
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Saldo inicial ($)</label>
            <input name="saldo_inicial" type="number" min="0" step="0.01"
              defaultValue={cuenta?.saldo_inicial ?? 0}
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-t-muted mt-1">El saldo real se calculará sumando movimientos posteriores.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-t-muted hover:text-t-primary border border-b-default rounded-lg transition">
              Cancelar
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 px-4 py-2 bg-[var(--accent-blue)] hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60">
              {pending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Transferencia ────────────────────────────────────
function ModalTransferencia({
  cuentas,
  onClose,
}: {
  cuentas: CuentaInfo[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(fd: FormData) {
    const origen = fd.get("origen") as string;
    const destino = fd.get("destino") as string;
    const monto = parseFloat(fd.get("monto") as string);
    const desc = (fd.get("descripcion") as string)?.trim() || undefined;
    setError(null);
    start(async () => {
      const res = await transferirEntreCuentas(origen, destino, monto, desc);
      if (res?.error) { setError(res.error); return; }
      onClose();
    });
  }

  if (cuentas.length < 2) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-b-default rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
          <p className="text-t-secondary text-sm">Necesitas al menos dos cuentas configuradas para hacer una transferencia.</p>
          <button onClick={onClose} className="w-full px-4 py-2 border border-b-default rounded-lg text-sm text-t-muted hover:text-t-primary">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-b-default rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-lg font-bold text-t-primary">Transferencia entre cuentas</h2>

        {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

        <form className="space-y-4" action={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Cuenta origen</label>
            <select name="origen" className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500">
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} — {formatCLP(c.saldo_actual)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Cuenta destino</label>
            <select name="destino" className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[...cuentas].reverse().map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} — {formatCLP(c.saldo_actual)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Monto ($)</label>
            <input name="monto" type="number" min="0.01" step="0.01" required placeholder="0.00"
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1">Descripción (opcional)</label>
            <input name="descripcion" type="text" placeholder="Ej: Depósito al banco del efectivo del día"
              className="w-full px-3 py-2 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-t-muted hover:text-t-primary border border-b-default rounded-lg transition">
              Cancelar
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 px-4 py-2 bg-[var(--accent-blue)] hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60">
              {pending ? "Transfiriendo..." : "Transferir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Panel historial de una cuenta ──────────────────────────
function HistorialCuenta({ cuenta }: { cuenta: CuentaInfo }) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargado, setCargado] = useState(false);
  const [loading, setLoading] = useState(false);

  async function cargar(p: number) {
    setLoading(true);
    const res = await obtenerMovimientos(cuenta.id, p);
    setMovimientos(res.movimientos);
    setTotal(res.total);
    setPagina(p);
    setCargado(true);
    setLoading(false);
  }

  const totalPaginas = Math.ceil(total / 30);

  return (
    <div className="space-y-3">
      {!cargado && (
        <button onClick={() => cargar(1)}
          className="w-full py-2 text-sm text-[var(--accent-blue)] hover:underline">
          Ver historial de movimientos
        </button>
      )}

      {loading && <p className="text-sm text-t-muted text-center py-4">Cargando...</p>}

      {cargado && !loading && (
        <>
          {movimientos.length === 0 && (
            <p className="text-sm text-t-muted text-center py-4">Sin movimientos aún.</p>
          )}
          <div className="divide-y divide-b-subtle">
            {movimientos.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-t-primary truncate">{m.descripcion || tipoLabel(m.tipo)}</p>
                  <p className="text-xs text-t-muted">{tipoLabel(m.tipo)} · {new Date(m.created_at).toLocaleDateString("es-SV")}</p>
                </div>
                <span className={`text-sm font-semibold ml-4 shrink-0 ${tipoColor(m.tipo)}`}>
                  {tipoSigno(m.tipo)}{formatCLP(Number(m.monto))}
                </span>
              </div>
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button disabled={pagina <= 1} onClick={() => cargar(pagina - 1)}
                className="text-xs text-t-muted hover:text-t-primary disabled:opacity-40">
                ← Anterior
              </button>
              <span className="text-xs text-t-muted">Página {pagina} de {totalPaginas}</span>
              <button disabled={pagina >= totalPaginas} onClick={() => cargar(pagina + 1)}
                className="text-xs text-t-muted hover:text-t-primary disabled:opacity-40">
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Card de cuenta ─────────────────────────────────────────
function CuentaCard({
  cuenta,
  onEditar,
  onIngreso,
}: {
  cuenta: CuentaInfo;
  onEditar: (c: CuentaInfo) => void;
  onIngreso: (c: CuentaInfo) => void;
}) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCuenta(cuenta.tipo)}`}>
                {labelTipo(cuenta.tipo)}
              </span>
            </div>
            <h3 className="text-base font-bold text-t-primary">{cuenta.nombre}</h3>
            <p className="text-2xl font-extrabold text-t-primary mt-1">{formatCLP(cuenta.saldo_actual)}</p>
            <p className="text-xs text-t-muted mt-0.5">Saldo inicial: {formatCLP(cuenta.saldo_inicial)}</p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={() => onIngreso(cuenta)}
              className="text-xs text-green-700 dark:text-green-400 hover:opacity-80 border border-green-500/40 bg-green-500/10 px-3 py-1.5 rounded-lg transition">
              + Ingreso
            </button>
            <button onClick={() => onEditar(cuenta)}
              className="text-xs text-t-muted hover:text-t-primary border border-b-default px-3 py-1.5 rounded-lg transition">
              Editar
            </button>
          </div>
        </div>

        <button onClick={() => setExpandido(!expandido)}
          className="mt-4 w-full text-left text-sm text-t-muted hover:text-t-primary flex items-center gap-1 transition">
          <span>{expandido ? "▲" : "▼"}</span>
          <span>Historial de movimientos</span>
        </button>
      </div>

      {expandido && (
        <div className="border-t border-b-subtle px-5 pb-5 pt-3">
          <HistorialCuenta cuenta={cuenta} />
        </div>
      )}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────
export default function CuentasClient({ cuentasIniciales }: { cuentasIniciales: CuentaInfo[] }) {
  const [cuentas, setCuentas] = useState(cuentasIniciales);
  const [modalConfigurar, setModalConfigurar] = useState<{ tipo: string; nombre: string; saldo_inicial: number } | null | undefined>(undefined);
  const [modalEsNueva, setModalEsNueva] = useState(false);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [modalNuevaCuenta, setModalNuevaCuenta] = useState(false);
  const [modalIngreso, setModalIngreso] = useState<CuentaInfo | null>(null);

  // undefined = cerrado, object = abierto (nuevo o editando según modalEsNueva)
  const modalAbierto = modalConfigurar !== undefined;

  function handleEditar(c: CuentaInfo) {
    setModalEsNueva(false);
    setModalConfigurar({ tipo: c.tipo, nombre: c.nombre, saldo_inicial: c.saldo_inicial });
  }

  function handleCerrarModal() {
    setModalConfigurar(undefined);
    window.location.reload();
  }

  function handleCerrarTransferencia() {
    setModalTransferencia(false);
    window.location.reload();
  }

  const tieneEfectivo = cuentas.some((c) => c.tipo === "efectivo");
  const tieneBanco = cuentas.some((c) => c.tipo === "banco");

  return (
    <div className="space-y-6">
      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        {!tieneEfectivo && (
          <button
            onClick={() => { setModalEsNueva(true); setModalConfigurar({ tipo: "efectivo", nombre: "Caja Efectivo", saldo_inicial: 0 }); }}
            className="px-4 py-2 bg-green-500/15 hover:bg-green-500/25 text-green-700 dark:text-green-400 text-sm font-semibold rounded-lg border border-green-500/30 transition">
            + Configurar Efectivo
          </button>
        )}
        {!tieneBanco && (
          <button
            onClick={() => { setModalEsNueva(true); setModalConfigurar({ tipo: "banco", nombre: "Cuenta Bancaria", saldo_inicial: 0 }); }}
            className="px-4 py-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 dark:text-blue-400 text-sm font-semibold rounded-lg border border-blue-500/30 transition">
            + Configurar Banco
          </button>
        )}
        <button
          onClick={() => setModalNuevaCuenta(true)}
          className="px-4 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-400 text-sm font-semibold rounded-lg border border-purple-500/30 transition">
          + Nueva Cuenta
        </button>
        {cuentas.length >= 2 && (
          <button
            onClick={() => setModalTransferencia(true)}
            className="px-4 py-2 bg-[var(--accent-blue)] hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition">
            Transferir entre cuentas
          </button>
        )}
      </div>

      {/* Cards */}
      {cuentas.length === 0 && (
        <div className="text-center py-16 text-t-muted">
          <p className="text-lg font-medium">Sin cuentas configuradas</p>
          <p className="text-sm mt-1">Configura tu cuenta de efectivo y banco, o crea una cuenta personalizada.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {cuentas.map((c) => (
          <CuentaCard key={c.id} cuenta={c} onEditar={handleEditar} onIngreso={setModalIngreso} />
        ))}
      </div>

      {/* Modales */}
      {modalAbierto && (
        <ModalConfigurar
          cuenta={modalConfigurar as { tipo: "efectivo" | "banco"; nombre: string; saldo_inicial: number } | null}
          esNueva={modalEsNueva}
          onClose={handleCerrarModal}
        />
      )}
      {modalTransferencia && (
        <ModalTransferencia
          cuentas={cuentas}
          onClose={handleCerrarTransferencia}
        />
      )}
      {modalNuevaCuenta && (
        <ModalNuevaCuenta onClose={() => { setModalNuevaCuenta(false); window.location.reload(); }} />
      )}
      {modalIngreso && (
        <ModalIngreso cuenta={modalIngreso} onClose={() => { setModalIngreso(null); window.location.reload(); }} />
      )}
    </div>
  );
}
