Ejecuta una auditoría de UX, rendimiento y compatibilidad multi-dispositivo del sistema o módulo especificado.

**Módulo o componente a auditar**: $ARGUMENTS (si vacío, auditar toda la app)

Actúa como experto en frontend Next.js 16 App Router + Tailwind CSS v4 con foco en:
- UX móvil-first para operadores de óptica en campo (celular, tablet)
- Performance Web Vitals (LCP, CLS, FID)
- Accesibilidad básica (ARIA, contraste, touch targets)
- Compatibilidad: Android Chrome, iOS Safari, Windows Chrome/Edge

---

## 1. AUDITORÍA RESPONSIVE

Para cada página/componente del módulo especificado (o todos si vacío):

### Breakpoints a verificar
```
Mobile:  < 640px  (sm) — operador en campaña con celular
Tablet:  640-1024px (md/lg) — recepcionista con iPad
Desktop: > 1024px (xl) — administrador con laptop/PC
```

### Checklist mobile-first
- [ ] Tablas largas: ¿tienen scroll horizontal o vista de cards en mobile?
- [ ] Formularios: ¿inputs tienen tamaño mínimo de 44px (touch target)?
- [ ] Botones de acción: ¿son accesibles con el pulgar en mobile (esquina inferior)?
- [ ] Modales/drawers: ¿ocupan full-screen en mobile o tienen overflow?
- [ ] Texto: ¿fuente mínima 16px en inputs (evita zoom automático en iOS)?
- [ ] Kanban: ¿funciona drag-and-drop en touch? ¿hay alternativa táctil?
- [ ] Navegación: ¿el menú lateral colapsa en mobile? ¿hay bottom nav?
- [ ] Filtros: ¿los dropdowns y date pickers funcionan en iOS Safari?
- [ ] PDFs: ¿el botón de descarga funciona en mobile?
- [ ] Imágenes/logos: ¿son responsive con next/image?

---

## 2. AUDITORÍA DE PERFORMANCE

### Server Components
- [ ] ¿Los page.tsx usan Server Components donde es posible?
- [ ] ¿Hay `"use client"` innecesario en componentes sin estado/eventos?
- [ ] ¿Los datos se obtienen en paralelo con `Promise.all` donde aplica?
- [ ] ¿Hay waterfall de queries que se puedan paralelizar?

### Loading states
- [ ] ¿Hay `loading.tsx` en rutas que hacen fetch de DB?
- [ ] ¿Los formularios tienen estado de carga (disabled + spinner) al submitir?
- [ ] ¿Las acciones destructivas tienen feedback visual inmediato?

### Bundle size
- [ ] ¿jsPDF y dnd-kit se importan solo en componentes `"use client"`?
- [ ] ¿Hay imports de librerías grandes en Server Components?
- [ ] ¿Se usan dynamic imports para componentes pesados?

### Imágenes y assets
- [ ] ¿Se usa `next/image` con width/height explícitos?
- [ ] ¿El logo de empresa tiene fallback cuando no hay URL?

---

## 3. AUDITORÍA DE ACCESIBILIDAD

- [ ] Formularios: ¿todos los inputs tienen `<label>` asociado?
- [ ] Botones icon-only: ¿tienen `aria-label`?
- [ ] Modales: ¿tienen `role="dialog"` y `aria-modal="true"`?
- [ ] Colores: ¿el contraste texto/fondo cumple WCAG AA (4.5:1)?
- [ ] Focus visible: ¿los elementos interactivos tienen outline en focus?
- [ ] Estados de error: ¿son descriptivos y no solo por color?
- [ ] Tablas: ¿tienen `<thead>` y `scope` en headers?

---

## 4. AUDITORÍA DE COMPATIBILIDAD

### iOS Safari (problemas comunes)
- [ ] `position: sticky` en tablas — puede no funcionar en Safari < 15
- [ ] `Date` parsing: ¿se usan formatos ISO 8601 completos? (Safari falla con "2026-03-21 10:00")
- [ ] `gap` en flexbox — verificar prefijos
- [ ] Inputs `type="date"` — UI diferente en iOS, ¿funciona el valor?
- [ ] `100vh` — en iOS incluye la barra del browser, usar `dvh` o workaround

### Android Chrome
- [ ] Teclado virtual: ¿los formularios hacen scroll para mostrar el input activo?
- [ ] `touch-action` en drag-and-drop del kanban

### Windows/Edge
- [ ] Scrollbar styling: ¿interfiere con el layout?
- [ ] Zoom del browser: ¿el layout aguanta al 125% y 150%?

---

## 5. MEJORES PRÁCTICAS NEXT.JS APP ROUTER

- [ ] ¿Los errores de Server Actions redirigen con mensajes genéricos (no DB internals)?
- [ ] ¿Hay `error.tsx` en rutas críticas?
- [ ] ¿Se usa `revalidatePath` correctamente después de mutaciones?
- [ ] ¿Los formularios usan `useTransition` o `useFormStatus` para UX optimista?
- [ ] ¿Los Server Actions lanzan errores que no se capturan en el cliente?

---

## OUTPUT ESPERADO

Genera un reporte con:

### 🔴 Crítico (rompe funcionalidad en algún dispositivo)
Lista cada issue con: componente/archivo, dispositivo afectado, descripción, fix sugerido con código Tailwind/React.

### 🟡 Importante (UX degradada pero funcional)
Idem.

### 🟢 Mejora (buenas prácticas, pulido)
Idem.

### ⚡ Performance wins (cambios de alto impacto, bajo esfuerzo)
Lista de optimizaciones ordenadas por ROI.

### 📋 Plan de implementación
Orden sugerido de fixes considerando dependencias y complejidad.
Al final, ejecuta los fixes que puedas de forma autónoma e indica cuáles requieren decisión del usuario.
