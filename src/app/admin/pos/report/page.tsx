'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAlertDialog } from '../../components/AlertDialogProvider';
import { formatCurrency } from '../../../../lib/formatCurrency';

// Datos simulados
const salesByHour = [
  { id: 1, hour: '8:00', sales: 120, cashier: 'John Doe', date: '2025-08-14' },
  { id: 2, hour: '9:00', sales: 180, cashier: 'John Doe', date: '2025-08-14' },
  { id: 3, hour: '10:00', sales: 210, cashier: 'Jane Smith', date: '2025-08-14' },
  { id: 4, hour: '11:00', sales: 250, cashier: 'John Doe', date: '2025-08-14' },
  { id: 5, hour: '12:00', sales: 190, cashier: 'Jane Smith', date: '2025-08-14' },
  { id: 6, hour: '13:00', sales: 220, cashier: 'John Doe', date: '2025-08-14' },
  { id: 7, hour: '14:00', sales: 200, cashier: 'Jane Smith', date: '2025-08-14' },
  { id: 8, hour: '15:00', sales: 170, cashier: 'John Doe', date: '2025-08-14' },
];

const topProducts = [
  { name: 'Laptop Premium', units: 8, revenue: 10399.92 },
  { name: 'Mochila Antirrobo', units: 15, revenue: 1349.85 },
  { name: 'Mouse Inalámbrico', units: 22, revenue: 550.00 },
];

const cashiers = ['Todos', 'John Doe', 'Jane Smith'];

