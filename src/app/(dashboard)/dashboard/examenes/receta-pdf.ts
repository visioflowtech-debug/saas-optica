"use client";

import { jsPDF } from "jspdf";

interface RecetaData {
  empresa: { nombre: string; nit: string | null; logo_url: string | null; email: string | null } | null;
  sucursal: { nombre: string; direccion: string | null; telefono: string | null } | null;
  numero_junta?: string | null;
  examen: {
    fecha_examen: string;
    motivo_consulta: string | null;
    lente_uso: string | null;
    av_od_sin_lentes: string | null;
    av_oi_sin_lentes: string | null;
    dp: number | null;
    altura: number | null;
    observaciones: string | null;
    rf_od_esfera: number | null; rf_od_cilindro: number | null; rf_od_eje: number | null; rf_od_adicion: number | null;
    rf_oi_esfera: number | null; rf_oi_cilindro: number | null; rf_oi_eje: number | null; rf_oi_adicion: number | null;
    ra_od_esfera: number | null; ra_od_cilindro: number | null; ra_od_eje: number | null; ra_od_adicion: number | null;
    ra_oi_esfera: number | null; ra_oi_cilindro: number | null; ra_oi_eje: number | null; ra_oi_adicion: number | null;
    paciente: { nombre: string; telefono: string | null; email: string | null } | { nombre: string; telefono: string | null; email: string | null }[] | null;
    optometrista: { nombre: string } | { nombre: string }[] | null;
  };
}

function getNestedName(rel: { nombre: string } | { nombre: string }[] | null): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.nombre ?? "—";
  return rel.nombre;
}

function getNestedPatient(rel: RecetaData["examen"]["paciente"]): { nombre: string; telefono: string | null; email: string | null } {
  if (!rel) return { nombre: "—", telefono: null, email: null };
  if (Array.isArray(rel)) return rel[0] ?? { nombre: "—", telefono: null, email: null };
  return rel;
}

function fmtNum(val: number | null): string {
  return val != null ? (val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2)) : "—";
}

