'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataTable from '../components/DataTable';

// Datos simulados — pendiente conectar a la tabla `sales` real
const invoices = [
  {
    id: 1,
    number: 'FAC-001-00001',
    date: '2025-08-14',
    time: '10:30',
    customer: 'John Doe',
    docNumber: '100000000',
    status: 'Autorizada',
    type: 'Factura',
    total: 1299.99,
  },
  {
    id: 2,
    number: 'REC-001-00001',
    date: '2025-08-13',
    time: '15:45',
    customer: 'María López',
    docNumber: '9876543210',
    status: 'Autorizada',
    type: 'Recibo',
    total: 89.99,
  },
];

type Invoice = (typeof invoices)[number];

const typeBadge = (type: string) => (
  <span
    className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
      type === 'Factura' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
    }`}
  >
    {type}
  </span>
);

const statusBadge = (status: string) => (
  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
    {status}
  </span>
);

export default function InvoicesPage() {
  const router = useRouter();
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = invoices.filter((inv) => {
    const matchesType = filterType === 'all' || inv.type === filterType;

    const invoiceDate = new Date(inv.date);
    const start = dateFrom ? new Date(dateFrom) : null;
    const end = dateTo ? new Date(dateTo) : null;

    const afterStart = !start || invoiceDate >= start;
    const beforeEnd = !end || invoiceDate <= end;

    return matchesType && afterStart && beforeEnd;
  });

  return (
    <DataTable
      title="Facturas y Recibos"
      data={filtered}
      columns={[
        { key: 'number', label: 'Número' },
        {
          key: 'date',
          label: 'Fecha',
          render: (item: Invoice) => `${item.date} ${item.time}`,
        },
        { key: 'customer', label: 'Cliente' },
        {
          key: 'type',
          label: 'Tipo',
          render: (item: Invoice) => typeBadge(item.type),
          exportValue: (item: Invoice) => item.type,
        },
        {
          key: 'total',
          label: 'Total',
          render: (item: Invoice) => `$${item.total.toFixed(2)}`,
        },
        {
          key: 'status',
          label: 'Estado',
          render: (item: Invoice) => statusBadge(item.status),
          exportValue: (item: Invoice) => item.status,
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
              <option value="Factura">Factura</option>
              <option value="Recibo">Recibo</option>
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
      renderActions={(item: Invoice) => (
        <>
          <Link
            href={`/admin/invoices/${item.id}`}
            className="text-blue-600 hover:underline text-sm mr-2"
          >
            Ver
          </Link>
          <button
            onClick={() => alert('PDF descargado')}
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
