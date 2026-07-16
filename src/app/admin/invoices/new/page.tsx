'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import RelationSearchSelect from '../../components/RelationSearchSelect';
import { useAlertDialog } from '../../components/AlertDialogProvider';
import { formatDocNumber } from '../../../../lib/invoiceNumber';
import { formatCurrency } from '../../../../lib/formatCurrency';

type TaxInfo = { id: number; name: string; rate: number };
type Product = { id: number; name: string; sku: string; price: number; stock: number; taxes: TaxInfo[] };
type Customer = { id: number; name: string; doc_type: string; doc_number: string };
type Resolution = {
  id: number;
  type: string;
  number: string;
  prefix: string | null;
  from_date: string;
  to_date: string;
  start_consecutive: number;
  end_consecutive: number;
  current_consecutive: number;
};

type ItemRow = { product_id: string; quantity: string; price: string };

const CONSUMIDOR_FINAL_DOC = '222222222222';

export default function NewInvoicePage() {
  const dialog = useAlertDialog();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    party_id: '',
    type: 'factura' as 'factura' | 'recibo',
    resolution_id: '',
    payment_method: 'Efectivo',
    notes: '',
    items: [{ product_id: '', quantity: '1', price: '0' }] as ItemRow[],
  });

  useEffect(() => {
    const loadAll = async () => {
      const [
        { data: customersData, error: custError },
        { data: productsData, error: prodError },
        { data: resolutionsData, error: resError },
      ] = await Promise.all([
        supabase.from('parties').select('id, name, doc_type, doc_number').in('type', ['customer', 'both']),
        supabase
          .from('products')
          .select('id, name, sku, price, stock, product_taxes(taxes(id, name, rate))'),
        supabase.from('resolutions').select('*').order('id'),
      ]);

      if (custError) console.error('Error cargando clientes:', custError.message);
      if (prodError) console.error('Error cargando productos:', prodError.message);
      if (resError) console.error('Error cargando resoluciones:', resError.message);

      setCustomers(customersData || []);
      setResolutions(resolutionsData || []);

      const normalizedProducts: Product[] = (productsData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: Number(p.price),
        stock: p.stock,
        taxes: (p.product_taxes || []).map((pt: any) => pt.taxes).filter(Boolean),
      }));
      setProducts(normalizedProducts);

      setLoadingData(false);
    };

    loadAll();
  }, []);

  // Cada vez que cambia el tipo (factura/recibo), la resolución debe volver
  // a elegirse porque cambia el sistema de numeración.
  useEffect(() => {
    setForm((f) => ({ ...f, resolution_id: '' }));
  }, [form.type]);

  const resolutionDbType = form.type === 'factura' ? 'invoice' : 'receipt';
  const matchingResolutions = resolutions.filter((r) => r.type === resolutionDbType);

  const isResolutionExpired = (r: Resolution) => {
    const today = new Date();
    return new Date(r.to_date) < today || new Date(r.from_date) > today;
  };

  const selectedResolution = resolutions.find((r) => String(r.id) === form.resolution_id);

  const useConsumidorFinal = () => {
    const cf = customers.find((c) => c.doc_number === CONSUMIDOR_FINAL_DOC);
    if (cf) {
      setForm((f) => ({ ...f, party_id: String(cf.id) }));
    } else {
      dialog.alert('No se encontró el cliente "Consumidor final" en Clientes.', {
        variant: 'warning',
        title: 'No encontrado',
      });
    }
  };

  const updateItem = (index: number, field: keyof ItemRow, value: string) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };

      // Al elegir producto, sugiere su precio de venta automáticamente
      if (field === 'product_id') {
        const product = products.find((p) => String(p.id) === value);
        if (product) newItems[index].price = String(product.price);
      }

      const isLastRow = index === newItems.length - 1;
      if (isLastRow && field === 'product_id' && value) {
        newItems.push({ product_id: '', quantity: '1', price: '0' });
      }

      return { ...prev, items: newItems };
    });
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  // Cálculo por línea: subtotal, y el impuesto que traiga asignado el
  // producto (product_taxes). Si un producto tiene varios impuestos
  // asignados, se suman sus tarifas.
  const computeLine = (item: ItemRow) => {
    const product = products.find((p) => String(p.id) === item.product_id);
    const qty = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.price) || 0;
    const subtotal = qty * unitPrice;
    const taxRate = (product?.taxes || []).reduce((sum, t) => sum + Number(t.rate), 0);
    const taxAmount = subtotal * (taxRate / 100);
    return { product, qty, unitPrice, subtotal, taxRate, taxAmount, total: subtotal + taxAmount };
  };

  const validItems = form.items.filter((i) => i.product_id);
  const computedLines = validItems.map(computeLine);
  const subtotal = computedLines.reduce((sum, l) => sum + l.subtotal, 0);
  const taxesTotal = computedLines.reduce((sum, l) => sum + l.taxAmount, 0);
  const total = subtotal + taxesTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.party_id) {
      await dialog.alert('Selecciona un cliente (o usa "Consumidor final").', {
        variant: 'warning',
        title: 'Falta un dato',
      });
      return;
    }
    if (!form.resolution_id) {
      await dialog.alert(
        `No hay una resolución de ${form.type === 'factura' ? 'facturación' : 'documento equivalente'} seleccionada.`,
        { variant: 'warning', title: 'Falta un dato' }
      );
      return;
    }
    if (validItems.length === 0) {
      await dialog.alert('Agrega al menos un producto.', { variant: 'warning', title: 'Falta un dato' });
      return;
    }

    const resolution = resolutions.find((r) => String(r.id) === form.resolution_id);
    if (!resolution) return;

    if (resolution.current_consecutive > resolution.end_consecutive) {
      await dialog.alert(
        'Esta resolución ya alcanzó su consecutivo final. Elige otra resolución o crea una nueva en Configuración → Resoluciones.',
        { variant: 'danger', title: 'Resolución agotada' }
      );
      return;
    }

    setSaving(true);
    try {
      const assignedNumber = resolution.current_consecutive;

      const itemsSnapshot = computedLines.map((l) => ({
        product_id: l.product?.id,
        product_name: l.product?.name || '',
        sku: l.product?.sku || '',
        quantity: l.qty,
        price: l.unitPrice,
        tax_rate: l.taxRate,
        tax_amount: l.taxAmount,
        subtotal: l.subtotal,
        total: l.total,
      }));

      const { error: insertError } = await supabase.from('sales').insert([
        {
          sale_date: new Date().toISOString(),
          type: form.type,
          party_id: Number(form.party_id),
          resolution_id: resolution.id,
          invoice_number: form.type === 'factura' ? assignedNumber : null,
          receipt_number: form.type === 'recibo' ? assignedNumber : null,
          subtotal,
          taxes: taxesTotal,
          total,
          items: itemsSnapshot,
          payment_method: form.payment_method,
          notes: form.notes.trim() || null,
        },
      ]);
      if (insertError) throw insertError;

      // Avanza el consecutivo de la resolución para la próxima factura/recibo
      const { error: updateResError } = await supabase
        .from('resolutions')
        .update({ current_consecutive: resolution.current_consecutive + 1 })
        .eq('id', resolution.id);
      if (updateResError) throw updateResError;

      await dialog.alert(
        `${form.type === 'factura' ? 'Factura' : 'Recibo'} ${formatDocNumber(resolution.prefix, assignedNumber)} registrada correctamente.`,
        { variant: 'success', title: 'Guardado' }
      );
      router.push('/admin/invoices');
    } catch (err: any) {
      console.error('Error al guardar la venta:', err);
      await dialog.alert('Error al guardar: ' + err.message, { variant: 'danger', title: 'Error' });
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Nueva Factura / Recibo</h1>
        <Link
          href="/admin/invoices"
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium px-4 py-2 rounded text-sm"
        >
          ← Volver
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Tipo de documento */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">Tipo de documento</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                checked={form.type === 'factura'}
                onChange={() => setForm({ ...form, type: 'factura' })}
              />
              Factura electrónica
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                checked={form.type === 'recibo'}
                onChange={() => setForm({ ...form, type: 'recibo' })}
              />
              Recibo / Documento equivalente
            </label>
          </div>
        </div>

        {/* Cliente y Resolución */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Cliente</label>
            <div className="flex gap-1">
              <div className="flex-1 min-w-0">
                <RelationSearchSelect
                  items={customers}
                  value={form.party_id}
                  onChange={(id) => setForm({ ...form, party_id: id })}
                  placeholder="Buscar cliente..."
                />
              </div>
              <button
                type="button"
                onClick={useConsumidorFinal}
                title='Usar "Consumidor final" (cliente no identificado)'
                className="flex-shrink-0 px-3 rounded bg-gray-600 hover:bg-gray-700 text-white text-xs whitespace-nowrap"
              >
                Consumidor final
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Resolución</label>
            <select
              required
              value={form.resolution_id}
              onChange={(e) => setForm({ ...form, resolution_id: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
            >
              <option value="">Selecciona una resolución</option>
              {matchingResolutions.map((r) => (
                <option key={r.id} value={r.id}>
                  No. {r.number} — Próximo: {formatDocNumber(r.prefix, r.current_consecutive)}
                  {isResolutionExpired(r) ? ' — VENCIDA' : ''}
                </option>
              ))}
            </select>
            {matchingResolutions.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No hay resoluciones de este tipo.{' '}
                <Link
                  href={form.type === 'factura' ? '/admin/config/resolutions' : '/admin/config/equivalents'}
                  className="underline"
                >
                  Crear una
                </Link>
              </p>
            )}
            {selectedResolution && isResolutionExpired(selectedResolution) && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ Esta resolución está fuera de su vigencia (venció el{' '}
                {new Date(selectedResolution.to_date).toLocaleDateString('es-CO')}). Puedes seguir usándola
                para pruebas internas, pero no seria válida ante la DIAN.
              </p>
            )}
          </div>
        </div>

        {/* Método de pago */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">Método de pago</label>
          <select
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            className="w-full max-w-xs p-2 border border-gray-300 rounded text-gray-900 bg-white"
          >
            <option value="Efectivo">Efectivo</option>
            <option value="Tarjeta">Tarjeta</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Crédito">Crédito</option>
          </select>
        </div>

        {/* Productos */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Productos</h3>
            <span className="text-xs text-gray-500">
              Al elegir un producto se agrega la siguiente fila automáticamente
            </span>
          </div>

          <div className="space-y-3">
            {form.items.map((item, index) => {
              const line = item.product_id ? computeLine(item) : null;
              return (
                <div key={index} className="flex flex-col sm:flex-row gap-3 p-3 border rounded items-start">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">Producto</label>
                    <select
                      value={item.product_id}
                      onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-gray-900"
                    >
                      <option value="">Selecciona un producto</option>
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} ({prod.sku}) — Stock: {prod.stock}
                        </option>
                      ))}
                    </select>
                    {line && line.taxRate === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Este producto no tiene impuesto asignado — revisa su ficha en Productos.
                      </p>
                    )}
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-gray-900"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs text-gray-600 mb-1">Precio Unitario</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-gray-900"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-gray-600 mb-1">Impuesto</label>
                    <p className="p-2 text-sm text-gray-700">
                      {line ? `${line.taxRate.toFixed(0)}% = $${formatCurrency(line.taxAmount)}` : '—'}
                    </p>
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-gray-600 mb-1">Total línea</label>
                    <p className="p-2 text-sm font-semibold text-gray-900">
                      {line ? `$${formatCurrency(line.total)}` : '—'}
                    </p>
                  </div>
                  <div className="w-8 flex flex-col">
                    <label className="block text-xs text-gray-600 mb-1">&nbsp;</label>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800 text-lg text-center"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">Notas (opcional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded text-gray-900"
            rows={2}
          ></textarea>
        </div>

        {/* Totales */}
        <div className="border-t pt-4 space-y-1 text-right">
          <p className="text-sm text-gray-600">Subtotal: ${formatCurrency(subtotal)}</p>
          <p className="text-sm text-gray-600">Impuestos: ${formatCurrency(taxesTotal)}</p>
          <p className="text-lg font-bold text-gray-900">Total: ${formatCurrency(total)}</p>
        </div>

        {/* Botones */}
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
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}