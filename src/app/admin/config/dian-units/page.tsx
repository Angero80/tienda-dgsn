'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

type DianUnit = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  created_at: string;
};

type StatusFilter = 'all' | 'active' | 'inactive';

// El catálogo tiene 1,087 filas. Traemos todo de una vez (es texto liviano,
// ~1087 filas de {id, code, name, active} pesa muy poco) y filtramos/pagi-
// namos en el cliente para que la búsqueda y los switches respondan al
// instante, sin ida y vuelta a Supabase por cada tecla.
export default function DianUnitsPage() {
  const [units, setUnits] = useState<DianUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase
      .from('dian_units_catalog')
      .select('id, code, name, active, created_at')
      .order('name');

    if (error) {
      setErrorMsg('Error cargando el catálogo: ' + error.message);
    } else {
      setUnits(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const activeCount = useMemo(
    () => units.filter((u) => u.active).length,
    [units]
  );

  const filteredUnits = useMemo(() => {
    const term = search.trim().toLowerCase();
    return units.filter((u) => {
      if (statusFilter === 'active' && !u.active) return false;
      if (statusFilter === 'inactive' && u.active) return false;
      if (!term) return true;
      return (
        u.name.toLowerCase().includes(term) ||
        u.code.toLowerCase().includes(term)
      );
    });
  }, [units, search, statusFilter]);

  // Si cambia el filtro/búsqueda y la página actual queda fuera de rango,
  // la regresamos a la 1 para no mostrar una página vacía por accidente.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUnits = filteredUnits.slice(startIndex, startIndex + itemsPerPage);

  const toggleActive = async (unit: DianUnit) => {
    const nextActive = !unit.active;

    // Optimista: refleja el cambio de inmediato en pantalla...
    setUnits((prev) =>
      prev.map((u) => (u.id === unit.id ? { ...u, active: nextActive } : u))
    );
    setSavingIds((prev) => new Set(prev).add(unit.id));

    const { error } = await supabase
      .from('dian_units_catalog')
      .update({ active: nextActive })
      .eq('id', unit.id);

    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(unit.id);
      return next;
    });

    // ...y si Supabase rechaza el cambio, lo revertimos y avisamos.
    if (error) {
      setUnits((prev) =>
        prev.map((u) => (u.id === unit.id ? { ...u, active: unit.active } : u))
      );
      setErrorMsg(`No se pudo actualizar "${unit.name}": ${error.message}`);
    }
  };

  if (loading) {
    return <div className="p-6">Cargando catálogo de unidades DIAN...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-black">Unidades de Medida DIAN</h1>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
          {activeCount} / {units.length} activas
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Catálogo oficial de unidades de medida (Resolución DIAN 000012 de 2021).
        Activa solo las que tu negocio usa; aparecerán como opción en
        Presentaciones de producto.
      </p>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-4 flex justify-between items-start gap-4">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg('')}
            className="text-red-400 hover:text-red-600 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra de herramientas: búsqueda + filtro de estado */}
      <div className="bg-white p-4 rounded-xl shadow mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-2 flex items-center text-gray-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre o código (ej: caja, docena, EA)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-black text-sm"
          />
        </div>

        <div className="flex gap-1">
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                statusFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Inactivas'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-black">
                Código
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-black">
                Nombre
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-black">
                Activa
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedUnits.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                  No se encontraron unidades con ese criterio
                </td>
              </tr>
            ) : (
              paginatedUnits.map((unit) => (
                <tr key={unit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-black font-mono text-sm">
                    {unit.code}
                  </td>
                  <td className="px-6 py-3 text-black capitalize">{unit.name}</td>
                  <td className="px-6 py-3">
                    <div className="flex justify-end items-center gap-2">
                      {savingIds.has(unit.id) && (
                        <span className="text-xs text-gray-400">Guardando...</span>
                      )}
                      <button
                        role="switch"
                        aria-checked={unit.active}
                        onClick={() => toggleActive(unit)}
                        disabled={savingIds.has(unit.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                          unit.active ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            unit.active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex justify-between items-center mt-4 text-sm">
        <span className="text-black">
          Mostrando {paginatedUnits.length === 0 ? 0 : startIndex + 1} a{' '}
          {Math.min(startIndex + itemsPerPage, filteredUnits.length)} de{' '}
          {filteredUnits.length} unidades
        </span>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded text-black disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-black">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded text-black disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
