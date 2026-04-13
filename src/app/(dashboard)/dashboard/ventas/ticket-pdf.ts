"use client";

import { jsPDF } from "jspdf";
import { imprimirPDF } from "@/lib/print-pdf";

interface TicketData {
  empresa: { nombre: string; nit: string | null; logo_url: string | null; email: string | null } | null;
  sucursal: { nombre: string; direccion: string | null; telefono: string | null } | null;
  orden: {
    id: string;
    tipo: string;
    estado: string;
    subtotal: number;
    descuento: number;
    total: number;
    notas: string | null;
    created_at: string;
    paciente: { nombre: string; telefono: string | null } | { nombre: string; telefono: string | null }[] | null;
    asesor: { nombre: string } | { nombre: string }[] | null;
  };
  detalles: {
    tipo_producto: string;
    descripcion: string | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
  pagos: { monto: number; metodo_pago: string; created_at: string }[];
  totalAbonado: number;
  saldoPendiente: number;
}

function getNested(rel: { nombre: string } | { nombre: string }[] | null): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.nombre ?? "—";
  return rel.nombre;
}

function getNestedPat(rel: TicketData["orden"]["paciente"]): { nombre: string; telefono: string | null } {
  if (!rel) return { nombre: "—", telefono: null };
  if (Array.isArray(rel)) return rel[0] ?? { nombre: "—", telefono: null };
  return rel;
}

