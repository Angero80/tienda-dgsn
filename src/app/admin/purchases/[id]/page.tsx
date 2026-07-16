'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { formatCurrency } from '../../../../lib/formatCurrency';

type PurchaseItem = {
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  cost: number;
  subtotal: number;
};

type Purchase = {
  id: number;
  supplier: string;
  invoice_number: string;
  purchase_date: string;
  created_at: string;
  total_amount: number;
  status: 'recibido' | 'pendiente';
  items: PurchaseItem[];
  notes: string | null;
  pdf_url: string | null;
};

const formatDate = (isoDate: string) => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

const formatDateTime = (isoString: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function PurchaseDetailPage() {
  const params = useParams();
  const purchaseId = Number(params.id);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setPurchase(data);
      }
      setLoading(false);
    };
    load();
  }, [purchaseId]);

  if (loading) {
    return <div className="p-6">Cargando compra...</div>;
  }

  if (notFound || !purchase) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">No se encontró esta compra.</p>
        <Link href="/admin/purchases" className="text-blue-600 underline">
          ← Volver a Compras
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Detalle de Compra</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/purchases"
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium px-4 py-2 rounded text-sm"
          >
            ← Volver
          </Link>
          <Link
            href={`/admin/purchases/${purchase.id}/edit`}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded text-sm"
          >
            Editar compra
          </Link>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Proveedor</p>
            <p className="font-medium text-gray-800">{purchase.supplier || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">No. Factura</p>
            <p className="font-medium text-gray-800">{purchase.invoice_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fecha Factura</p>
            <p className="font-medium text-gray-800">{formatDate(purchase.purchase_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Registrado</p>
            <p className="font-medium text-gray-800">{formatDateTime(purchase.created_at)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Estado</p>
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
              purchase.status === 'recibido' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {purchase.status === 'recibido' ? 'Recibido' : 'Pendiente'}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Productos</h3>
          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2 border-b">SKU</th>
                <th className="text-left p-2 border-b">Producto</th>
                <th className="text-right p-2 border-b">Cantidad</th>
                <th className="text-right p-2 border-b">Costo Unitario</th>
                <th className="text-right p-2 border-b">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(purchase.items || []).map((item, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 text-gray-700">{item.sku}</td>
                  <td className="p-2 text-gray-700">{item.product_name}</td>
                  <td className="p-2 text-right text-gray-700">{item.quantity}</td>
                  <td className="p-2 text-right text-gray-700">${formatCurrency(Number(item.cost))}</td>
                  <td className="p-2 text-right text-gray-700">${formatCurrency(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {purchase.notes && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Notas</p>
            <p className="text-gray-800 whitespace-pre-line">{purchase.notes}</p>
          </div>
        )}

        <div className="border-t pt-4 font-bold text-lg text-gray-800">
          Total: ${formatCurrency(Number(purchase.total_amount || 0))}
        </div>

        <div>
          {purchase.pdf_url ? (
            <a
              href={`/invoice-viewer?url=${encodeURIComponent(purchase.pdf_url)}&label=${encodeURIComponent('Factura ' + (purchase.invoice_number || purchase.id))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm inline-block"
            >
              Ver comprobante de compra
            </a>
          ) : (
            <span className="text-gray-400 text-sm">Sin comprobante</span>
          )}
        </div>
      </div>
    </div>
  );
}