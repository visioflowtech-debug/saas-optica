"use client";

import { useEffect } from "react";

/**
 * Chrome/Firefox cambian el valor de un input[type=number] enfocado al girar
 * la rueda del mouse sobre él (−0.01 por tick con step="0.01"). Como la app
 * oculta los spinners, el usuario nunca lo nota y quedan montos como 19.99
 * en vez de 20.00. Este guard quita el foco antes de que el navegador
 * aplique el paso, sin bloquear el scroll de la página.
 */
export default function NumberInputGuard() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === "number" && e.target === el) {
        el.blur();
      }
    };
    document.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);
  return null;
}
