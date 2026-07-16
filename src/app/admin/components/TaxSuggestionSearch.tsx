'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type Suggestion = {
  code: string;
  description: string;
  category_name: string;
  iva_rate: number;
};

type Tax = { id: number; name: string; rate: number };

type Props = {
  taxes: Tax[];
  onApply: (tax: Tax) => void;
};

// Busca en la referencia de la Canasta Familiar del DANE (cargada una vez en
// Configuración → Impuestos) y sugiere qué impuesto activo aplicar según la
// tarifa de IVA que le corresponde a ese tipo de producto. Es una ayuda para
// no tener que memorizar la tarifa de cada producto — no reemplaza el
// criterio del contador en casos dudosos.
export default function TaxSuggestionSearch({ taxes, onApply }: Props) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('dane_canasta_familiar_iva')
      .select('code, description, category_name, iva_rate')
      .then(({ data, error }) => {
        if (error) console.error('Error cargando referencia de IVA:', error.message);
        setItems(data || []);
        setLoading(false);
      });
  }, []);

  const term = search.trim().toLowerCase();
  const matches = term
    ? items.filter((i) => i.description.toLowerCase().includes(term)).slice(0, 8)
    : [];

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onBlur={() => setTimeout(() => setSearch(''), 150)}
        placeholder="🔍 Buscar tipo de producto para sugerir tarifa (ej: arroz, cerveza)..."
        className="w-full p-2 border border-gray-300 rounded text-gray-900 text-sm bg-white"
      />

      {loading && <p className="text-xs text-gray-400 mt-1">Cargando referencia...</p>}

      {term && !loading && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-56 overflow-auto">
          {matches.map((item) => {
            const matchedTax = taxes.find((t) => Number(t.rate) === item.iva_rate);
            return (
              <li
                key={item.code}
                className="p-2 flex items-center justify-between text-sm border-b last:border-b-0"
              >
                <div className="min-w-0">
                  <span className="text-gray-800">{item.description}</span>
                  <span className="text-gray-400 text-xs ml-1">({item.category_name})</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs font-medium text-gray-600">{item.iva_rate}%</span>
                  {matchedTax ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onApply(matchedTax);
                        setSearch('');
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded whitespace-nowrap"
                    >
                      Aplicar
                    </button>
                  ) : (
                    <span className="text-xs text-amber-600 whitespace-nowrap">
                      Sin impuesto al {item.iva_rate}%
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {matches.length === 0 && (
            <li className="p-2 text-gray-500 text-sm">Sin resultados en la referencia DANE</li>
          )}
        </ul>
      )}

      <div className="mt-1 bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs text-blue-800">
        💡 Sugerencia según la Canasta Familiar DANE — verifica casos dudosos con tu contador.
      </div>
    </div>
  );
}