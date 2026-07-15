'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { fetchAllDianUnits, activateDianUnit, DianUnit } from '../../../lib/dianUnitsCatalog';

export type Presentation = {
  id: number;
  name: string;
  dian_unit_id: number | null;
};

type Props = {
  existingPresentations: Presentation[];
  onSelect: (presentation: Presentation) => void;
  autoFocus?: boolean;
  placeholder?: string;
};

// Buscador cerrado al catálogo oficial DIAN. Muestra:
// - Presentaciones "legacy" ya guardadas (creadas antes de este cambio, sin
//   vínculo al catálogo) que coincidan con el texto.
// - Unidades del catálogo que coincidan por nombre o código:
//     · ya vinculadas a una presentación -> "usar" (selecciona la existente)
//     · activas pero sin presentación aún -> "usar" (crea la presentación)
//     · inactivas -> "Activar y usar" (activa en el catálogo + crea la presentación)
export default function PresentationSearch({
  existingPresentations,
  onSelect,
  autoFocus,
  placeholder = 'Buscar unidad (ej: caja, docena, EA)...',
}: Props) {
  const [units, setUnits] = useState<DianUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyUnitId, setBusyUnitId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAllDianUnits()
      .then(setUnits)
      .catch((err) => setError('Error cargando catálogo DIAN: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const linkedByUnitId = useMemo(() => {
    const map = new Map<number, Presentation>();
    existingPresentations.forEach((p) => {
      if (p.dian_unit_id) map.set(p.dian_unit_id, p);
    });
    return map;
  }, [existingPresentations]);

  const term = search.trim().toLowerCase();

  const legacyMatches = useMemo(() => {
    if (!term) return [];
    return existingPresentations.filter(
      (p) => !p.dian_unit_id && p.name.toLowerCase().includes(term)
    );
  }, [existingPresentations, term]);

  const catalogMatches = useMemo(() => {
    if (!term) return [];
    return units
      .filter((u) => u.name.toLowerCase().includes(term) || u.code.toLowerCase().includes(term))
      .slice(0, 30);
  }, [units, term]);

  const handleCatalogClick = async (unit: DianUnit) => {
    setError('');
    const linked = linkedByUnitId.get(unit.id);
    if (linked) {
      onSelect(linked);
      return;
    }

    setBusyUnitId(unit.id);
    try {
      if (!unit.active) {
        await activateDianUnit(unit.id);
      }
      const { data, error: insertError } = await supabase
        .from('presentations')
        .insert([{ name: unit.name, dian_unit_id: unit.id }])
        .select();

      if (insertError) throw insertError;
      if (data && data[0]) onSelect(data[0] as Presentation);
    } catch (err: any) {
      setError('Error al activar/crear: ' + err.message);
    } finally {
      setBusyUnitId(null);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        autoFocus={autoFocus}
        autoComplete="off"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2 bg-white border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
      />

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {loading && <p className="text-xs text-gray-400 mt-1">Cargando catálogo...</p>}

      {term && !loading && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-56 overflow-auto">
          {legacyMatches.map((p) => (
            <li
              key={`legacy-${p.id}`}
              onClick={() => onSelect(p)}
              className="p-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-800 flex justify-between"
            >
              <span>{p.name}</span>
              <span className="text-xs text-gray-400">guardada</span>
            </li>
          ))}

          {catalogMatches.map((unit) => {
            const linked = linkedByUnitId.get(unit.id);
            const busy = busyUnitId === unit.id;
            return (
              <li
                key={`unit-${unit.id}`}
                onClick={() => !busy && handleCatalogClick(unit)}
                className="p-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-800 flex justify-between items-center"
              >
                <span>
                  {unit.name} <span className="text-xs text-gray-400 font-mono">({unit.code})</span>
                </span>
                {busy ? (
                  <span className="text-xs text-gray-400">Procesando...</span>
                ) : linked ? (
                  <span className="text-xs text-green-600">usar</span>
                ) : unit.active ? (
                  <span className="text-xs text-blue-600">usar</span>
                ) : (
                  <span className="text-xs text-amber-600">Activar y usar</span>
                )}
              </li>
            );
          })}

          {legacyMatches.length === 0 && catalogMatches.length === 0 && (
            <li className="p-2 text-gray-500 text-sm">
              No existe en el catálogo DIAN ni en presentaciones guardadas.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}