export async function generarTicketPDF(data: TicketData) {
  // Helper to load image URL into base64 for jsPDF
  const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  // 80mm thermal printer width ≈ 80mm, we use a long roll height
  const ticketWidth = 80;
  // Estimate height based on content (with improved spacing)
  const baseHeight = 130;
  const itemHeight = data.detalles.length * 12; // increased from 8 to 12 for better spacing
  const pagosHeight = 15 + (data.pagos.length > 0 ? 15 + data.pagos.length * 5 : 0);
  const ticketHeight = baseHeight + itemHeight + pagosHeight + (data.orden.notas ? 25 : 0);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [ticketWidth, ticketHeight] });
  const margin = 4;
  const contentWidth = ticketWidth - margin * 2;
  let y = margin + 2;

  const paciente = getNestedPat(data.orden.paciente);
  const asesor = getNested(data.orden.asesor);
  const empresaNombre = data.empresa?.nombre ?? "Óptica";
  const sucursalDir = data.sucursal?.direccion ?? "";
  const sucursalTel = data.sucursal?.telefono ?? "";

  const fmtCurrency = (val: number) => `$${val.toFixed(2)}`;
  const tipoLabel = data.orden.tipo === "proforma" ? "VENTA" : "ORDEN DE TRABAJO";

  // ── Header ──────────────────────────────────────────────
  if (data.empresa?.logo_url) {
    try {
      const base64Logo = await loadImage(data.empresa.logo_url);
      const logoWidth = 24;
      const logoHeight = 24;
      const logoX = (ticketWidth - logoWidth) / 2;
      doc.addImage(base64Logo, 'PNG', logoX, y, logoWidth, logoHeight);
      y += logoHeight + 4;
    } catch (e) {
      console.warn("Could not load logo image for PDF", e);
    }
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(empresaNombre.toUpperCase(), ticketWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  if (sucursalDir) {
    // Split long addresses so they don't break the ticket width
    const splitDir = doc.splitTextToSize(sucursalDir, contentWidth - 4);
    for (let i = 0; i < splitDir.length; i++) {
        doc.text(splitDir[i], ticketWidth / 2, y, { align: "center" });
        y += 3.5;
    }
  }

  if (sucursalTel) { doc.text(`Tel: ${sucursalTel}`, ticketWidth / 2, y, { align: "center" }); y += 3.5; }
  if (data.empresa?.nit) { doc.text(`NIT: ${data.empresa.nit}`, ticketWidth / 2, y, { align: "center" }); y += 3.5; }
  if (data.empresa?.email) { doc.text(`${data.empresa.email}`, ticketWidth / 2, y, { align: "center" }); y += 3.5; }

  // Dashed separator
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 3;

  // ── Document Type ───────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(tipoLabel, ticketWidth / 2, y, { align: "center" });
  y += 5.5;

  // ── Date & Info ─────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const fechaStr = new Date(data.orden.created_at).toLocaleDateString("es-SV", {
    timeZone: "America/El_Salvador", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const horaStr = new Date(data.orden.created_at).toLocaleTimeString("es-SV", {
    timeZone: "America/El_Salvador", hour: "2-digit", minute: "2-digit",
  });
  doc.text(`Fecha: ${fechaStr}  ${horaStr}`, margin, y);
  y += 4;
  doc.text(`Paciente: ${paciente.nombre}`, margin, y);
  y += 4;
  if (paciente.telefono) { doc.text(`Tel: ${paciente.telefono}`, margin, y); y += 4; }
  y += 1.5;

  // ── Separator ───────────────────────────────────────────
  doc.line(margin, y, ticketWidth - margin, y);
  y += 3;

  // ── Items Header ────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("CANT", margin, y);
  doc.text("DESCRIPCIÓN", margin + 10, y);
  doc.text("TOTAL", ticketWidth - margin, y, { align: "right" });
  y += 3.5;

  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 3;

  // ── Items ───────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (const item of data.detalles) {
    const desc = item.descripcion || "—";
    // Wrap description to fit in 2 lines max instead of truncating
    const maxDescWidth = contentWidth - 22;
    const descLines = doc.splitTextToSize(desc, maxDescWidth);
    const displayDesc = descLines.length > 2 ? descLines.slice(0, 2).join("\n") + "…" : descLines.join("\n");

    doc.text(`${item.cantidad}`, margin + 2, y, { align: "center" });
    doc.text(displayDesc, margin + 10, y);
    doc.text(fmtCurrency(Number(item.subtotal)), ticketWidth - margin, y, { align: "right" });

    // Calculate lines consumed by wrapped desc
    const lineCount = displayDesc.split("\n").length;
    y += 3.5 * lineCount;

    // Show unit price if qty > 1
    if (item.cantidad > 1) {
      doc.setFontSize(7);
      doc.text(`  c/u ${fmtCurrency(Number(item.precio_unitario))}`, margin + 10, y);
      doc.setFontSize(8);
      y += 3.5;
    }

    y += 1.5; // extra spacing between items
  }

  y += 1;

  // ── Totals ──────────────────────────────────────────────
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 4.5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", margin, y);
  doc.text(fmtCurrency(Number(data.orden.subtotal)), ticketWidth - margin, y, { align: "right" });
  y += 4.5;

  if (Number(data.orden.descuento) > 0) {
    doc.text("Descuento:", margin, y);
    doc.text(`-${fmtCurrency(Number(data.orden.descuento))}`, ticketWidth - margin, y, { align: "right" });
    y += 4.5;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", margin, y);
  doc.text(fmtCurrency(Number(data.orden.total)), ticketWidth - margin, y, { align: "right" });
  y += 5.5;

  // ── Notes ───────────────────────────────────────────────
  if (data.orden.notas) {
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(margin, y, ticketWidth - margin, y);
    y += 3.5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const notaLines = doc.splitTextToSize(data.orden.notas, contentWidth);
    doc.text(notaLines, margin, y);
    y += notaLines.length * 3.5 + 2;
  }

  // ── Payment Summary ──────────────────────────────────────
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 3;

  if (data.pagos.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ABONOS", margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const metodoLabels: Record<string, string> = { efectivo: "Efect.", tarjeta: "Tarj.", transferencia: "Transf.", cheque: "Cheque" };

    for (const pago of data.pagos) {
      const fecha = new Date(pago.created_at).toLocaleDateString("es-SV", { timeZone: "America/El_Salvador", day: "2-digit", month: "2-digit" });
      const metod = metodoLabels[pago.metodo_pago] ?? pago.metodo_pago;
      doc.text(`${fecha} ${metod}`, margin, y);
      doc.text(fmtCurrency(Number(pago.monto)), ticketWidth - margin, y, { align: "right" });
      y += 4;
    }

    y += 1.5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Total Abonado:", margin, y);
    doc.text(fmtCurrency(data.totalAbonado), ticketWidth - margin, y, { align: "right" });
    y += 4.5;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("SALDO PENDIENTE:", margin, y);
  doc.text(fmtCurrency(Math.max(data.saldoPendiente, 0)), ticketWidth - margin, y, { align: "right" });
  y += 5.5;

  // ── Footer ──────────────────────────────────────────────
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 4;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("¡Gracias por su preferencia!", ticketWidth / 2, y, { align: "center" });
  y += 3.5;
  doc.text(empresaNombre, ticketWidth / 2, y, { align: "center" });

  // Reset dash
  doc.setLineDashPattern([], 0);

  imprimirPDF(doc);
}
