'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAlertDialog } from '../../components/AlertDialogProvider';

export default function CloseCashPage() {
  const dialog = useAlertDialog();
  const [cashAmount, setCashAmount] = useState('');
  const [isClosed, setIsClosed] = useState(false);

  const handleClose = async () => {
    if (!cashAmount || parseFloat(cashAmount) < 0) {
      await dialog.alert('Por favor ingresa un monto válido', { variant: 'warning', title: 'Falta un dato' });
      return;
    }
    setIsClosed(true);
  };

  const totalSales = 1845.97; // Simulado: ventas del día
  const expectedCash = (totalSales * 0.6).toFixed(2); // 60% en efectivo
  const difference = (parseFloat(cashAmount) - parseFloat(expectedCash)).toFixed(2);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Cerrar Caja</h1>
        <Link href="/admin/pos" className="text-gray-700 hover:text-gray-900">
          ← Volver al POS
        </Link>
      </div>

      {!isClosed ? (
        <div className="bg-white p-6 rounded-lg shadow space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold text-gray-800">Resumen del Turno</h2>
            <p className="text-gray-700 mt-2">Ventas totales del día: <strong>${totalSales}</strong></p>
            <p className="text-gray-700">Efectivo esperado (60%): <strong>${expectedCash}</strong></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Efectivo en caja ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              placeholder="Ingresa el monto físico"
              className="w-full p-3 border border-gray-300 rounded text-gray-900"
            />
          </div>

          <div className="flex space-x-2 pt-4">
            <button
              onClick={() => setCashAmount(expectedCash)}
              type="button"
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded"
            >
              Usar Esperado
            </button>
            <button
              onClick={handleClose}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded"
            >
              Cerrar Caja
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow space-y-6">
          <h2 className="text-xl font-semibold text-gray-800 text-center">Caja Cerrada</h2>
          
          <div className="space-y-3 text-gray-700">
            <p><strong>Ventas Totales:</strong> ${totalSales}</p>
            <p><strong>Efectivo Esperado:</strong> ${expectedCash}</p>
            <p><strong>Efectivo Reportado:</strong> ${cashAmount}</p>
            <p>
              <strong>Diferencia:</strong>{' '}
              <span className={parseFloat(difference) >= 0 ? 'text-green-600' : 'text-red-600'}>
                ${difference}
              </span>
            </p>
          </div>

          <div className="border-t pt-4 text-sm text-gray-600">
            <p><strong>Turno:</strong> Mañana (8:00 AM - 4:00 PM)</p>
            <p><strong>Cajero:</strong> John Doe</p>
            <p><strong>Fecha:</strong> {new Date().toLocaleDateString()}</p>
          </div>

          <div className="pt-4">
            <button
              onClick={() => window.print()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
            >
              🖨️ Imprimir Reporte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}