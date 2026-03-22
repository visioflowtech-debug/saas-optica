import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface OrdenListaItem {
  id: string;
  created_at: string;
  paciente: string;
  campana: string | null;
  laboratorio: string;
  estadoLab: string;
  tipo_lente: string;
  material_lente: string;
  tratamiento_lente: string;
  color_lente: string;
  marca_aro: string;
  tipo_aro: string;
  observaciones: string;
  total: number;
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_laboratorio: "En Lab.",
  recibido: "Recibido",
  entregado: "Entregado",
};

export function generarListaOrdenesLaboratorioPDF(
  ordenes: OrdenListaItem[],
  filtros: { laboratorio?: string; campana?: string }
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pw = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });

  // ── Header ──────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("LISTA DE ÓRDENES DE LABORATORIO", pw / 2, 14, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const subtitulo = [
    filtros.laboratorio ? `Laboratorio: ${filtros.laboratorio}` : "Todos los laboratorios",
    filtros.campana ? `Campaña: ${filtros.campana}` : null,
    `Generado: ${now}`,
  ].filter(Boolean).join("   |   ");
  doc.text(subtitulo, pw / 2, 20, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Total órdenes: ${ordenes.length}`, pw / 2, 25, { align: "center" });
  doc.setTextColor(0);

  // ── Tabla ────────────────────────────────────────────────
  const rows = ordenes.map((o, idx) => [
    String(idx + 1),
    new Date(o.created_at).toLocaleDateString("es-SV", { day: "2-digit", month: "short" }),
    o.paciente,
    o.laboratorio,
    [o.tipo_lente, o.material_lente, o.color_lente, o.tratamiento_lente].filter(Boolean).join(" / ") || "—",
    [o.tipo_aro, o.marca_aro].filter(Boolean).join(" / ") || "—",
    ESTADO_LABEL[o.estadoLab] || o.estadoLab,
    o.observaciones || "",
  ]);

  autoTable(doc, {
    startY: 30,
    head: [["#", "Fecha", "Paciente", "Laboratorio", "Lentes", "Aro", "Estado", "Obs."]],
    body: rows,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 18 },
      2: { cellWidth: 40 },
      3: { cellWidth: 35 },
      4: { cellWidth: 55 },
      5: { cellWidth: 40 },
      6: { cellWidth: 22, halign: "center" },
      7: { cellWidth: "auto" },
    },
  });

  // ── Footer pages ─────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${totalPages}`, pw - 15, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  doc.save(`ordenes_laboratorio_${Date.now()}.pdf`);
}
