'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../lib/supabaseClient';
import { useAlertDialog } from '../../../components/AlertDialogProvider';
import { formatDocNumber } from '../../../../../lib/invoiceNumber';
import { formatCurrency } from '../../../../../lib/formatCurrency';

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
  invoice_number: number | null;
  receipt_number: number | null;
  total: number;
  items: SaleItem[];
  parties: { name: string } | null;
  resolutions: { number: string; prefix: string | null } | null;
};

type Resolution = {
  id: number;
  number: string;
  prefix: string | null;
  from_date: string;
  to_date: string;
  end_consecutive: number;
  current_consecutive: number;
};

// Catálogo oficial DIAN de conceptos de nota crédito
const REASON_OPTIONS = [
  { code: '1', label: 'Devolución parcial de los bienes / no aceptación parcial del servicio' },
  { code: '2', label: 'Anulación de factura electrónica' },
  { code: '3', label: 'Rebaja o descuento parcial o total' },
  { code: '4', label: 'Ajuste de precio' },
  { code: '5', label: 'Otros' },
];

export default function NewCreditNotePage() {
  const dialog = useAlertDialog();
  const router = useRouter();
  const params = useParams();
  const saleId = Number(params.id);

  const [sale, setSale] = useState<Sale | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [resolutionId, setResolutionId] = useState('');
  const [reasonCode, setReasonCode] = useState('2');
  const [reasonDetail, setReasonDetail] = useState('');
  const [notes, setNotes] = useState('');
  // Cantidad a acreditar por línea (por defecto, todo — nota crédito total)
  const [creditQty, setCreditQty] = useState<string[]>([]);

  useEffect(() => {
    const loadAll = async () => {
      const [{ data: saleData, error: saleError }, { data: resData, error: resError }] = await Promise.all([
        supabase
          .from('sales')
          .select('*, parties(name), resolutions(number, prefix)')
          .eq('id', saleId)
          .single(),
        supabase.from('resolutions').select('*').eq('type', 'credit_note').order('id'),
      ]);

      if (resError) console.error('Error cargando resoluciones:', resError.message);
      setResolutions(resData || []);

      if (saleError || !saleData) {
        setNotFound(true);
      } else {
        setSale(saleData);
        setCreditQty((saleData.items || []).map((i: SaleItem) => String(i.quantity)));
      }
      setLoadingData(false);
    };
    loadAll();
  }, [saleId]);

  const isResolutionExpired = (r: Resolution) => {
    const today = new Date();
    return new Date(r.to_date) < today || new Date(r.from_date) > today;
  };

  const selectedResolution = resolutions.find((r) => String(r.id) === resolutionId);

  // Recalcula subtotal/impuesto/total con las cantidades a acreditar, usando
  // la tarifa de impuesto que quedó guardada en la factura original (no la
  // actual del producto, que pudo cambiar desde entonces).
  const creditedLines = (sale?.items || []).map((item, i) => {
    const qty = Math.min(parseFloat(creditQty[i]) || 0, item.quantity);
    const unitPrice = item.quantity ? item.price : 0;
    const subtotal = qty * unitPrice;
    const taxAmount = subtotal * (Number(item.tax_rate) / 100);
    return { ...item, creditedQty: qty, subtotal, taxAmount, total: subtotal + taxAmount };
  });

  const subtotal = creditedLines.reduce((s, l) => s + l.subtotal, 0);
  const taxesTotal = creditedLines.reduce((s, l) => s + l.taxAmount, 0);
  const total = subtotal + taxesTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resolutionId) {
      await dialog.alert('Selecciona una resolución de notas crédito.', {
        variant: 'warning',
        title: 'Falta un dato',
      });
      return;
    }
    const linesWithQty = creditedLines.filter((l) => l.creditedQty > 0);
    if (linesWithQty.length === 0) {
      await dialog.alert('Ingresa la cantidad a acreditar en al menos un producto.', {
        variant: 'warning',
        title: 'Falta un dato',
      });
      return;
    }

    const resolution = resolutions.find((r) => String(r.id) === resolutionId);
    if (!resolution) return;

    if (resolution.current_consecutive > resolution.end_consecutive) {
      await dialog.alert('Esta resolución de notas crédito ya alcanzó su consecutivo final.', {
        variant: 'danger',
        title: 'Resolución agotada',
      });
      return;
    }

    setSaving(true);
    try {
      const assignedNumber = resolution.current_consecutive;

      const { error: insertError } = await supabase.from('credit_notes').insert([
        {
          note_date: new Date().toISOString(),
          sale_id: saleId,
          resolution_id: resolution.id,
          note_number: assignedNumber,
          reason_code: reasonCode,
          reason_detail: reasonDetail.trim() || null,
          items: linesWithQty.map((l) => ({
            product_id: l.product_id,
            product_name: l.product_name,
            sku: l.sku,
            quantity: l.creditedQty,
            price: l.price,
            tax_rate: l.tax_rate,
            tax_amount: l.taxAmount,
            subtotal: l.subtotal,
            total: l.total,
          })),
          subtotal,
          taxes: taxesTotal,
          total,
          notes: notes.trim() || null,
        },
      ]);
      if (insertError) throw insertError;

      const { error: updateResError } = await supabase
        .from('resolutions')
        .update({ current_consecutive: resolution.current_consecutive + 1 })
        .eq('id', resolution.id);
      if (updateResError) throw updateResError;

      await dialog.alert(
        `Nota crédito ${formatDocNumber(resolution.prefix, assignedNumber)} registrada correctamente.`,
        { variant: 'success', title: 'Guardado' }
      );
      router.push(`/admin/invoices/${saleId}`);
    } catch (err: any) {
      console.error('Error al guardar la nota crédito:', err);
      await dialog.alert('Error al guardar: ' + err.message, { variant: 'danger', title: 'Error' });
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return <div className="p-6">Cargando...</div>;
  }

  if (notFound || !sale) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">No se encontró la factura/recibo original.</p>
        <Link href="/admin/invoices" className="text-blue-600 underline">
          ← Volver a Facturación
        </Link>
      </div>
    );
  }

  const originalNumber = formatDocNumber(
    sale.resolutions?.prefix,
    sale.type === 'factura' ? sale.invoice_number : sale.receipt_number
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Nueva Nota Crédito</h1>
        <Link
          href={`/admin/invoices/${saleId}`}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium px-4 py-2 rounded text-sm"
        >
          ← Volver
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 mb-6">
        Referencia:{' '}
        <strong>
          {sale.type === 'factura' ? 'Factura' : 'Recibo'} {originalNumber}
        </strong>{' '}
        — Cliente: {sale.parties?.name || 'Consumidor final'} — Total original: ${formatCurrency(Number(sale.total))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Motivo</label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} — {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Resolución</label>
            <select
              required
              value={resolutionId}
              onChange={(e) => setResolutionId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
            >
              <option value="">Selecciona una resolución</option>
              {resolutions.map((r) => (
                <option key={r.id} value={r.id}>
                  No. {r.number} — Próximo: {formatDocNumber(r.prefix, r.current_consecutive)}
                  {isResolutionExpired(r) ? ' — VENCIDA' : ''}
                </option>
              ))}
            </select>
            {resolutions.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No hay resoluciones de notas crédito.{' '}
                <Link href="/admin/config/credit-notes-resolutions" className="underline">
                  Crear una
                </Link>
              </p>
            )}
            {selectedResolution && isResolutionExpired(selectedResolution) && (
              <p className="text-xs text-red-600 mt-1">⚠️ Esta resolución está fuera de vigencia.</p>
            )}
          </div>
        </div>

        {reasonCode === '5' && (
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Detalle del motivo</label>
            <input
              type="text"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-gray-900"
              placeholder="Especifica el motivo..."
            />
          </div>
        )}

        {/* Productos a acreditar */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Productos a acreditar</h3>
          <p className="text-xs text-gray-500 mb-3">
            Por defecto viene la cantidad completa de cada línea (nota crédito total). Ajusta la
            cantidad si es una devolución parcial, o pon 0 en los productos que no aplica.
          </p>

          <div className="space-y-2">
            {(sale.items || []).map((item, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 p-3 border rounded">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                  <p className="text-xs text-gray-500">
                    {item.sku} — ${formatCurrency(Number(item.price))} c/u — factura: {item.quantity} und.
                  </p>
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-600 mb-1">Cant. a acreditar</label>
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    value={creditQty[i] ?? ''}
                    onChange={(e) => {
                      const newQty = [...creditQty];
                      newQty[i] = e.target.value;
                      setCreditQty(newQty);
                    }}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900"
                  />
                </div>
                <div className="w-28 text-right">
                  <p className="text-xs text-gray-600">Total línea</p>
                  <p className="text-sm font-semibold text-gray-900">
                    ${formatCurrency(creditedLines[i]?.total) || '0.00'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-gray-900"
            rows={2}
          ></textarea>
        </div>

        <div className="border-t pt-4 space-y-1 text-right">
          <p className="text-sm text-gray-600">Subtotal: ${formatCurrency(subtotal)}</p>
          <p className="text-sm text-gray-600">Impuestos: ${formatCurrency(taxesTotal)}</p>
          <p className="text-lg font-bold text-gray-900">Total nota crédito: ${formatCurrency(total)}</p>
        </div>

        <div className="flex space-x-2 pt-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2 rounded disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Nota Crédito'}
          </button>
        </div>
      </form>
    </div>
  );
}