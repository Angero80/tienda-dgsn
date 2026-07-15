'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DataTable from '../components/DataTable';
import { useAlertDialog } from '../components/AlertDialogProvider';

// Datos de ejemplo — pendiente conectar a la tabla `purchases` real
const purchases = [
  {
    id: 1,
    supplier: 'Tecnología Digital S.A.S.',
    invoice: 'FAC-001-00001',
    date_invoice: '2025-08-14',
    date_registered: '2025-08-14 10:30',
    total: 999.99,
    status: 'Recibido',
    items: 5,
  },
  {
    id: 2,
    supplier: 'Electrónica del Norte Ltda.',
    invoice: 'FAC-002-00045',
    date_invoice: '2025-08-12',
    date_registered: '2025-08-12 14:15',
    total: 450.50,
    status: 'Pendiente',
    items: 3,
  },
  {
    id: 3,
    supplier: 'Insumos Tech Colombia',
    invoice: 'FAC-003-00023',
    date_invoice: '2025-08-10',
    date_registered: '2025-08-10 09:20',
    total: 1200.00,
    status: 'Recibido',
    items: 8,
  },
];

type Purchase = (typeof purchases)[number];

const formatDate = (isoDate: string) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

const formatDateTime = (isoString: string) => {
  if (!isoString) return '';
  const [date, time] = isoString.split(' ');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year} ${time || ''}`;
};

const statusBadge = (status: string) => (
  <span
    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
      status === 'Recibido' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
    }`}
  >
    {status}
  </span>
);

export default function PurchasesPage() {
  const dialog = useAlertDialog();
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = purchases.filter((p) => {
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;

    const purchaseDate = new Date(p.date_invoice);
    const start = dateFrom ? new Date(dateFrom) : null;
    const end = dateTo ? new Date(dateTo) : null;

    const afterStart = !start || purchaseDate >= start;
    const beforeEnd = !end || purchaseDate <= end;

    return matchesStatus && afterStart && beforeEnd;
  });

  return (
    <DataTable
      title="Compras"
      data={filtered}
      printLandscape
      columns={[
        { key: 'invoice', label: 'Factura' },
        { key: 'supplier', label: 'Proveedor' },
        {
          key: 'date_invoice',
          label: 'Fecha Factura',
          render: (item: Purchase) => formatDate(item.date_invoice),
        },
        {
          key: 'date_registered',
          label: 'Registro',
          render: (item: Purchase) => formatDateTime(item.date_registered),
        },
        {
          key: 'items',
          label: 'Productos',
          render: (item: Purchase) => `${item.items} productos`,
        },
        {
          key: 'total',
          label: 'Total',
          render: (item: Purchase) => `$${item.total.toFixed(2)}`,
        },
        {
          key: 'status',
          label: 'Estado',
          render: (item: Purchase) => statusBadge(item.status),
          exportValue: (item: Purchase) => item.status,
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
              <option value="Recibido">Recibido</option>
              <option value="Pendiente">Pendiente</option>
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
        <>
          <Link
            href={`/admin/purchases/${item.id}`}
            className="text-blue-600 hover:underline text-sm mr-2"
          >
            Ver
          </Link>
          <button
            onClick={() => dialog.alert('PDF descargado', { variant: 'success', title: 'Listo' })}
            className="text-green-600 hover:underline text-sm"
          >
            PDF
          </button>
        </>
      )}
    >
      {null}
    </DataTable>
  );
}