export async function generarRecetaPDF(data: RecetaData) {
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

  // Half-page: letter width (215.9mm) × half height (~139.7mm)
  const pageWidth = 215.9;
  const pageHeight = 139.7;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [pageHeight, pageWidth] });
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const paciente = getNestedPatient(data.examen.paciente);
  const optNombre = getNestedName(data.examen.optometrista);
  const empresaNombre = data.empresa?.nombre ?? "Óptica";
  const sucursalDir = data.sucursal?.direccion ?? "";
  const sucursalTel = data.sucursal?.telefono ?? "";

  // ── Header bar ──────────────────────────────────────────
  let hasLogo = false;
  let logoY = 4;
  
  if (data.empresa?.logo_url) {
    try {
      const base64Logo = await loadImage(data.empresa.logo_url);
      const logoWidth = 24;
      const logoHeight = 24;
      doc.addImage(base64Logo, 'PNG', margin, logoY, logoWidth, logoHeight);
      hasLogo = true;
    } catch (e) {
      console.warn("Could not load logo image for PDF", e);
    }
  }

  // Draw a top accent line instead of a full box so the logo rests naturally
  doc.setFillColor(30, 58, 138); // Dark blue accent
  doc.rect(0, 0, pageWidth, 2, "F");

  doc.setTextColor(30, 58, 138);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(empresaNombre.toUpperCase(), pageWidth / 2, 10, { align: "center" });

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  
  // Format the sub header (address, phone, NIT) with word wrapping
  let currentY = 16;
  if (sucursalDir) {
    const splitDir = doc.splitTextToSize(sucursalDir, pageWidth - 30);
    for (let i = 0; i < splitDir.length; i++) {
        doc.text(splitDir[i], pageWidth / 2, currentY, { align: "center" });
        currentY += 3;
    }
  }

  const secondaryParts: string[] = [];
  if (sucursalTel) secondaryParts.push(`Tel: ${sucursalTel}`);
  if (data.empresa?.nit) secondaryParts.push(`NIT: ${data.empresa.nit}`);
  if (data.empresa?.email) secondaryParts.push(`${data.empresa.email}`);
  
  if (secondaryParts.length > 0) {
      doc.text(secondaryParts.join("  •  "), pageWidth / 2, currentY, { align: "center" });
      currentY += 4;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RECETA ÓPTICA", pageWidth / 2, currentY + 2, { align: "center" });

  y = currentY + 10;

  // ── Date right-aligned ──────────────────────────────────
  const fechaStr = new Date(data.examen.fecha_examen).toLocaleDateString("es-SV", {
    timeZone: "America/El_Salvador", year: "numeric", month: "long", day: "numeric",
  });
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${fechaStr}`, pageWidth - margin, y, { align: "right" });

  // ── Patient Info (compact) ──────────────────────────────
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PACIENTE", margin, y);
  y += 5;

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(paciente.nombre, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const contactParts: string[] = [];
  if (paciente.telefono) contactParts.push(`Tel: ${paciente.telefono}`);
  if (paciente.email) contactParts.push(paciente.email);
  if (contactParts.length > 0) {
    doc.setTextColor(80, 80, 80);
    doc.text(contactParts.join("  |  "), margin + 60, y);
  }
  y += 6;

  // Thin separator
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ── Refraction Table (RF only) ──────────────────────────
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("REFRACCIÓN FINAL (PRESCRIPCIÓN)", margin, y);
  y += 6;

  // Table header
  const colX = [margin, margin + 18, margin + 48, margin + 78, margin + 108];
  const colLabels = ["Ojo", "Esfera", "Cilindro", "Eje", "Adición"];

  doc.setFillColor(235, 240, 255);
  doc.rect(margin, y - 4, contentWidth, 7, "F");

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  colLabels.forEach((label, i) => {
    doc.text(label, colX[i] + (i === 0 ? 0 : 12), y, { align: i === 0 ? "left" : "center" });
  });
  y += 6;

  // Table rows
  const ex = data.examen;
  const rows = [
    { ojo: "OD", esfera: fmtNum(ex.rf_od_esfera), cilindro: fmtNum(ex.rf_od_cilindro), eje: ex.rf_od_eje != null ? `${ex.rf_od_eje}°` : "—", adicion: fmtNum(ex.rf_od_adicion) },
    { ojo: "OI", esfera: fmtNum(ex.rf_oi_esfera), cilindro: fmtNum(ex.rf_oi_cilindro), eje: ex.rf_oi_eje != null ? `${ex.rf_oi_eje}°` : "—", adicion: fmtNum(ex.rf_oi_adicion) },
  ];

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);

  for (const row of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(row.ojo, colX[0], y);
    doc.setFont("helvetica", "normal");
    doc.text(row.esfera, colX[1] + 12, y, { align: "center" });
    doc.text(row.cilindro, colX[2] + 12, y, { align: "center" });
    doc.text(row.eje, colX[3] + 12, y, { align: "center" });
    doc.text(row.adicion, colX[4] + 12, y, { align: "center" });
    y += 7;
  }

  y += 2;

  // ── Observaciones ───────────────────────────────────────
  if (data.examen.observaciones) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setTextColor(30, 58, 138);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVACIONES", margin, y);
    y += 5;

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const obsLines = doc.splitTextToSize(data.examen.observaciones, contentWidth);
    doc.text(obsLines, margin, y);
    y += obsLines.length * 4 + 2;
  }

  // ── Optometrista signature ──────────────────────────────
  const sigY = Math.max(y + 8, pageHeight - 26);

  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  const sigCenterX = pageWidth / 2;
  doc.line(sigCenterX - 35, sigY, sigCenterX + 35, sigY);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(optNombre, sigCenterX, sigY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Optometrista", sigCenterX, sigY + 8, { align: "center" });
  if (data.numero_junta) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6.5);
    doc.text(`No. Junta: ${data.numero_junta}`, sigCenterX, sigY + 12, { align: "center" });
  }

  // ── Bottom bar ──────────────────────────────────────────
  doc.setFillColor(235, 240, 255);
  doc.rect(0, pageHeight - 7, pageWidth, 7, "F");
  doc.setTextColor(140, 140, 140);
  doc.setFontSize(6);
  doc.text(
    `${empresaNombre} — Receta generada el ${new Date().toLocaleDateString("es-SV", { timeZone: "America/El_Salvador" })}`,
    pageWidth / 2,
    pageHeight - 3,
    { align: "center" }
  );

  // Save
  const fileName = `Receta_${paciente.nombre.replace(/\s+/g, "_")}_${fechaStr.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}
