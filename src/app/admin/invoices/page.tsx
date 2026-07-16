'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataTable from '../components/DataTable';
import { supabase } from '../../../lib/supabaseClient';
import { useAlertDialog } from '../components/AlertDialogProvider';
import { formatDocNumber } from '../../../lib/invoiceNumber';
import { formatCurrency } from '../../../lib/formatCurrency';

type SaleItem = {
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  price: number;
  tax_rate: number;
  tax_amount: number;
  subtotal: number;
  total: number;
};

type Sale = {
  id: number;
  sale_date: string;
  type: 'factura' | 'recibo';
  party_id: number | null;
  resolution_id: number;
  invoice_number: number | null;
  receipt_number: number | null;
  subtotal: number;
  taxes: number;
  total: number;
  items: SaleItem[];
  payment_method: string;
  notes: string | null;
  customer_name?: string;
  resolution_prefix?: string | null;
};

const typeBadge = (type: string) => (
  <span
    className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
      type === 'factura' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
    }`}
  >
    {type === 'factura' ? 'Factura' : 'Recibo'}
  </span>
);

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

export default function InvoicesPage() {
  const dialog = useAlertDialog();
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*, parties(name), resolutions(prefix)')
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Error cargando facturas:', error.message);
    } else {
      setSales(
        (data || []).map((s: any) => ({
          ...s,
          customer_name: s.parties?.name || 'Consumidor final',
          resolution_prefix: s.resolutions?.prefix || null,
        }))
      );
    }
    setLoading(false);
  };

  const filtered = sales.filter((s) => {
    const matchesType = filterType === 'all' || s.type === filterType;

    const saleDate = new Date(s.sale_date);
    const start = dateFrom ? new Date(dateFrom) : null;
    const end = dateTo ? new Date(dateTo) : null;

    const afterStart = !start || saleDate >= start;
    const beforeEnd = !end || saleDate <= end;

    return matchesType && afterStart && beforeEnd;
  });

  if (loading) {
    return <div className="p-6">Cargando facturas...</div>;
  }

  return (
    <DataTable
      title="Facturas y Recibos"
      data={filtered}
      printLandscape
      columns={[
        {
          key: 'number',
          label: 'Número',
          render: (item: Sale) =>
            formatDocNumber(item.resolution_prefix, item.type === 'factura' ? item.invoice_number : item.receipt_number),
          exportValue: (item: Sale) =>
            formatDocNumber(item.resolution_prefix, item.type === 'factura' ? item.invoice_number : item.receipt_number),
        },
        {
          key: 'sale_date',
          label: 'Fecha',
          render: (item: Sale) => formatDateTime(item.sale_date),
        },
        { key: 'customer_name', label: 'Cliente' },
        {
          key: 'type',
          label: 'Tipo',
          render: (item: Sale) => typeBadge(item.type),
          exportValue: (item: Sale) => (item.type === 'factura' ? 'Factura' : 'Recibo'),
        },
        {
          key: 'items',
          label: 'Productos',
          render: (item: Sale) => `${(item.items || []).length} productos`,
          exportValue: (item: Sale) => String((item.items || []).length),
        },
        {
          key: 'total',
          label: 'Total',
          render: (item: Sale) => `$${formatCurrency(Number(item.total))}`,
        },
      ]}
      formFields={[]}
      onAdd={() => router.push('/admin/invoices/new')}
      onEdit={() => {}}
      onDelete={() => {}}
      extraFilters={[
        {
          label: 'Filtrar por tipo',
          control: (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="p-2 border border-gray-300 rounded text-black text-sm h-9"
            >
              <option value="all">Todos</option>
              <option value="factura">Factura</option>
              <option value="recibo">Recibo</option>
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
      renderActions={(item: Sale) => (
        <Link href={`/admin/invoices/${item.id}`} className="text-blue-600 hover:underline text-sm">
          Ver detalle
        </Link>
      )}
    >
      {null}
    </DataTable>
  );
}