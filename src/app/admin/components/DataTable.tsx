// src/app/admin/components/DataTable.tsx
'use client';

import { useState } from 'react';
import Modal from '../../../components/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function DataTable({
  title,
  columns,
  data,
  formFields,
  onAdd,
  onEdit,
  onDelete,
  children,
  extraFilters,
  printLandscape,
  renderActions
}: {
  title: string;
  columns: { key: string; label: string; render?: (item: any) => React.ReactNode; exportValue?: (item: any) => string; excludeFromExport?: boolean }[];
  data: Array<Record<string, any>>;
  formFields: Array<{ name: string; label: string; type?: string; options?: { value: string; label: string }[] }>;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: number) => void;
  children: React.ReactNode;
  extraFilters?: Array<{ control: React.ReactNode; label: string }>;
  printLandscape?: boolean;
  renderActions?: (item: any) => React.ReactNode;
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

  // ✅ Para exportar (CSV/Excel/PDF/Print) necesitamos TEXTO plano, no JSX.
  // Si la columna tiene un render() que devuelve texto/número (ej: nombre
  // de categoría en vez del id), lo usamos. Si el render devuelve algo no
  // textual (ej: una imagen), caemos de vuelta al valor crudo del campo.
  const getExportValue = (item: Record<string, any>, col: { key: string; render?: (item: any) => React.ReactNode; exportValue?: (item: any) => string }) => {
    if (col.exportValue) {
      return col.exportValue(item);
    }
    if (col.render) {
      const rendered = col.render(item);
      if (typeof rendered === 'string' || typeof rendered === 'number') {
        return String(rendered);
      }
    }
    const raw = item[col.key];
    return raw === null || raw === undefined ? '' : String(raw);
  };

  // ✅ Columnas que sí tiene sentido exportar/imprimir (excluye, por
  // ejemplo, una columna de imagen que en CSV/Excel/PDF no sirve de nada).
  const exportableColumns = columns.filter(c => !c.excludeFromExport);

  // Exportar a CSV
  const exportToCSV = () => {
    const headers = exportableColumns.map(c => c.label);
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item =>
        exportableColumns.map(c => `"${getExportValue(item, c).replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');

    // ✅ BOM UTF-8: evita que tildes/ñ se vean mal al abrir en Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // Exportar a Excel real (.xlsx)
  const exportToExcel = async () => {
    const XLSX = await import('xlsx');

    const rows = filteredData.map(item => {
      const row: Record<string, string> = {};
      exportableColumns.forEach(c => {
        row[c.label] = getExportValue(item, c);
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = exportableColumns.map(() => ({ wch: 22 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title.substring(0, 31));
    XLSX.writeFile(workbook, `${title.toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar a PDF
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.text(`${title}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 36);

    const tableData = filteredData.map(item => exportableColumns.map(c => getExportValue(item, c)));
    autoTable(doc, {
      head: [exportableColumns.map(c => c.label)],
      body: tableData,
      startY: 46,
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: 'ellipsize',
      },
      headStyles: {
        fontSize: 8,
        fillColor: [30, 64, 175],
      },
    });

    doc.save(`${title.toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const printReport = () => {
    // ✅ Por defecto se imprime en vertical (portrait), que es lo que
    // define globals.css. Si esta tabla en particular tiene muchas
    // columnas y necesita horizontal, inyectamos temporalmente una
    // regla @page que sobreescribe la global solo para esta impresión.
    let tempStyle: HTMLStyleElement | null = null;
    if (printLandscape) {
      tempStyle = document.createElement('style');
      tempStyle.textContent = '@media print { @page { size: A4 landscape; margin: 1cm; } }';
      document.head.appendChild(tempStyle);
    }

    window.print();

    if (tempStyle) {
      // Se retira después de imprimir para no afectar otras tablas
      setTimeout(() => tempStyle?.remove(), 500);
    }
  };

  return (
    <div className="p-6">
      {/* Nota: el CSS de impresión ya no vive aquí como <style jsx> scoped
          (eso nunca alcanzaba al sidebar ni a elementos fuera de este
          componente). Ahora está en globals.css como regla global. */}

      {/* Encabezado */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-black">{title}</h1>
        <button onClick={onAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
          + Nuevo
        </button>
      </div>

      {/* Barra de herramientas */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-col lg:flex-row items-start lg:items-center gap-4">
        {/* Exportar */}
        <div className="flex flex-col items-start">
          <span className="text-sm font-semibold text-gray-500 mb-2">Exportar</span>
          <div className="flex space-x-2">
            <button
              onClick={exportToCSV}
              title="Exportar a CSV"
              className="flex flex-col items-center justify-center w-11 h-11 bg-yellow-400 hover:bg-yellow-500 text-white rounded text-xs font-medium"
            >
              <span className="text-lg">📄</span>
              <span className="text-xs">CSV</span>
            </button>
            <button
              onClick={exportToExcel}
              title="Exportar a Excel"
              className="flex flex-col items-center justify-center w-11 h-11 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium"
            >
              <span className="text-lg">📊</span>
              <span className="text-xs">XLS</span>
            </button>
            <button
              onClick={exportToPDF}
              title="Exportar a PDF"
              className="flex flex-col items-center justify-center w-11 h-11 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
            >
              <span className="text-lg">📑</span>
              <span className="text-xs">PDF</span>
            </button>
            <button
              onClick={printReport}
              title="Imprimir en local"
              className="flex flex-col items-center justify-center w-11 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
            >
              <span className="text-lg">🖨️</span>
              <span className="text-xs">Print</span>
            </button>
          </div>
        </div>

        {/* Filtros — centrado en el espacio restante de la barra */}
        <div className="flex-1 flex justify-center">
          <div className="flex flex-col items-start space-y-2">
            <span className="text-sm font-semibold text-gray-500">Filtros</span>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex flex-col">
                <div className="relative">
                  <span className="absolute inset-y-0 left-2 flex items-center text-gray-400 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoComplete="off"
                    className="pl-8 pr-2 py-2 border border-gray-300 rounded text-black text-sm w-full md:w-64 h-9"
                  />
                </div>
                <span className="text-xs text-gray-400 mt-1">Buscar</span>
              </div>

              {extraFilters?.map((f, i) => (
                <div key={i} className="flex flex-col">
                  {f.control}
                  <span className="text-xs text-gray-400 mt-1">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
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
                    <td key={col.key} className="px-6 py-4 text-black">
                      {col.render ? col.render(item) : item[col.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4">
                    {renderActions ? (
                      renderActions(item)
                    ) : (
                      <>
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
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex justify-between items-center mt-6 text-sm">
        <span className="text-black">
          Mostrando {paginatedData.length === 0 ? 0 : startIndex + 1} a{' '}
          {Math.min(startIndex + itemsPerPage, filteredData.length)} de {filteredData.length} {title.toLowerCase()}
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

      {/* Versión limpia para impresión */}
      <div className="print-only" suppressHydrationWarning>
        <h1>{title}</h1>
        <p>Fecha: {new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              {exportableColumns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map(item => (
              <tr key={item.id}>
                {exportableColumns.map(col => (
                  <td key={col.key}>{getExportValue(item, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {children}
    </div>
  );
}
