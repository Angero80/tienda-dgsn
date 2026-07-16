'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DataTable from '../components/DataTable';
import { supabase } from '../../../lib/supabaseClient';
import { formatCurrency } from '../../../lib/formatCurrency';

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
  supplier_id: number | null;
  invoice_number: string;
  purchase_date: string;
  created_at: string;
  total_amount: number;
  status: 'recibido' | 'pendiente';
  items: PurchaseItem[];
  pdf_url: string | null;
};

const formatDate = (isoDate: string) => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const formatDateTime = (isoString: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusBadge = (status: string) => (
  <span
    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
      status === 'recibido' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
    }`}
  >
    {status === 'recibido' ? 'Recibido' : 'Pendiente'}
  </span>
);

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .order('purchase_date', { ascending: false });

    if (error) {
      console.error('Error cargando compras:', error.message);
    } else {
      setPurchases(data || []);
    }
    setLoading(false);
  };

  const filtered = purchases.filter((p) => {
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;

    const purchaseDate = new Date(p.purchase_date);
    const start = dateFrom ? new Date(dateFrom) : null;
    const end = dateTo ? new Date(dateTo) : null;

    const afterStart = !start || purchaseDate >= start;
    const beforeEnd = !end || purchaseDate <= end;

    return matchesStatus && afterStart && beforeEnd;
  });

  if (loading) {
    return <div className="p-6">Cargando compras...</div>;
  }

  return (
    <DataTable
      title="Compras"
      data={filtered}
      printLandscape
      columns={[
        { key: 'invoice_number', label: 'Factura' },
        { key: 'supplier', label: 'Proveedor' },
        {
          key: 'purchase_date',
          label: 'Fecha Factura',
          render: (item: Purchase) => formatDate(item.purchase_date),
        },
        {
          key: 'created_at',
          label: 'Registro',
          render: (item: Purchase) => formatDateTime(item.created_at),
        },
        {
          key: 'items',
          label: 'Productos',
          render: (item: Purchase) => `${(item.items || []).length} productos`,
          exportValue: (item: Purchase) => String((item.items || []).length),
        },
        {
          key: 'total_amount',
          label: 'Total',
          render: (item: Purchase) => `$${formatCurrency(Number(item.total_amount || 0))}`,
        },
        {
          key: 'status',
          label: 'Estado',
          render: (item: Purchase) => statusBadge(item.status),
          exportValue: (item: Purchase) => (item.status === 'recibido' ? 'Recibido' : 'Pendiente'),
        },
      ]}
      formFields={[]}
      onAdd={() => router.push('/admin/purchases/new')}
      onEdit={() => {}}
      onDelete={() => {}}
      extraFilters={[
        {
          label: 'Filtrar por estado',
          control: (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="p-2 border border-gray-300 rounded text-black text-sm h-9"
            >
              <option value="all">Todos</option>
              <option value="recibido">Recibido</option>
              <option value="pendiente">Pendiente</option>
            </select>
          ),
        },
        {
          label: 'Fecha inicial',
          control: (
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="p-2 border border-gray-300 rounded text-black text-sm h-9"
            />
          ),
        },
        {
          label: 'Fecha final',
          control: (
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="p-2 border border-gray-300 rounded text-black text-sm h-9"
            />
          ),
        },
      ]}
      renderActions={(item: Purchase) => (
        <div className="flex gap-3">
          <Link href={`/admin/purchases/${item.id}`} className="text-blue-600 hover:underline text-sm">
            Ver detalle
          </Link>
          {/* NOTA: por ahora cualquiera en el panel puede editar. Cuando se
              implementen roles reales (pendiente en el roadmap), esta acción
              debería quedar restringida a un rol elevado. */}
          <Link
            href={`/admin/purchases/${item.id}/edit`}
            className="text-amber-700 hover:underline text-sm"
          >
            Editar compra
          </Link>
          {item.pdf_url ? (
            <a
              href={`/invoice-viewer?url=${encodeURIComponent(item.pdf_url)}&label=${encodeURIComponent('Factura ' + (item.invoice_number || item.id))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-700 hover:underline text-sm"
            >
              Ver comprobante
            </a>
          ) : (
            <span className="text-gray-400 text-sm">Sin comprobante</span>
          )}
        </div>
      )}
    >
      {null}
    </DataTable>
  );
}