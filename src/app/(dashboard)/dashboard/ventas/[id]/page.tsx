import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import OrdenAcciones from "./orden-acciones";
import PagosSection from "./pagos-section";
import ProformaLineasEdit from "./proforma-lineas-edit";
import { obtenerCatalogo } from "../actions";
import { fmtFecha } from "@/lib/date-sv";

export default async function OrdenDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orden } = await supabase
    .from("ordenes")
    .select("*, paciente:pacientes!ordenes_paciente_id_fkey(nombre, telefono, email), asesor:usuarios!ordenes_asesor_id_fkey(nombre)")
    .eq("id", id)
    .single();

  if (!orden) notFound();

  const { data: detalles } = await supabase
    .from("orden_detalle")
    .select("*")
    .eq("orden_id", id)
    .order("created_at", { ascending: true });

  const { data: labEstado } = await supabase
    .from("laboratorio_estados")
    .select("*")
    .eq("orden_id", id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pagos } = await supabase
    .from("pagos")
    .select("*")
    .eq("orden_id", id)
    .order("created_at", { ascending: true });

  const { data: labSpecs } = await supabase
    .from("orden_laboratorio_datos")
    .select("*")
    .eq("orden_id", id)
    .single();

  const esProformaBorrador = orden.tipo === "proforma" && orden.estado === "borrador";
  const catalogo = esProformaBorrador ? await obtenerCatalogo() : [];

  const paciente = getNested(orden.paciente);
  const asesor = getNested(orden.asesor);

  const tipoLabels: Record<string, string> = { aro: "Aro", lente: "Lente", tratamiento: "Tratamiento" };
  const estadoColors: Record<string, string> = {
    borrador: "bg-badge-bg text-t-muted",
    confirmada: "bg-a-blue-bg text-t-blue",
    facturada: "bg-a-green-bg text-t-green",
    cancelada: "bg-a-red-bg text-t-red",
  };
  const estadoLabels: Record<string, string> = {
    borrador: "Borrador", confirmada: "Confirmada", facturada: "Facturada", cancelada: "Cancelada",
  };

  const fmtCurrency = (val: number) => new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(val);

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/dashboard/ventas" className="inline-flex items-center gap-1 text-sm text-t-muted hover:text-t-primary transition">
        ← Volver a ventas
      </Link>

      {/* Header */}
      <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-t-primary">
                {orden.tipo === "proforma" ? "Proforma" : "Orden de Trabajo"}
              </h1>
              <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${estadoColors[orden.estado] ?? ""}`}>
                {estadoLabels[orden.estado] ?? orden.estado}
              </span>
            </div>
            <p className="text-t-secondary text-sm">
              Paciente: <span className="font-medium text-t-primary">{paciente}</span>
            </p>
            <p className="text-t-muted text-xs mt-1">
              Asesor: {asesor} · {fmtFecha(orden.created_at, { month: "long" })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-t-blue font-mono">{fmtCurrency(Number(orden.total))}</p>
            <p className="text-xs text-t-muted mt-1">Total</p>
          </div>
        </div>

        {/* Lab Status */}
        {labEstado && (
          <div className="mt-4 pt-4 border-t border-b-subtle flex items-center gap-2">
            <span className="text-xs text-t-muted">Lab:</span>
            <LabBadge estado={labEstado.estado} lab={labEstado.laboratorio_externo} />
          </div>
        )}
      </div>

      {/* Line Items */}
      {esProformaBorrador ? (
        <ProformaLineasEdit
          ordenId={id}
          lineasIniciales={(detalles ?? []).map((d) => ({
            id: d.id,
            tipo_producto: d.tipo_producto,
            descripcion: d.descripcion,
            cantidad: Number(d.cantidad),
            precio_unitario: Number(d.precio_unitario),
            subtotal: Number(d.subtotal),
          }))}
          catalogo={catalogo}
          descuento={Number(orden.descuento)}
        />
      ) : (
        <div className="bg-card border border-b-default rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
          <div className="px-6 py-4 border-b border-b-subtle">
            <h2 className="text-sm font-semibold text-t-primary uppercase tracking-wider">Detalle de Productos</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-subtle">
                <th className="text-left px-6 py-3 text-xs font-medium text-t-muted uppercase">Tipo</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-t-muted uppercase">Descripción</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-t-muted uppercase">Cant.</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-t-muted uppercase">Precio</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-t-muted uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-subtle">
              {(detalles ?? []).map((d) => (
                <tr key={d.id}>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 text-[10px] font-medium uppercase rounded-full bg-a-blue-bg text-t-blue">
                      {tipoLabels[d.tipo_producto] ?? d.tipo_producto}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-t-primary">{d.descripcion ?? "—"}</td>
                  <td className="px-6 py-3 text-center text-t-secondary">{d.cantidad}</td>
                  <td className="px-6 py-3 text-right text-t-secondary font-mono">{fmtCurrency(Number(d.precio_unitario))}</td>
                  <td className="px-6 py-3 text-right text-t-primary font-mono font-medium">{fmtCurrency(Number(d.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Totals */}
          <div className="px-6 py-4 border-t border-b-subtle bg-input/30">
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-t-muted">Subtotal</span>
                  <span className="text-t-primary font-mono">{fmtCurrency(Number(orden.subtotal))}</span>
                </div>
                {Number(orden.descuento) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-t-muted">Descuento</span>
                    <span className="text-t-red font-mono">-{fmtCurrency(Number(orden.descuento))}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-b-subtle">
                  <span className="text-t-primary">Total</span>
                  <span className="text-t-blue font-mono">{fmtCurrency(Number(orden.total))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {orden.notas && (
        <div className="p-6 bg-card border border-b-default rounded-2xl shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold text-t-primary uppercase tracking-wider mb-2">Notas</h2>
          <p className="text-sm text-t-secondary">{orden.notas}</p>
        </div>
      )}

      {/* Lab Specs (visión 360) */}
      {labSpecs && (
        <div className="bg-card border border-b-default rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
          <div className="px-6 py-4 border-b border-b-subtle bg-a-blue-bg/20">
            <h2 className="text-sm font-semibold text-t-blue uppercase tracking-wider flex items-center gap-2">
              <span>🔬</span> Especificaciones de Laboratorio
            </h2>
          </div>
          <div className="p-6 space-y-6">
            
            {/* Lentes */}
            <div>
              <h3 className="text-xs font-bold text-t-muted uppercase mb-3">Lentes</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <LabField label="Tipo" value={labSpecs.tipo_lente} />
                <LabField label="Color" value={labSpecs.color_lente} />
                <LabField label="Material" value={labSpecs.material_lente} />
                <LabField label="Tratamiento" value={labSpecs.tratamiento_lente} />
              </div>
            </div>

            {/* Aro */}
            <div>
              <h3 className="text-xs font-bold text-t-muted uppercase mb-3">Aro</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                <LabField label="Marca" value={labSpecs.marca_aro} />
                <LabField label="Color" value={labSpecs.color_aro} />
                <LabField label="Tamaño" value={labSpecs.tamano_aro} />
                <LabField label="Tipo" value={labSpecs.tipo_aro} />
                <LabField label="H" value={labSpecs.horizontal_aro} />
                <LabField label="V" value={labSpecs.vertical_aro} />
                <LabField label="D" value={labSpecs.diagonal_aro} />
                <LabField label="Puente" value={labSpecs.puente_aro} />
                <LabField label="Varilla" value={labSpecs.varilla_aro} />
              </div>
            </div>

            {/* Medidas */}
            <div>
              <h3 className="text-xs font-bold text-t-muted uppercase mb-3">Medidas</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <LabField label="DP OD" value={labSpecs.dp_od} />
                <LabField label="DP OI" value={labSpecs.dp_oi} />
                <LabField label="DP Total" value={labSpecs.dp} />
                <LabField label="Altura" value={labSpecs.altura} />
              </div>
            </div>

            {labSpecs.observaciones && (
              <div className="mt-4 p-4 bg-input rounded-xl border border-b-default">
                <h3 className="text-xs font-bold text-t-muted uppercase mb-1">Observaciones de Lab</h3>
                <p className="text-sm text-t-secondary whitespace-pre-wrap">{labSpecs.observaciones}</p>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* Payments */}
      <PagosSection ordenId={id} totalOrden={Number(orden.total)} pagos={pagos ?? []} />

      {/* Actions */}
      <OrdenAcciones ordenId={id} tipo={orden.tipo} estado={orden.estado} />
    </div>
  );
}

function getNested(rel: { nombre: string } | { nombre: string }[] | null): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.nombre ?? "—";
  return rel.nombre;
}

function LabBadge({ estado, lab }: { estado: string; lab: string | null }) {
  const map: Record<string, string> = {
    pendiente: "bg-a-amber-bg text-t-amber",
    en_laboratorio: "bg-a-blue-bg text-t-blue",
    recibido: "bg-a-green-bg text-t-green",
    entregado: "bg-a-green-bg text-t-green",
  };
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    en_laboratorio: lab ? `En ${lab}` : "En Laboratorio",
    recibido: "Recibido",
    entregado: "Entregado ✓",
  };
  return (
    <span className={`px-2.5 py-0.5 text-[10px] font-medium rounded-full ${map[estado] ?? ""}`}>
      {labels[estado] ?? estado}
    </span>
  );
}

function LabField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-[10px] sm:text-xs text-t-muted tracking-wider block mb-0.5">{label}</span>
      <p className="text-sm text-t-primary font-medium">{value || "—"}</p>
    </div>
  );
}
