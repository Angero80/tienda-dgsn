'use client';

import { useState } from 'react';

type Item = { id: number; name: string };

type Props = {
  items: Item[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

// Buscador tipo select: si ya hay algo elegido, muestra un "chip" con botón
// "Cambiar"; si no, muestra el campo de búsqueda con hasta 5 filas visibles
// y scroll para el resto — mismo patrón ya usado en Compras y Banners.
export default function RelationSearchSelect({ items, value, onChange, placeholder, disabled }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const selected = items.find((i) => String(i.id) === value);

  const term = search.trim().toLowerCase();
  const filtered = term ? items.filter((i) => i.name.toLowerCase().includes(term)) : items;

  if (disabled) {
    return (
      <div className="w-full p-2 border border-gray-200 rounded bg-gray-100 text-gray-400 text-sm">
        No aplica
      </div>
    );
  }

  if (selected && !open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSearch('');
        }}
        className="w-full flex items-center justify-between p-2 border border-gray-300 rounded text-gray-900 bg-white text-sm text-left"
      >
        <span className="truncate">{selected.name}</span>
        <span className="text-blue-600 text-xs ml-2 flex-shrink-0">Cambiar</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        autoFocus
        autoComplete="off"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder || 'Buscar...'}
        className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white text-sm"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-[180px] overflow-y-auto">
          {value && (
            <li
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('');
                setOpen(false);
                setSearch('');
              }}
              className="h-9 px-2 flex items-center text-gray-400 hover:bg-gray-100 cursor-pointer text-sm italic"
            >
              Sin selección
            </li>
          )}
          {filtered.map((item) => (
            <li
              key={item.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(String(item.id));
                setOpen(false);
                setSearch('');
              }}
              className="h-9 px-2 flex items-center hover:bg-gray-100 cursor-pointer text-sm text-gray-800 truncate"
            >
              {item.name}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="h-9 px-2 flex items-center text-gray-500 text-sm">Sin resultados</li>
          )}
        </ul>
      )}
    </div>
  );
}