"use client";

import { useState } from "react";

const ETIQUETAS_COMUNES = [
  "Diabetes", "Hipertensión", "Glaucoma", "Cataratas",
  "Astigmatismo", "Miopía", "Hipermetropía", "Presbicia",
  "Retinopatía", "Ojo seco",
];

export default function EtiquetasMedicasInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);

  const parseTags = (v: string) => v.split(",").map((t) => t.trim()).filter(Boolean);

  const toggleTag = (tag: string) => {
    const tags = parseTags(value);
    const exists = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
    const next = exists ? tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...tags, tag];
    setValue(next.join(", "));
  };

  const activeTags = parseTags(value).map((t) => t.toLowerCase());

  return (
    <div>
      <input
        name="etiquetas_medicas"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Diabetes, Miopía, Hipertensión..."
        className="w-full px-4 py-2.5 bg-input border border-b-default rounded-lg text-t-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {ETIQUETAS_COMUNES.map((tag) => {
          const active = activeTags.includes(tag.toLowerCase());
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1 text-[11px] font-medium border rounded-full transition cursor-pointer ${
                active
                  ? "bg-a-red-bg text-t-red border-a-red-border"
                  : "bg-badge text-t-secondary border-b-default hover:bg-card-hover hover:text-t-primary"
              }`}
            >
              {active ? "✓" : "+"} {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
