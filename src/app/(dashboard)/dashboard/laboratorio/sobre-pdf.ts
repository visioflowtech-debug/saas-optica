"use client";

import { jsPDF } from "jspdf";
import { imprimirPDF } from "@/lib/print-pdf";

interface SobreData {
  empresa: { nombre: string; logo_url: string | null; email: string | null };
  sucursalTel: string | null;
  orden: {
    id: string;
    created_at: string;
  };
  paciente: {
    nombre: string;
    telefono: string | null;
  };
  examen: {
    rf_od_esfera: number | null;
    rf_od_cilindro: number | null;
    rf_od_eje: number | null;
    rf_od_adicion: number | null;
    rf_oi_esfera: number | null;
    rf_oi_cilindro: number | null;
    rf_oi_eje: number | null;
    rf_oi_adicion: number | null;
    dp: number | null;
    altura: number | null;
    lente_uso: string | null;
    observaciones: string | null;
  } | null;
  detalles: {
    tipo_producto: string;
    descripcion: string | null;
    cantidad: number;
  }[];
  laboratorioDatos?: {
    tipo_lente: string | null;
    color_lente: string | null;
    material_lente: string | null;
    tratamiento_lente: string | null;
    marca_aro: string | null;
    color_aro: string | null;
    tamano_aro: string | null;
    horizontal_aro: string | null;
    vertical_aro: string | null;
    diagonal_aro: string | null;
    puente_aro: string | null;
    varilla_aro: string | null;
    tipo_aro: string | null;
    dp_od: string | null;
    dp_oi: string | null;
    dp: string | null;
    altura: string | null;
    observaciones: string | null;
  } | null;
}

