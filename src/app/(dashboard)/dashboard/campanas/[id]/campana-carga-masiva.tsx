"use client";

import { useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { procesarCargaMasiva } from "../actions";
import type { FilaCargaMasiva } from "../actions";

// ── Constantes ────────────────────────────────────────────────────────────────

const COLUMNAS_REQUERIDAS = [
  "paciente_nombre",
  "paciente_telefono",
  "rf_od_esfera",
  "rf_od_cilindro",
  "rf_od_eje",
  "rf_oi_esfera",
  "rf_oi_cilindro",
  "rf_oi_eje",
  "producto_id",
  "tipo_producto",
  "producto_descripcion",
  "monto_pagado",
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIPOS_PRODUCTO_VALIDOS = ["aro", "lente", "tratamiento", "accesorio", "servicio", "otro"] as const;

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface ErrorFila {
  fila: number;
  campo: string;
  mensaje: string;
}

type Estado = "idle" | "parseando" | "preview" | "enviando" | "exito" | "error_global";

// ── Validación por fila ───────────────────────────────────────────────────────

function validarFila(fila: Record<string, string>, idx: number): ErrorFila[] {
  const errores: ErrorFila[] = [];
  const n = idx + 1;

  const req = (campo: string, label: string) => {
    if (!fila[campo]?.trim()) {
      errores.push({ fila: n, campo, mensaje: `${label} es requerido` });
    }
  };

  const num = (campo: string, label: string, opts?: { min?: number; max?: number; entero?: boolean }) => {
    const v = fila[campo]?.trim();
    if (!v) { errores.push({ fila: n, campo, mensaje: `${label} es requerido` }); return; }
    const parsed = opts?.entero ? parseInt(v, 10) : parseFloat(v);
    if (isNaN(parsed)) {
      errores.push({ fila: n, campo, mensaje: `${label} debe ser numérico (recibido: "${v}")` });
      return;
    }
    if (opts?.min !== undefined && parsed < opts.min) {
      errores.push({ fila: n, campo, mensaje: `${label} mínimo ${opts.min} (recibido: ${parsed})` });
    }
    if (opts?.max !== undefined && parsed > opts.max) {
      errores.push({ fila: n, campo, mensaje: `${label} máximo ${opts.max} (recibido: ${parsed})` });
    }
  };

  req("paciente_nombre", "Nombre del paciente");

  req("rf_od_esfera", "RF OD Esfera");
  num("rf_od_cilindro", "RF OD Cilindro", { min: -10, max: 10 });
  num("rf_od_eje", "RF OD Eje", { min: 0, max: 180, entero: true });
  req("rf_oi_esfera", "RF OI Esfera");
  num("rf_oi_cilindro", "RF OI Cilindro", { min: -10, max: 10 });
  num("rf_oi_eje", "RF OI Eje", { min: 0, max: 180, entero: true });

  // Adición es opcional pero si tiene valor debe ser numérico
  ["rf_od_adicion", "rf_oi_adicion"].forEach((campo) => {
    const v = fila[campo]?.trim();
    if (v && isNaN(parseFloat(v))) {
      errores.push({ fila: n, campo, mensaje: `${campo} debe ser numérico si se especifica` });
    }
  });

  // producto_id: debe ser UUID válido
  const pid = fila["producto_id"]?.trim();
  if (!pid) {
    errores.push({ fila: n, campo: "producto_id", mensaje: "producto_id es requerido" });
  } else if (!UUID_RE.test(pid)) {
    errores.push({ fila: n, campo: "producto_id", mensaje: `producto_id no es un UUID válido: "${pid}"` });
  }

  // tipo_producto: debe ser uno de los valores permitidos
  const tipo = fila["tipo_producto"]?.trim();
  if (!tipo) {
    errores.push({ fila: n, campo: "tipo_producto", mensaje: "tipo_producto es requerido" });
  } else if (!(TIPOS_PRODUCTO_VALIDOS as readonly string[]).includes(tipo)) {
    errores.push({ fila: n, campo: "tipo_producto", mensaje: `tipo_producto inválido: "${tipo}". Valores: ${TIPOS_PRODUCTO_VALIDOS.join(", ")}` });
  }

  num("monto_pagado", "Monto pagado", { min: 0 });

  return errores;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CampanaCargaMasiva({ campanaId }: { campanaId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<Estado>("idle");
  const [filas, setFilas] = useState<FilaCargaMasiva[]>([]);
  const [erroresValidacion, setErroresValidacion] = useState<ErrorFila[]>([]);
  const [errorGlobal, setErrorGlobal] = useState("");
  const [insertados, setInsertados] = useState(0);
  const [isPending, startTransition] = useTransition();

  const resetear = () => {
    setEstado("idle");
    setFilas([]);
    setErroresValidacion([]);
    setErrorGlobal("");
    setInsertados(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const cerrar = () => {
    setAbierto(false);
    resetear();
  };

  const procesarArchivo = (archivo: File) => {
    setEstado("parseando");
    setErroresValidacion([]);
    setErrorGlobal("");

    Papa.parse<Record<string, string>>(archivo, {
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        // Verificar columnas mínimas
        const encabezados = resultado.meta.fields ?? [];
        const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !encabezados.includes(c));
        if (faltantes.length > 0) {
          setErrorGlobal(
            `El CSV no tiene las columnas requeridas: ${faltantes.join(", ")}`
          );
          setEstado("error_global");
          return;
        }

        if (resultado.data.length === 0) {
          setErrorGlobal("El archivo CSV no contiene filas de datos.");
          setEstado("error_global");
          return;
        }

        if (resultado.data.length > 500) {
          setErrorGlobal("El archivo tiene más de 500 filas. Divídelo en lotes más pequeños.");
          setEstado("error_global");
          return;
        }

        // Validar cada fila
        const todosErrores: ErrorFila[] = [];
        const filasValidas: FilaCargaMasiva[] = [];

        resultado.data.forEach((fila, idx) => {
          const errs = validarFila(fila, idx);
          if (errs.length > 0) {
            todosErrores.push(...errs);
          } else {
            // Normalizar todos los strings antes de enviar al servidor
            const filaLimpia: FilaCargaMasiva = {
              paciente_nombre: fila.paciente_nombre?.trim() ?? "",
              paciente_telefono: fila.paciente_telefono?.trim() ?? "",
              rf_od_esfera: fila.rf_od_esfera?.trim() ?? "",
              rf_od_cilindro: fila.rf_od_cilindro?.trim() ?? "",
              rf_od_eje: fila.rf_od_eje?.trim() ?? "",
              rf_od_adicion: fila.rf_od_adicion?.trim() ?? "",
              rf_oi_esfera: fila.rf_oi_esfera?.trim() ?? "",
              rf_oi_cilindro: fila.rf_oi_cilindro?.trim() ?? "",
              rf_oi_eje: fila.rf_oi_eje?.trim() ?? "",
              rf_oi_adicion: fila.rf_oi_adicion?.trim() ?? "",
              examen_observaciones: fila.examen_observaciones?.trim() ?? "",
              producto_id: fila.producto_id?.trim() ?? "",
              tipo_producto: fila.tipo_producto?.trim() ?? "",
              producto_descripcion: fila.producto_descripcion?.trim() ?? "",
              monto_pagado: fila.monto_pagado?.trim() ?? "",
            };
            filasValidas.push(filaLimpia);
          }
        });

        setErroresValidacion(todosErrores);
        setFilas(filasValidas);
        setEstado("preview");
      },
      error: (err) => {
        setErrorGlobal(`Error al leer el archivo: ${err.message}`);
        setEstado("error_global");
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (archivo) procesarArchivo(archivo);
  };

  const confirmar = () => {
    if (filas.length === 0) return;
    startTransition(async () => {
      setEstado("enviando");
      const resultado = await procesarCargaMasiva(campanaId, filas);
      if (resultado.error) {
        setErrorGlobal(resultado.error);
        setEstado("error_global");
      } else {
        setInsertados(resultado.data?.insertados ?? filas.length);
        setEstado("exito");
      }
    });
  };

  // ── Render modal ────────────────────────────────────────────────────────────

  const hayErroresValidacion = erroresValidacion.length > 0;
  const puedeConfirmar = estado === "preview" && filas.length > 0 && !hayErroresValidacion;

  return (
    <>
      {/* Botón disparador */}
      <button
        onClick={() => setAbierto(true)}
        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition"
      >
        Carga Masiva archivo CSV
      </button>

      {/* Overlay modal */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="bg-card border border-b-default rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-b-subtle shrink-0">
              <div>
                <h2 className="font-semibold text-t-primary">Carga Masiva CSV</h2>
                <p className="text-xs text-t-muted mt-0.5">
                  Registra pacientes, exámenes y ventas en bloque
                </p>
              </div>
              <button onClick={cerrar} className="text-t-muted hover:text-t-primary text-xl leading-none transition">
                ×
              </button>
            </div>

            {/* Cuerpo scrolleable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* ── Estado: idle / error_global / enviando ── */}
              {(estado === "idle" || estado === "parseando" || estado === "error_global") && (
                <div className="space-y-4">
                  {/* Zona de carga */}
                  <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-b-default rounded-xl cursor-pointer hover:border-blue-500/60 hover:bg-blue-500/5 transition group">
                    <span className="text-3xl">📂</span>
                    <div className="text-center">
                      <p className="text-sm font-medium text-t-primary group-hover:text-blue-400 transition">
                        {estado === "parseando" ? "Procesando…" : "Seleccionar archivo CSV"}
                      </p>
                      <p className="text-xs text-t-muted mt-0.5">Máximo 500 filas</p>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={estado === "parseando"}
                    />
                  </label>

                  {/* Error global */}
                  {estado === "error_global" && errorGlobal && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                      {errorGlobal}
                    </div>
                  )}

                  {/* Plantilla de columnas */}
                  <div className="p-4 bg-empty border border-b-subtle rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-t-secondary uppercase tracking-wider">
                      Columnas requeridas del CSV
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "paciente_nombre", "paciente_telefono",
                        "rf_od_esfera", "rf_od_cilindro", "rf_od_eje", "rf_od_adicion",
                        "rf_oi_esfera", "rf_oi_cilindro", "rf_oi_eje", "rf_oi_adicion",
                        "examen_observaciones",
                        "producto_id", "tipo_producto", "producto_descripcion", "monto_pagado",
                      ].map((col) => (
                        <span key={col} className={`text-[10px] px-2 py-0.5 rounded font-mono ${(COLUMNAS_REQUERIDAS as readonly string[]).includes(col)
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-empty text-t-muted"
                          }`}>
                          {col}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-t-muted">
                      Azul = obligatorio · Gris = opcional
                    </p>
                  </div>
                </div>
              )}

              {/* ── Estado: preview ── */}
              {estado === "preview" && (
                <div className="space-y-4">
                  {/* Resumen */}
                  <div className="flex gap-3">
                    <div className="flex-1 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                      <p className="text-xl font-bold text-green-400">{filas.length}</p>
                      <p className="text-[10px] text-t-muted mt-0.5">filas válidas</p>
                    </div>
                    {hayErroresValidacion && (
                      <div className="flex-1 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                        <p className="text-xl font-bold text-red-400">{erroresValidacion.length}</p>
                        <p className="text-[10px] text-t-muted mt-0.5">errores de validación</p>
                      </div>
                    )}
                  </div>

                  {/* Log de errores de validación */}
                  {hayErroresValidacion && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-red-400">
                        Corrige estos errores antes de continuar:
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {erroresValidacion.map((e, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-xs px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg"
                          >
                            <span className="font-semibold text-red-400 shrink-0">
                              Fila {e.fila}
                            </span>
                            <span className="font-mono text-t-muted shrink-0">[{e.campo}]</span>
                            <span className="text-t-secondary">{e.mensaje}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview tabla */}
                  {filas.length > 0 && !hayErroresValidacion && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-t-secondary">
                        Vista previa (primeras {Math.min(filas.length, 5)} de {filas.length} filas)
                      </p>
                      <div className="overflow-x-auto rounded-xl border border-b-default">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="bg-empty border-b border-b-subtle">
                              {["#", "Paciente", "Teléfono", "OD Esf/Cil/Eje", "OI Esf/Cil/Eje", "Tipo", "Descripción", "Monto"].map((h) => (
                                <th key={h} className="px-3 py-2 text-left font-semibold text-t-muted whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-b-subtle">
                            {filas.slice(0, 5).map((f, i) => (
                              <tr key={i} className="hover:bg-empty">
                                <td className="px-3 py-2 text-t-muted">{i + 1}</td>
                                <td className="px-3 py-2 text-t-primary font-medium max-w-[120px] truncate">
                                  {f.paciente_nombre}
                                </td>
                                <td className="px-3 py-2 text-t-muted">{f.paciente_telefono || "—"}</td>
                                <td className="px-3 py-2 text-t-secondary font-mono whitespace-nowrap">
                                  {f.rf_od_esfera}/{f.rf_od_cilindro}/{f.rf_od_eje}
                                </td>
                                <td className="px-3 py-2 text-t-secondary font-mono whitespace-nowrap">
                                  {f.rf_oi_esfera}/{f.rf_oi_cilindro}/{f.rf_oi_eje}
                                </td>
                                <td className="px-3 py-2 text-t-muted">{f.tipo_producto}</td>
                                <td className="px-3 py-2 text-t-muted max-w-[140px] truncate" title={f.producto_descripcion}>
                                  {f.producto_descripcion || "—"}
                                </td>
                                <td className="px-3 py-2 text-green-400 font-semibold">
                                  ${parseFloat(f.monto_pagado).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {filas.length > 5 && (
                        <p className="text-[10px] text-t-muted text-right">
                          … y {filas.length - 5} fila{filas.length - 5 !== 1 ? "s" : ""} más
                        </p>
                      )}
                    </div>
                  )}

                  {/* Botón cargar otro */}
                  <button
                    onClick={() => { resetear(); }}
                    className="text-xs text-t-muted hover:text-t-primary transition underline"
                  >
                    Cargar otro archivo
                  </button>
                </div>
              )}

              {/* ── Estado: enviando ── */}
              {estado === "enviando" && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-sm text-t-secondary">
                    Procesando {filas.length} registro{filas.length !== 1 ? "s" : ""}…
                  </p>
                  <p className="text-xs text-t-muted">No cierres esta ventana</p>
                </div>
              )}

              {/* ── Estado: éxito ── */}
              {estado === "exito" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <span className="text-5xl">✅</span>
                  <div>
                    <p className="text-lg font-bold text-green-400">
                      {insertados} registro{insertados !== 1 ? "s" : ""} importado{insertados !== 1 ? "s" : ""}
                    </p>
                    <p className="text-sm text-t-muted mt-1">
                      Pacientes, exámenes y ventas registrados en la campaña.
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* Footer con acciones */}
            <div className="px-6 py-4 border-t border-b-subtle flex items-center justify-end gap-3 shrink-0">
              {estado === "exito" ? (
                <button
                  onClick={cerrar}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition"
                >
                  Cerrar
                </button>
              ) : (
                <>
                  <button
                    onClick={cerrar}
                    disabled={isPending}
                    className="px-4 py-2 text-sm border border-b-default rounded-lg text-t-muted hover:text-t-primary transition disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  {puedeConfirmar && (
                    <button
                      onClick={confirmar}
                      disabled={isPending}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition disabled:opacity-60"
                    >
                      Importar {filas.length} registro{filas.length !== 1 ? "s" : ""}
                    </button>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
