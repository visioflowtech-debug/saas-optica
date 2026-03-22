export const CATEGORIAS_GASTO = [
  { value: "transporte",   label: "Transporte" },
  { value: "hospedaje",    label: "Hospedaje" },
  { value: "alimentacion", label: "Alimentación" },
  { value: "publicidad",   label: "Publicidad" },
  { value: "operativo",    label: "Operativo" },
  { value: "otro",         label: "Otro" },
] as const;

export type CategoriaGasto = typeof CATEGORIAS_GASTO[number]["value"];

export interface Gasto {
  id: string;
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  fecha: string;
  notas: string | null;
  campana_id: string | null;
  campana?: { nombre: string } | null;
  registrado_por?: string | null;
  created_at: string;
}
