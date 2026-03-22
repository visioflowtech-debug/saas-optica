import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtFecha, fmtDate, fmtHoy } from "@/lib/date-sv";

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
  color_aro: string;
  tamano_aro: string;
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
  filtros: {
    laboratorio?: string;
    campana?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }
) {
  // A4 landscape gives ~277mm usable width — enough for 14 columns
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const now = fmtHoy();

  // ── Header ──────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LISTA DE ÓRDENES DE LABORATORIO", pw / 2, 13, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const partes: string[] = [
    filtros.laboratorio ? `Lab: ${filtros.laboratorio}` : "Todos los laboratorios",
  ];
  if (filtros.campana) partes.push(`Campaña: ${filtros.campana}`);
  if (filtros.fechaDesde || filtros.fechaHasta) {
    const desde = filtros.fechaDesde ? fmtDate(filtros.fechaDesde) : "—";
    const hasta = filtros.fechaHasta ? fmtDate(filtros.fechaHasta) : "—";
    partes.push(`Período: ${desde} al ${hasta}`);
  }
  partes.push(`Generado: ${now}`);
  doc.text(partes.join("   |   "), pw / 2, 19, { align: "center" });

  doc.setFontSize(7.5);
  doc.setTextColor(100);
  doc.text(`Total: ${ordenes.length} órdenes`, pw / 2, 24, { align: "center" });
  doc.setTextColor(0);

  // ── Tabla ────────────────────────────────────────────────
  const rows = ordenes.map((o, idx) => [
    String(idx + 1),
    fmtFecha(o.created_at, { year: "2-digit" }),
    o.paciente,
    o.laboratorio,
    ESTADO_LABEL[o.estadoLab] || o.estadoLab,
    o.observaciones || "",
    o.tipo_lente || "",
    o.color_lente || "",
    o.material_lente || "",
    o.tratamiento_lente || "",
    o.tipo_aro || "",
    o.marca_aro || "",
    o.color_aro || "",
    o.tamano_aro || "",
  ]);

  autoTable(doc, {
    startY: 28,
    margin: { left: 8, right: 8 },
    head: [[
      "#",
      "Fecha",
      "Paciente",
      "Laboratorio",
      "Estado",
      "Observaciones",
      "Tipo Lentes",
      "Color Lentes",
      "Material",
      "Tratamiento",
      "Tipo Aro",
      "Marca",
      "Color",
      "Tamaño",
    ]],
    body: rows,
    styles: { fontSize: 6.5, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0:  { cellWidth: 5,  halign: "center" },
      1:  { cellWidth: 14 },
      2:  { cellWidth: 32 },
      3:  { cellWidth: 24 },
      4:  { cellWidth: 17, halign: "center" },
      5:  { cellWidth: "auto" },  // Observaciones takes remaining space
      6:  { cellWidth: 20 },
      7:  { cellWidth: 16 },
      8:  { cellWidth: 18 },
      9:  { cellWidth: 18 },
      10: { cellWidth: 17 },
      11: { cellWidth: 18 },
      12: { cellWidth: 15 },
      13: { cellWidth: 13 },
    },
  });

  // ── Footer pages ─────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pw - 10,
      doc.internal.pageSize.getHeight() - 6,
      { align: "right" }
    );
  }

  doc.save(`ordenes_laboratorio_${Date.now()}.pdf`);
}
