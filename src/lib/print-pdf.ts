"use client";

import type { jsPDF } from "jspdf";

/**
 * Abre el PDF generado en una ventana oculta (iframe) y lanza el diálogo
 * de impresión automáticamente. No descarga el archivo.
 */
export function imprimirPDF(doc: jsPDF): void {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Fallback: abrir en nueva pestaña si el iframe no puede imprimir
      window.open(url, "_blank");
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60_000); // limpiar tras 1 min (da tiempo a que el diálogo cierre)
  };

  iframe.src = url;
}
