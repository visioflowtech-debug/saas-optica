"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Check, PackageOpen } from "lucide-react";

export interface CatalogItem {
  id: string;
  tipo: string;
  label: string;
  precio: number;
  stock: number | null;
  maneja_stock: boolean;
}

interface ProductAutocompleteProps {
  items: CatalogItem[];
  value: string;
  onChange: (id: string, item: CatalogItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProductAutocomplete({
  items,
  value,
  onChange,
  placeholder = "Buscar producto...",
  disabled = false,
}: ProductAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [prevValue, setPrevValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync searchTerm with value prop without using useEffect
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      const selectedItem = items.find((i) => i.id === value);
      if (selectedItem) {
        setSearchTerm(selectedItem.label);
      }
    } else {
      setSearchTerm("");
    }
  }

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Revert search term to selected item if not selected
        if (value) {
          const selectedItem = items.find((i) => i.id === value);
          if (selectedItem) setSearchTerm(selectedItem.label);
        } else {
          setSearchTerm("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, items]);

  // Filter items based on search term
  const filteredItems = items.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.label.toLowerCase().includes(searchLower) ||
      item.tipo.toLowerCase().includes(searchLower)
    );
  });

  const handleSelect = (item: CatalogItem) => {
    onChange(item.id, item);
    setSearchTerm(item.label);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", null);
    setSearchTerm("");
    setIsOpen(true);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-t-muted" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (value && e.target.value !== items.find(i => i.id === value)?.label) {
               onChange("", null); // Clear selection if typing something else
            }
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 bg-input border border-b-default rounded-lg text-t-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {searchTerm && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-t-muted hover:text-t-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-sidebar border border-b-default rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.25)] max-h-60 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-3 text-sm text-t-muted text-center">
              No se encontraron productos.
            </div>
          ) : (
            <div className="py-1">
              {filteredItems.map((item) => {
                const isSelected = item.id === value;
                const isOutOfStock = item.maneja_stock && (item.stock === null || item.stock <= 0);
                
                let tipoIcon = "📦";
                if (item.tipo === "aro") tipoIcon = "🕶️";
                if (item.tipo === "lente") tipoIcon = "🔍";
                if (item.tipo === "tratamiento") tipoIcon = "✨";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={`px-3 py-2 cursor-pointer transition-colors flex items-start gap-3 hover:bg-input ${
                      isSelected ? "bg-a-blue-bg" : ""
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5 text-base">{tipoIcon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className={`text-sm font-medium truncate pr-2 ${isSelected ? "text-t-blue" : "text-t-primary"}`}>
                          {item.label}
                        </span>
                        <span className="text-sm font-mono text-t-secondary whitespace-nowrap">
                          ${item.precio.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-t-muted capitalize">
                          {item.tipo}
                        </span>
                        
                        {item.maneja_stock && (
                          <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold ${
                            isOutOfStock ? "text-t-red" : "text-t-green"
                          }`}>
                            <PackageOpen className="w-3 h-3" />
                            {isOutOfStock ? "Agotado" : `${item.stock} en stock`}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 flex items-center h-full">
                        <Check className="w-4 h-4 text-t-blue mt-1" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