export async function generarSobreLaboratorioPDF(data: SobreData) {
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

  // Letter Landscape: 279.4mm x 215.9mm
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  
  const marginLeft = 82;     // 8.2 cm
  const marginRight = 70;    // 7.0 cm
  const marginTop = 15;      // 1.5 cm
  const marginBottom = 15;   // 1.5 cm
  const pageWidth = 279.4;   // Letter width
  
  const rightEdge = pageWidth - marginRight;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const centerX = marginLeft + contentWidth / 2;
  
  let y = marginTop;

  // ── Header ──────────────────────────────────────────────
  let hasLogo = false;
  if (data.empresa?.logo_url) {
    try {
      const base64Logo = await loadImage(data.empresa.logo_url);
      const logoWidth = 24;
      const logoHeight = 24;
      doc.addImage(base64Logo, 'PNG', marginLeft, y - 4, logoWidth, logoHeight);
      hasLogo = true;
    } catch (e) {
      console.warn("Could not load logo image for PDF", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  // If logo exists, shift text slightly below the top alignment, else keep as is
  const textY = hasLogo ? y + 4 : y;
  doc.text(data.empresa.nombre.toUpperCase(), centerX, textY, { align: "center" });
  
  if (data.empresa.email || data.sucursalTel) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const parts = [];
      if (data.empresa.email) parts.push(data.empresa.email);
      if (data.sucursalTel) parts.push(`Tel: ${data.sucursalTel}`);
      doc.text(parts.join("  •  "), centerX, textY + 4, { align: "center" });
      y = textY + 4;
  }
  
  y += hasLogo ? Math.max(16, 6) : 6;
  
  doc.setFontSize(10);
  doc.text("SOBRE DE LABORATORIO", centerX, y, { align: "center" });
  y += 8;

  // ── Info General ────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const fechaStr = new Date(data.orden.created_at).toLocaleDateString("es-SV", {
    timeZone: "America/El_Salvador", year: "numeric", month: "long", day: "numeric",
  });
  doc.text(`Fecha: ${fechaStr}`, marginLeft, y);
  doc.text(`Orden #: ${data.orden.id.split("-")[0].toUpperCase()}`, rightEdge, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text(`Paciente: ${data.paciente.nombre}`, marginLeft, y);
  y += 6;

  // ── Receta (Graduación Actual) ──────────────────────────
  if (data.examen) {
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, y, rightEdge, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("GRADUACIÓN A PROCESAR", marginLeft, y);
    y += 5;

    // Table Header
    doc.setFontSize(8);
    const colOjo = marginLeft;
    const colEsf = marginLeft + 15;
    const colCil = marginLeft + 35;
    const colEje = marginLeft + 55;
    const colAdd = marginLeft + 75;

    doc.text("OJO", colOjo, y);
    doc.text("ESFERA", colEsf, y);
    doc.text("CILINDRO", colCil, y);
    doc.text("EJE", colEje, y);
    doc.text("ADICIÓN", colAdd, y);
    y += 4;
    doc.line(marginLeft, y, rightEdge, y);
    y += 4;

    const fmtNum = (val: number | null) => (val != null ? (val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)) : "—");
    
    // OD
    doc.setFont("helvetica", "bold");
    doc.text("OD", colOjo, y);
    doc.setFont("helvetica", "normal");
    doc.text(fmtNum(data.examen.rf_od_esfera), colEsf, y);
    doc.text(fmtNum(data.examen.rf_od_cilindro), colCil, y);
    doc.text(data.examen.rf_od_eje != null ? `${data.examen.rf_od_eje}°` : "—", colEje, y);
    doc.text(fmtNum(data.examen.rf_od_adicion), colAdd, y);
    y += 5;

    // OI
    doc.setFont("helvetica", "bold");
    doc.text("OI", colOjo, y);
    doc.setFont("helvetica", "normal");
    doc.text(fmtNum(data.examen.rf_oi_esfera), colEsf, y);
    doc.text(fmtNum(data.examen.rf_oi_cilindro), colCil, y);
    doc.text(data.examen.rf_oi_eje != null ? `${data.examen.rf_oi_eje}°` : "—", colEje, y);
    doc.text(fmtNum(data.examen.rf_oi_adicion), colAdd, y);
    y += 6;

    // Extra metrics (Use lab datos first, fallback to exam)
    const lab = data.laboratorioDatos;
    
    // ── Lentes ──────────────────────────────────────────────
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, y, rightEdge, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("ESPECIFICACIONES DE LENTES Y ARO", marginLeft, y);
    y += 5;

    doc.setFontSize(8);
    const lineH = 4;
    
    // Lentes Info
    doc.setFont("helvetica", "bold"); doc.text("Lentes:", marginLeft, y); 
    doc.setFont("helvetica", "normal"); 
    let lenteInfo = "";
    if (lab?.tipo_lente) lenteInfo += `Tipo: ${lab.tipo_lente}  `;
    if (lab?.color_lente) lenteInfo += `Color: ${lab.color_lente}  `;
    if (lab?.material_lente) lenteInfo += `Material: ${lab.material_lente}  `;
    if (lab?.tratamiento_lente) lenteInfo += `Tratamiento: ${lab.tratamiento_lente}`;
    doc.text(lenteInfo || "—", marginLeft + 12, y);
    y += lineH;

    // Aro Info
    doc.setFont("helvetica", "bold"); doc.text("Aro:", marginLeft, y);
    doc.setFont("helvetica", "normal");
    let aroInfo1 = "";
    if (lab?.marca_aro) aroInfo1 += `Marca: ${lab.marca_aro}  `;
    if (lab?.color_aro) aroInfo1 += `Color: ${lab.color_aro}  `;
    if (lab?.tipo_aro) aroInfo1 += `Tipo: ${lab.tipo_aro}`;
    doc.text(aroInfo1 || "—", marginLeft + 8, y);
    y += lineH;

    let aroInfo2 = "";
    if (lab?.tamano_aro) aroInfo2 += `Tamaño: ${lab.tamano_aro}  `;
    if (lab?.horizontal_aro) aroInfo2 += `H: ${lab.horizontal_aro}  `;
    if (lab?.vertical_aro) aroInfo2 += `V: ${lab.vertical_aro}  `;
    if (lab?.diagonal_aro) aroInfo2 += `D: ${lab.diagonal_aro}  `;
    if (lab?.puente_aro) aroInfo2 += `Puente: ${lab.puente_aro}  `;
    if (lab?.varilla_aro) aroInfo2 += `Varilla: ${lab.varilla_aro}`;
    if (aroInfo2) {
      doc.text(aroInfo2, marginLeft + 8, y);
      y += lineH;
    }

    // Medidas Adicionales
    y += 2;
    doc.setFont("helvetica", "bold"); doc.text("Medidas Extras:", marginLeft, y);
    doc.setFont("helvetica", "normal");
    let med = "";
    const effectiveDpOd = lab?.dp_od;
    const effectiveDpOi = lab?.dp_oi;
    const effectiveDp = lab?.dp || data.examen.dp;
    const effectiveAltura = lab?.altura || data.examen.altura;
    if (effectiveDpOd) med += `DP OD: ${effectiveDpOd}   `;
    if (effectiveDpOi) med += `DP OI: ${effectiveDpOi}   `;
    if (effectiveDp) med += `DP: ${effectiveDp}   `;
    if (effectiveAltura) med += `Altura: ${effectiveAltura}`;
    
    if (med) {
      doc.text(med, marginLeft + 25, y);
      y += lineH;
    }

    // Observaciones propias de la orden de laboratorio (no del examen)
    const obs = lab?.observaciones;
    if (obs) {
      y += 2;
      doc.setFont("helvetica", "bold"); doc.text("Observaciones:", marginLeft, y);
      y += lineH;
      doc.setFont("helvetica", "normal");
      const obsLines = doc.splitTextToSize(obs, contentWidth);
      doc.text(obsLines, marginLeft, y);
      y += obsLines.length * lineH;
    }
  }

  imprimirPDF(doc);
}