export default function ReportPage() {
  const dialog = useAlertDialog();
  const [dateFrom, setDateFrom] = useState('2025-08-14');
  const [dateTo, setDateTo] = useState('2025-08-14');
  const [timeFrom, setTimeFrom] = useState('08:00');
  const [timeTo, setTimeTo] = useState('15:00');
  const [cashier, setCashier] = useState('Todos');

  // Formatear fecha a dd/mm/yyyy
  const formatDate = (isoDate: string) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  // Filtrar datos
  const filteredSales = salesByHour.filter((sale) => {
    const saleTime = parseInt(sale.hour.split(':')[0]);
    const filterTimeFrom = parseInt(timeFrom.split(':')[0]);
    const filterTimeTo = parseInt(timeTo.split(':')[0]);

    const inTimeRange = saleTime >= filterTimeFrom && saleTime <= filterTimeTo;
    const cashierMatch = cashier === 'Todos' || sale.cashier === cashier;

    return inTimeRange && cashierMatch;
  });

  const totalSales = filteredSales.reduce((sum, item) => sum + item.sales, 0);
  const totalTransactions = filteredSales.length * 3;
  const avgTicket = totalSales / totalTransactions;

  // ========================
  // ✅ EXPORTAR A CSV
  // ========================
  const exportCSV = () => {
    const headers = ['Hora', 'Ventas ($)', 'Cajero', 'Fecha'];
    const rows = filteredSales.map(s => `"${s.hour}","${s.sales}","${s.cashier}","${formatDate(s.date)}"`);
    downloadFile(rows.join('\n'), `informe_ventas_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv', headers);
  };

  // ========================
  // ✅ EXPORTAR A EXCEL (XLS)
  // ========================
  const exportExcel = () => {
    const headers = ['Hora', 'Ventas ($)', 'Cajero', 'Fecha'];
    const rows = filteredSales.map(s => `${s.hour}\t${s.sales}\t${s.cashier}\t${formatDate(s.date)}`);
    downloadFile(rows.join('\n'), `informe_ventas_${new Date().toISOString().split('T')[0]}.xls`, 'application/vnd.ms-excel', headers);
  };

  // ========================
  // ✅ EXPORTAR A PDF (funcional)
  // ========================
  const exportToPDF = async () => {
    if (typeof window === 'undefined') return;

    try {
      const jsPDF = await import('jspdf').then(m => m.default);
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text('Informe de Turno', 14, 15);
      doc.setFontSize(10);
      doc.text(`Rango: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`, 14, 22);
      doc.text(`Cajero: ${cashier}`, 14, 28);

      const tableData = filteredSales.map(item => [
        item.hour,
        `$${item.sales}`,
        item.cashier,
        formatDate(item.date)
      ]);

      (autoTable as any)(doc, {
        head: [['Hora', 'Ventas ($)', 'Cajero', 'Fecha']],
        body: tableData,
        startY: 35,
      });

      const finalY = (doc as any).lastAutoTable.finalY || 35;
      doc.text(`Total Ventas: $${formatCurrency(totalSales)}`, 14, finalY + 10);

      doc.save(`informe_turno_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      await dialog.alert('No se pudo crear el PDF. Instala: jspdf y jspdf-autotable', { variant: 'danger', title: 'Error' });
    }
  };

  // Imprimir versión limpia
const printReport = () => {
  window.print();
};

  // Función genérica para descarga
  const downloadFile = (data: string, filename: string, mime: string, headers?: string[]) => {
    const csvContent = [headers?.join(',') || '', data].join('\n');
    const blob = new Blob([csvContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* ======================== */}
      {/* ✅ ESTILOS PARA IMPRESIÓN */}
      {/* ======================== */}
     <style jsx>{`
        .print-only {
          display: none;
        }

  @media print {
    /* Oculta TODO el body */
    body * {
      visibility: hidden !important;
      opacity: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
    }

    /* Muestra SOLO el contenido de impresión */
    .print-only,
    .print-only * {
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      overflow: visible !important;
      color: #000 !important;
      background: transparent !important;
    }

    .print-only {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      padding: 20px !important;
      margin: 0 !important;
      box-sizing: border-box !important;
      font-family: Arial, sans-serif !important;
      background: white !important;
      z-index: 9999 !important;
      min-height: 100vh !important;
    }

    .print-only h1,
    .print-only h2,
    .print-only table,
    .print-only th,
    .print-only td {
      background: transparent !important;
      border-color: #000 !important;
      color: #000 !important;
    }

    .print-only table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 15px !important;
      font-size: 12px !important;
    }

    .print-only th,
    .print-only td {
      border: 1px solid #000 !important;
      padding: 6px 8px !important;
      text-align: left !important;
    }

    .print-only th {
      background-color: #f0f0f0 !important;
      font-weight: bold !important;
    }

    @page {
      size: A4 portrait;
      margin: 1cm;
      background: white;
    }

    /* Elimina cualquier fondo o sombra residual */
    * {
      background: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
  }
`}</style>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-black">Informe de Turno</h1>
          <Link href="/admin/pos" className="text-gray-700 hover:text-gray-900">
            ← Volver al POS
          </Link>
        </div>

        {/* Barra de herramientas */}
        <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Exportar */}
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-gray-500 mb-2">Exportar / Imprimir</span>
            <div className="flex space-x-2">
              <button
                onClick={exportCSV}
                title="Exportar a CSV"
                className="flex flex-col items-center justify-center w-11 h-11 bg-yellow-400 hover:bg-yellow-500 text-white rounded text-xs font-medium"
              >
                <span className="text-lg">📄</span>
                <span className="text-xs">CSV</span>
              </button>
              <button
                onClick={exportExcel}
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
                title="Imprimir informe"
                className="flex flex-col items-center justify-center w-11 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
              >
                <span className="text-lg">🖨️</span>
                <span className="text-xs">Print</span>
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col items-end space-y-2">
            <span className="text-sm font-semibold text-gray-500">Filtros</span>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 w-full md:w-auto">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="p-2 border border-gray-300 rounded text-black text-sm h-9"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="p-2 border border-gray-300 rounded text-black text-sm h-9"
              />
              <input
                type="time"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
                className="p-2 border border-gray-300 rounded text-black text-sm h-9"
              />
              <input
                type="time"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
                className="p-2 border border-gray-300 rounded text-black text-sm h-9"
              />
              <select
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
                className="p-2 border border-gray-300 rounded text-black text-sm h-9"
              >
                {cashiers.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ventas por hora */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-black mb-4">Ventas por Hora</h2>
            <div className="space-y-2">
              {filteredSales.map((item) => (
                <div key={item.id} className="flex justify-between text-sm border-b pb-1">
                  <span className="text-black">{item.hour}</span>
                  <span className="font-medium">${item.sales}</span>
                  <span className="text-gray-600 text-xs">{item.cashier}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-2 font-bold">
              Total: ${formatCurrency(totalSales)}
            </div>
          </div>

          {/* Productos más vendidos */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-black mb-4">Top Productos</h2>
            <div className="space-y-3">
              {topProducts.map((product, i) => (
                <div key={i} className="flex justify-between text-sm border-b pb-2">
                  <div>
                    <p className="font-medium text-black">{product.name}</p>
                    <p className="text-gray-600">Unidades: {product.units}</p>
                  </div>
                  <span className="font-semibold">${formatCurrency(product.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resumen general */}
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-black mb-4">Resumen General</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-black">{totalTransactions}</p>
              <p className="text-sm text-gray-600">Transacciones</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-black">${formatCurrency(totalSales)}</p>
              <p className="text-sm text-gray-600">Total Vendido</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-black">89</p>
              <p className="text-sm text-gray-600">Productos Únicos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-black">{formatCurrency(avgTicket)}</p>
              <p className="text-sm text-gray-600">Promedio por Ticket</p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================== */}
      {/* ✅ VERSIÓN PARA IMPRIMIR Y PDF */}
      {/* ======================== */}
     {/* Versión limpia para impresión */}
<div className="print-only" suppressHydrationWarning>
  <h1>Informe de Turno</h1>
  <p><strong>Rango:</strong> {formatDate(dateFrom)} - {formatDate(dateTo)}</p>
  <p><strong>Cajero:</strong> {cashier}</p>

  <h2>Ventas por Hora</h2>
  <table>
    <thead>
      <tr>
        <th>Hora</th>
        <th>Ventas ($)</th>
        <th>Cajero</th>
        <th>Fecha</th>
      </tr>
    </thead>
    <tbody>
      {filteredSales.map(item => (
        <tr key={item.id}>
          <td>{item.hour}</td>
          <td>${item.sales}</td>
          <td>{item.cashier}</td>
          <td>{formatDate(item.date)}</td>
        </tr>
      ))}
    </tbody>
  </table>

  <h2>Top Productos</h2>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th>Unidades</th>
        <th>Ingresos</th>
      </tr>
    </thead>
    <tbody>
      {topProducts.map((p, i) => (
        <tr key={i}>
          <td>{p.name}</td>
          <td>{p.units}</td>
          <td>${formatCurrency(p.revenue)}</td>
        </tr>
      ))}
    </tbody>
  </table>

  <p style={{ fontWeight: 'bold', marginTop: '15px' }}>
    Total Ventas: ${formatCurrency(totalSales)} | Transacciones: {totalTransactions} | Promedio: ${formatCurrency(avgTicket)}
  </p>
</div>
    </>
  );
}