// src/app/admin/components/SearchSelect.tsx (versión editable)
'use client';

import { useState } from 'react';

type Option = { value: string; label: string };

type SearchSelectProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onCreateNew: (name: string) => void;
  placeholder?: string;
  label: string;
};

export default function SearchSelect({
  options,
  value,
  onChange,
  onCreateNew,
  placeholder = 'Buscar o crear...',
  label
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setSearch(option.label);
    setIsOpen(false);
  };

  const handleCreate = () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    
    const exists = options.some(opt => opt.label.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      onCreateNew(trimmed); // Llama a la función para crear nueva categoría
    } else {
      const existing = options.find(opt => opt.label.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        onChange(existing.value);
      }
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-white mb-1">{label}</label>
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(''); // Limpia el valor si está escribiendo
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
      />
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b border-gray-600">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-1 bg-gray-700 border border-gray-500 rounded text-white"
              placeholder="Filtrar..."
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <ul>
            {filteredOptions.length === 0 ? (
              <li className="p-2 text-gray-400 text-sm">No se encontraron resultados</li>
            ) : (
              filteredOptions.map((option) => (
                <li
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  className="p-2 hover:bg-gray-600 cursor-pointer text-sm text-gray-200"
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
          <div className="p-2 border-t border-gray-600 bg-gray-700">
            <button
              onClick={handleCreate}
              className="w-full text-left px-2 py-1 text-sm text-blue-300 hover:text-blue-100"
            >
              {options.some(o => o.label.toLowerCase() === search.toLowerCase().trim())
                ? `Usar "${search}"`
                : `Crear nueva: "${search}"`
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}