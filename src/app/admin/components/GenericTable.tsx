// src/app/admin/components/GenericTable.tsx
'use client';

import { useState } from 'react';
import Modal from '../../../components/Modal';

export default function GenericTable({
  title,
  columns,
  data,
  onAdd,
  onEdit,
  onDelete,
  children
}: {
  title: string;
  columns: { key: string; label: string }[];
  data: Array<Record<string, any>>;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: number) => void;
  children: React.ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const filteredData = data.filter(item =>
    Object.values(item).some(val =>
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-black">{title}</h1>
        <button onClick={onAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
          + Nuevo
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="p-2 border border-gray-300 rounded text-black text-sm h-9"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="px-6 py-3 text-left text-sm font-semibold text-black">
                  {col.label}
                </th>
              ))}
              <th className="px-6 py-3 text-left text-sm font-semibold text-black">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-4 text-center text-gray-500">
                  No se encontraron registros
                </td>
              </tr>
            ) : (
              paginatedData.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col.key} className="px-6 py-4 text-black">{item[col.key]}</td>
                  ))}
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onEdit(item)}
                      className="text-blue-600 hover:underline text-sm mr-2"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-6 text-sm">
        <span className="text-black">
          Mostrando {paginatedData.length === 0 ? 0 : startIndex + 1} a{' '}
          {Math.min(startIndex + itemsPerPage, filteredData.length)} de {filteredData.length}
        </span>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded text-black disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-black">
            Página {currentPage} de {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages || 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-3 py-1 border border-gray-300 rounded text-black disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}