'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { formatDocNumber } from '../../../../lib/invoiceNumber';
import { groupTaxesByRate } from '../../../../lib/salesTax';
import { formatCurrency } from '../../../../lib/formatCurrency';

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
  subtotal: number;
  taxes: number;
  total: number;
  items: SaleItem[];
  payment_method: string;
  notes: string | null;
  parties: {
    name: string;
    doc_type: string;
    doc_number: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  resolutions: {
    number: string;
    prefix: string | null;
    footer_note: string | null;
    approval_date: string | null;
    from_date: string | null;
    to_date: string | null;
    start_consecutive: number | null;
    end_consecutive: number | null;
  } | null;
};

type CreditNote = {
  id: number;
  note_date: string;
  note_number: number;
  reason_code: string;
  total: number;
  resolutions: { number: string; prefix: string | null } | null;
};

type CompanyInfo = {
  company_name: string;
  company_nit: string;
  company_address: string;
  company_phone: string;
  company_email: string;
};

const REASON_LABELS: Record<string, string> = {
  '1': 'Devolución parcial',
  '2': 'Anulación de factura',
  '3': 'Rebaja o descuento',
  '4': 'Ajuste de precio',
  '5': 'Otros',
};

const formatDate = (isoString: string | null) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

const th: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '6px 8px',
  textAlign: 'left',
  background: '#f5f5f5',
  fontWeight: 'bold',
};
const td: React.CSSProperties = { border: '1px solid #ccc', padding: '6px 8px' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right' };

export default function InvoiceDetailPage() {
  const params = useParams();
  const saleId = Number(params.id);
  const [sale, setSale] = useState<Sale | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data, error }, { data: cnData, error: cnError }, { data: settingsData }] = await Promise.all([
        supabase
          .from('sales')
          .select(
            '*, parties(name, doc_type, doc_number, address, phone, email), resolutions(number, prefix, footer_note, approval_date, from_date, to_date, start_consecutive, end_consecutive)'
          )
          .eq('id', saleId)
          .single(),
        supabase
          .from('credit_notes')
          .select('id, note_date, note_number, reason_code, total, resolutions(number, prefix)')
          .eq('sale_id', saleId)
          .order('note_date', { ascending: false }),
        supabase
          .from('settings')
          .select('key, value')
          .in('key', ['company_name', 'company_nit', 'company_address', 'company_phone', 'company_email']),
      ]);

      if (cnError) console.error('Error cargando notas crédito:', cnError.message);
      setCreditNotes((cnData || []) as any);

      if (settingsData) {
        const map: Record<string, string> = {};
        settingsData.forEach((s: any) => (map[s.key] = s.value));
        setCompany({
          company_name: map.company_name || '',
          company_nit: map.company_nit || '',
          company_address: map.company_address || '',
          company_phone: map.company_phone || '',
          company_email: map.company_email || '',
        });
      }

      if (error || !data) {
        setNotFound(true);
      } else {
        setSale(data as any);
      }
      setLoading(false);
    };
    load();
  }, [saleId]);

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  if (notFound || !sale) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">No se encontró este documento.</p>
        <Link href="/admin/invoices" className="text-blue-600 underline">
          ← Volver a Facturación
        </Link>
      </div>
    );
  }

  const number = sale.type === 'factura' ? sale.invoice_number : sale.receipt_number;
  const docNumber = formatDocNumber(sale.resolutions?.prefix, number);
  const docLabel = sale.type === 'factura' ? 'FACTURA DE VENTA' : 'RECIBO / DOCUMENTO EQUIVALENTE';
  const taxGroups = groupTaxesByRate(sale.items || []);
  const res = sale.resolutions;
  const rangeFrom = formatDocNumber(res?.prefix, res?.start_consecutive);
  const rangeTo = formatDocNumber(res?.prefix, res?.end_consecutive);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Barra de acciones — no se imprime */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-gray-800">
          {sale.type === 'factura' ? 'Factura' : 'Recibo'} {docNumber}
        </h1>
        <div className="flex gap-2">
          <Link
            href="/admin/invoices"
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium px-4 py-2 rounded text-sm"
          >
            ← Volver
          </Link>
          <button
            onClick={() => window.print()}
            className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded text-sm"
          >
            🖨️ Imprimir / PDF
          </button>
          <Link
            href={`/admin/invoices/${saleId}/credit-note`}
            className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-4 py-2 rounded text-sm inline-block"
          >
            + Nota Crédito
          </Link>
        </div>
      </div>

      {/* Documento — mismo diseño en pantalla y al imprimir.
          className="print-only" + style display:block hace que este mismo
          bloque, que normalmente el CSS global oculta fuera de impresión,
          se vea también en pantalla; al imprimir, las reglas @media print
          de globals.css lo ponen a pantalla completa y ocultan el resto. */}
      <div
        className="print-only bg-white rounded-lg shadow print:shadow-none"
        style={{ display: 'block', padding: '24px' }}
      >
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '10px' }}>
          <h1>{company?.company_name || 'Tu empresa'}</h1>
          <p>NIT: {company?.company_nit || '—'}</p>
          <p>Dirección: {company?.company_address || '—'}</p>
          <p>Teléfono o celular: {company?.company_phone || '—'}</p>
          <p>Email: {company?.company_email || '—'}</p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: 'bold' }}>{docLabel}</td>
              <td style={{ ...tdRight, fontWeight: 'bold' }}>No. {docNumber}</td>
            </tr>
            <tr>
              <td style={td}>Fecha y hora de expedición: {formatDateTime(sale.sale_date)}</td>
              <td style={tdRight}>Medio de pago: {sale.payment_method}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: '10px' }}>
          <p>
            <strong>Cliente:</strong> {sale.parties?.name || 'Consumidor final'}
          </p>
          <p>
            Tipo y documento de identificación:{' '}
            {sale.parties ? `${sale.parties.doc_type} ${sale.parties.doc_number}` : 'NIT 222222222222'}
          </p>
          <p>Dirección: {sale.parties?.address || '—'}</p>
          <p>Teléfono o celular: {sale.parties?.phone || '—'}</p>
          <p>Email: {sale.parties?.email || '—'}</p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={th}>SKU</th>
              <th style={th}>Producto</th>
              <th style={th}>Cant.</th>
              <th style={th}>Precio</th>
              <th style={th}>% Imp.</th>
              <th style={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(sale.items || []).map((item, i) => (
              <tr key={i}>
                <td style={td}>{item.sku}</td>
                <td style={td}>{item.product_name}</td>
                <td style={tdRight}>{item.quantity}</td>
                <td style={tdRight}>${formatCurrency(Number(item.price))}</td>
                <td style={tdRight}>{Number(item.tax_rate).toFixed(0)}%</td>
                <td style={tdRight}>${formatCurrency(Number(item.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table style={{ width: '280px', marginLeft: 'auto', marginTop: '10px', borderCollapse: 'collapse', fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={td}>Subtotal</td>
              <td style={tdRight}>${formatCurrency(Number(sale.subtotal))}</td>
            </tr>
            {taxGroups
              .filter((g) => g.rate > 0)
              .map((g) => (
                <tr key={g.rate}>
                  <td style={td}>IVA {g.rate.toFixed(0)}%</td>
                  <td style={tdRight}>${formatCurrency(g.amount)}</td>
                </tr>
              ))}
            <tr>
              <td style={{ ...td, fontWeight: 'bold' }}>TOTAL</td>
              <td style={{ ...tdRight, fontWeight: 'bold' }}>${formatCurrency(Number(sale.total))}</td>
            </tr>
          </tbody>
        </table>

        {/* Datos de la resolución que autoriza la numeración — después del
            total, antes de la nota a pie */}
        <div style={{ background: '#f5f5f5', border: '1px solid #ccc', padding: '8px', fontSize: '11px', marginTop: '15px' }}>
          Resolución DIAN No. {res?.number || '—'} del {formatDate(res?.approval_date || null)} — Autoriza
          numeración de {rangeFrom} a {rangeTo} — Vigente desde {formatDate(res?.from_date || null)} hasta{' '}
          {formatDate(res?.to_date || null)}.
        </div>

        {sale.notes && (
          <div style={{ marginTop: '15px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '11px' }}>Nota a pie:</p>
            <p style={{ fontSize: '11px' }}>{sale.notes}</p>
          </div>
        )}

        {res?.footer_note && (
          <p style={{ marginTop: '10px', fontSize: '10px', color: '#555' }}>{res.footer_note}</p>
        )}

        <p style={{ marginTop: '10px', fontSize: '10px', color: '#555' }}>
          Este documento es un registro interno del sistema. No ha sido validado por la DIAN.
        </p>

        {creditNotes.length > 0 && (
          <div style={{ marginTop: '15px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>Notas crédito emitidas</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={th}>Número</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Motivo</th>
                  <th style={th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((cn) => (
                  <tr key={cn.id}>
                    <td style={td}>{formatDocNumber(cn.resolutions?.prefix, cn.note_number)}</td>
                    <td style={td}>{formatDateTime(cn.note_date)}</td>
                    <td style={td}>{REASON_LABELS[cn.reason_code] || cn.reason_code}</td>
                    <td style={tdRight}>${formatCurrency(Number(cn.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}