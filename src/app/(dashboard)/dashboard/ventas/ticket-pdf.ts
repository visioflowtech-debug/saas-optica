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

function numeroALetras(num: number): string {
  const unidades = ["", "Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve"];
  const decenas = ["", "", "Veinte", "Treinta", "Cuarenta", "Cincuenta", "Sesenta", "Setenta", "Ochenta", "Noventa"];
  const especiales = ["Diez", "Once", "Doce", "Trece", "Catorce", "Quince", "Dieciséis", "Diecisiete", "Dieciocho", "Diecinueve"];
  const centenas = ["", "Ciento", "Doscientos", "Trescientos", "Cuatrocientos", "Quinientos", "Seiscientos", "Setecientos", "Ochocientos", "Novecientos"];

  const int = Math.floor(num);
  const decimales = Math.round((num - int) * 100);

  if (int === 0) return "Cero";

  let resultado = "";

  // Centenas
  if (int >= 100) {
    resultado += centenas[Math.floor(int / 100)];
    const resto = int % 100;
    if (resto > 0) resultado += " " + numeroALetras(resto);
  } else if (int >= 20) {
    const d = Math.floor(int / 10);
    const u = int % 10;
    resultado = decenas[d];
    if (u > 0) resultado += " y " + unidades[u];
  } else if (int >= 10) {
    resultado = especiales[int - 10];
  } else {
    resultado = unidades[int];
  }

  if (decimales > 0) {
    resultado += ` con ${decimales}/100`;
  }

  return resultado;
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
  const baseHeight = 155;
  const itemHeight = data.detalles.length * 15; // increased for better spacing
  const pagosHeight = 18 + (data.pagos.length > 0 ? 18 + data.pagos.length * 6 : 0);
  const ticketHeight = baseHeight + itemHeight + pagosHeight + (data.orden.notas ? 35 : 0);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [ticketWidth, ticketHeight] });
  const margin = 3;
  const contentWidth = ticketWidth - margin * 2;
  let y = margin; // reduced from margin + 1 to eliminate top margin

  const paciente = getNestedPat(data.orden.paciente);
  const empresaNombre = data.empresa?.nombre ?? "Óptica";
  const sucursalDir = data.sucursal?.direccion ?? "";
  const sucursalTel = data.sucursal?.telefono ?? "";

  const fmtCurrency = (val: number) => `$${val.toFixed(2)}`;
  const tipoLabel = data.orden.tipo === "proforma" ? "VENTA" : "ORDEN DE TRABAJO";

  // ── Header ──────────────────────────────────────────────
  if (data.empresa?.logo_url) {
    try {
      const base64Logo = await loadImage(data.empresa.logo_url);
      const logoWidth = 32; // increased from 24
      const logoHeight = 32; // increased from 24
      const logoX = (ticketWidth - logoWidth) / 2;
      doc.addImage(base64Logo, 'PNG', logoX, y, logoWidth, logoHeight);
      y += logoHeight + 5;
    } catch (e) {
      console.warn("Could not load logo image for PDF", e);
    }
  }

  doc.setFontSize(14); // increased from 12
  doc.setFont("helvetica", "bold");
  doc.text(empresaNombre.toUpperCase(), ticketWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(8); // increased from 7
  doc.setFont("helvetica", "normal");

  if (sucursalDir) {
    // Split long addresses so they don't break the ticket width
    const splitDir = doc.splitTextToSize(sucursalDir, contentWidth - 4);
    for (let i = 0; i < splitDir.length; i++) {
        doc.text(splitDir[i], ticketWidth / 2, y, { align: "center" });
        y += 4;
    }
  }

  if (sucursalTel) { doc.text(`Tel: ${sucursalTel}`, ticketWidth / 2, y, { align: "center" }); y += 4; }
  if (data.empresa?.nit) { doc.text(`NIT: ${data.empresa.nit}`, ticketWidth / 2, y, { align: "center" }); y += 4; }
  if (data.empresa?.email) { doc.text(`${data.empresa.email}`, ticketWidth / 2, y, { align: "center" }); y += 4; }

  // Dashed separator
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 4;

  // ── Invoice Number & Type ───────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`N.° de factura`, margin, y);
  y += 4;

  doc.setFontSize(10);
  doc.text(data.orden.id.toUpperCase(), margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const fechaStr = new Date(data.orden.created_at).toLocaleDateString("es-SV", {
    timeZone: "America/El_Salvador", year: "numeric", month: "2-digit", day: "2-digit",
  });
  doc.text("Fecha", margin, y);
  doc.text(fechaStr, ticketWidth - margin, y, { align: "right" });
  y += 4.5;

  // ── Separator ───────────────────────────────────────────
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 4;

  // ── Customer Info ───────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Cliente::", margin, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(paciente.nombre.toUpperCase(), margin, y);
  y += 5;

  doc.setFontSize(7);
  if (paciente.telefono) { doc.text(`Tel: ${paciente.telefono}`, margin, y); y += 3.5; }

  y += 2;

  // ── Separator ───────────────────────────────────────────
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 4;

  // ── Items Header ────────────────────────────────────────
  doc.setFontSize(8); // increased from 7
  doc.setFont("helvetica", "bold");
  doc.text("#", margin, y);
  doc.text("Artículo", margin + 6, y);
  doc.text("Cant.", margin + 28, y);
  doc.text("Cantidad", ticketWidth - margin - 18, y);
  y += 4;

  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 4;

  // ── Items ───────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let itemNum = 1;

  for (const item of data.detalles) {
    const desc = item.descripcion || "—";
    // Wrap description to fit better
    const maxDescWidth = contentWidth - 18;
    const descLines = doc.splitTextToSize(desc, maxDescWidth);
    const displayDesc = descLines.length > 2 ? descLines.slice(0, 2).join("\n") + "…" : descLines.join("\n");

    doc.text(`${itemNum}`, margin, y);
    doc.text(displayDesc, margin + 6, y);
    doc.text(`${item.cantidad}`, margin + 28, y);
    doc.text(fmtCurrency(Number(item.subtotal)), ticketWidth - margin, y, { align: "right" });

    // Calculate lines consumed by wrapped desc
    const lineCount = displayDesc.split("\n").length;
    y += 4.5 * lineCount;

    // Show unit price if qty > 1
    if (item.cantidad > 1) {
      doc.setFontSize(7);
      doc.text(`  c/u ${fmtCurrency(Number(item.precio_unitario))}`, margin + 6, y);
      doc.setFontSize(8);
      y += 3.5;
    }

    y += 2; // extra spacing between items
    itemNum++;
  }

  y += 2;

  // ── Totals ──────────────────────────────────────────────
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 5;

  doc.setFontSize(9); // increased from 8
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", margin, y);
  doc.text(fmtCurrency(Number(data.orden.subtotal)), ticketWidth - margin, y, { align: "right" });
  y += 5;

  if (Number(data.orden.descuento) > 0) {
    doc.text("Descuento", margin, y);
    doc.text(`-${fmtCurrency(Number(data.orden.descuento))}`, ticketWidth - margin, y, { align: "right" });
    y += 5;
  }

  doc.setFontSize(12); // increased from 10
  doc.setFont("helvetica", "bold");
  doc.text("Total", margin, y);
  doc.text(fmtCurrency(Number(data.orden.total)), ticketWidth - margin, y, { align: "right" });
  y += 6;

  // ── Payment Info ─────────────────────────────────────────
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 5;

  // ── Notes ───────────────────────────────────────────────
  if (data.orden.notas) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    const notaLines = doc.splitTextToSize(data.orden.notas, contentWidth);
    doc.text(notaLines, margin, y);
    y += notaLines.length * 3.5 + 3;
  }

  if (data.pagos.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ABONOS", margin, y);
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const metodoLabels: Record<string, string> = { efectivo: "Efect.", tarjeta: "Tarj.", transferencia: "Transf.", cheque: "Cheque" };

    for (const pago of data.pagos) {
      const fecha = new Date(pago.created_at).toLocaleDateString("es-SV", { timeZone: "America/El_Salvador", day: "2-digit", month: "2-digit" });
      const metod = metodoLabels[pago.metodo_pago] ?? pago.metodo_pago;
      doc.text(`${fecha} ${metod}`, margin, y);
      doc.text(fmtCurrency(Number(pago.monto)), ticketWidth - margin, y, { align: "right" });
      y += 4.5;
    }

    y += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Total Abonado:", margin, y);
    doc.text(fmtCurrency(data.totalAbonado), ticketWidth - margin, y, { align: "right" });
    y += 5;
  }

  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SALDO PENDIENTE", margin, y);
  doc.text(fmtCurrency(Math.max(data.saldoPendiente, 0)), ticketWidth - margin, y, { align: "right" });
  y += 6;

  // ── Amount in Words ──────────────────────────────────────
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 4;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Importe en letras:", margin, y);
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const importeLetras = numeroALetras(Number(data.orden.total) || 0);
  const letraLines = doc.splitTextToSize(importeLetras, contentWidth);
  doc.text(letraLines, margin, y);
  y += letraLines.length * 3.5 + 3;

  // ── Terms ────────────────────────────────────────────────
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, ticketWidth - margin, y);
  y += 4;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Términos y condiciones: 90 días de garantía por", margin, y);
  y += 3;
  doc.text("desperfectos de fábrica", margin, y);
  y += 5;

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
