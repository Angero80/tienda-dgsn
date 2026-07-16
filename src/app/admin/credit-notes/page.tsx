'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DataTable from '../components/DataTable';
import { supabase } from '../../../lib/supabaseClient';
import { formatDocNumber } from '../../../lib/invoiceNumber';
import { useAlertDialog } from '../components/AlertDialogProvider';
import { formatCurrency } from '../../../lib/formatCurrency';

type CreditNote = {
  id: number;
  note_date: string;
  note_number: number;
  reason_code: string;
  total: number;
  sale_id: number;
  resolutions: { number: string; prefix: string | null } | null;
  sales: {
    type: 'factura' | 'recibo';
    invoice_number: number | null;
    receipt_number: number | null;
    parties: { name: string } | null;
  } | null;
};

const REASON_LABELS: Record<string, string> = {
  '1': 'Devolución parcial',
  '2': 'Anulación de factura',
  '3': 'Rebaja o descuento',
  '4': 'Ajuste de precio',
  '5': 'Otros',
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

export default function CreditNotesPage() {
  const dialog = useAlertDialog();
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('credit_notes')
        .select('*, resolutions(number, prefix), sales(type, invoice_number, receipt_number, parties(name))')
        .order('note_date', { ascending: false });

      if (error) {
        console.error('Error cargando notas crédito:', error.message);
      } else {
        setNotes(data || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="p-6">Cargando notas crédito...</div>;
  }

  return (
    <DataTable
      title="Notas Crédito"
      data={notes}
      formFields={[]}
      onAdd={() =>
        dialog.alert(
          'Las notas crédito se crean desde la factura o recibo que quieres corregir: ve a Facturación, abre el documento y usa el botón "Crear Nota Crédito".',
          { variant: 'info', title: '¿Cómo crear una?' }
        )
      }
      onEdit={() => {}}
      onDelete={() => {}}
      columns={[
        {
          key: 'number',
          label: 'Número',
          render: (item: CreditNote) => formatDocNumber(item.resolutions?.prefix, item.note_number),
          exportValue: (item: CreditNote) => formatDocNumber(item.resolutions?.prefix, item.note_number),
        },
        {
          key: 'note_date',
          label: 'Fecha',
          render: (item: CreditNote) => formatDateTime(item.note_date),
        },
        {
          key: 'customer',
          label: 'Cliente',
          render: (item: CreditNote) => item.sales?.parties?.name || 'Consumidor final',
        },
        {
          key: 'original',
          label: 'Documento original',
          render: (item: CreditNote) =>
            item.sales
              ? `${item.sales.type === 'factura' ? 'Fact.' : 'Rec.'} #${
                  item.sales.type === 'factura' ? item.sales.invoice_number : item.sales.receipt_number
                }`
              : '—',
        },
        {
          key: 'reason_code',
          label: 'Motivo',
          render: (item: CreditNote) => REASON_LABELS[item.reason_code] || item.reason_code,
          exportValue: (item: CreditNote) => REASON_LABELS[item.reason_code] || item.reason_code,
        },
        {
          key: 'total',
          label: 'Total',
          render: (item: CreditNote) => `$${formatCurrency(Number(item.total))}`,
        },
      ]}
      renderActions={(item: CreditNote) => (
        <Link href={`/admin/invoices/${item.sale_id}`} className="text-blue-600 hover:underline text-sm">
          Ver factura original
        </Link>
      )}
    >
      {null}
    </DataTable>
  );
}