'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../lib/supabaseClient';
import QuickCreateProductModal, { QuickProduct } from '../../../components/QuickCreateProductModal';
import BarcodeScannerModal from '../../../components/BarcodeScannerModal';
import { useAlertDialog } from '../../../components/AlertDialogProvider';
import { withPdfTitle } from '../../../../../lib/pdfMeta';
import CurrencyInput from '../../../components/CurrencyInput';
import { formatCurrency } from '../../../../../lib/formatCurrency';

type Supplier = { id: number; name: string };

type PurchaseItemRow = { product_id: string; quantity: string; cost: string };

export default function EditPurchasePage() {
  const dialog = useAlertDialog();
  const router = useRouter();
  const params = useParams();
  const purchaseId = Number(params.id);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<QuickProduct[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [quickCreateForRow, setQuickCreateForRow] = useState<number | null>(null);
  const [scannerForRow, setScannerForRow] = useState<number | null>(null);
  const [fileError, setFileError] = useState('');
  const [prefillBarcode, setPrefillBarcode] = useState<string | undefined>(undefined);

  const [form, setForm] = useState({
    supplier_id: '',
    invoice: '',
    date: '',
    status: 'recibido' as 'recibido' | 'pendiente',
    items: [] as PurchaseItemRow[],
    notes: '',
  });

  // Archivo existente (ya guardado) vs. uno nuevo que reemplace la factura
  const [existingPdfUrl, setExistingPdfUrl] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      const [
        { data: partiesData, error: partiesError },
        { data: productsData, error: productsError },
        { data: purchaseData, error: purchaseError },
      ] = await Promise.all([
        supabase.from('parties').select('id, name').in('type', ['supplier', 'both']),
        supabase.from('products').select('id, name, sku, price, cost, barcode'),
        supabase.from('purchases').select('*').eq('id', purchaseId).single(),
      ]);

      if (partiesError) console.error('Error cargando proveedores:', partiesError.message);
      if (productsError) console.error('Error cargando productos:', productsError.message);

      setSuppliers(partiesData || []);
      setProducts(productsData || []);

      if (purchaseError || !purchaseData) {
        setNotFound(true);
      } else {
        setForm({
          supplier_id: purchaseData.supplier_id ? String(purchaseData.supplier_id) : '',
          invoice: purchaseData.invoice_number || '',
          date: purchaseData.purchase_date ? String(purchaseData.purchase_date).split('T')[0] : '',
          status: purchaseData.status || 'recibido',
          items: (purchaseData.items || []).map((i: any) => ({
            product_id: String(i.product_id),
            quantity: String(i.quantity),
            cost: String(i.cost),
          })),
          notes: purchaseData.notes || '',
        });
        setExistingPdfUrl(purchaseData.pdf_url || '');
      }

      setLoadingData(false);
    };

    loadData();
  }, [purchaseId]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { product_id: '', quantity: '1', cost: '0' }],
    });
  };

  const updateItem = useCallback((index: number, field: string, value: any) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      // @ts-ignore
      newItems[index][field] = value;

      const isLastRow = index === newItems.length - 1;
      const justPickedProduct = field === 'product_id' && value;
      if (isLastRow && justPickedProduct) {
        newItems.push({ product_id: '', quantity: '1', cost: '0' });
      }

      return { ...prev, items: newItems };
    });
  }, []);

  const removeItem = (index: number) => {
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index),
    });
  };

  const handleProductCreated = (newProduct: QuickProduct) => {
    setProducts((prev) => [...prev, newProduct]);
    if (quickCreateForRow !== null) {
      updateItem(quickCreateForRow, 'product_id', String(newProduct.id));
      updateItem(quickCreateForRow, 'cost', String(newProduct.cost || 0));
    }
    setQuickCreateForRow(null);
  };

  const handleScan = useCallback((code: string) => {
    setScannerForRow((row) => {
      if (row === null) return null;

      const match = products.find((p) => p.barcode === code);
      if (match) {
        updateItem(row, 'product_id', String(match.id));
        updateItem(row, 'cost', String(match.cost || 0));
      } else {
        setPrefillBarcode(code);
        setQuickCreateForRow(row);
      }
      return null;
    });
  }, [products, updateItem]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setFileError('');
    }
  };

  const total = form.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileError('');

    if (!file && !existingPdfUrl) {
      setFileError('Debes subir una foto o PDF de la factura/recibo.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const itemsWithProduct = form.items.filter((i) => i.product_id);
    if (itemsWithProduct.length === 0) {
      await dialog.alert('Agrega al menos un producto', { variant: 'warning', title: 'Falta un dato' });
      return;
    }

    setSaving(true);
    try {
      const selectedSupplier = suppliers.find((s) => String(s.id) === form.supplier_id);

      // Solo se sube un archivo nuevo si el usuario eligió reemplazarlo;
      // si no, se conserva la factura ya guardada tal cual.
      let pdfUrl = existingPdfUrl;
      if (file) {
        const fileToUpload = await withPdfTitle(
          file,
          `Factura ${form.invoice.trim()} - ${selectedSupplier?.name || ''}`
        );
        const ext = file.name.split('.').pop();
        const path = `purchase_${purchaseId}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('purchase-invoices')
          .upload(path, fileToUpload);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('purchase-invoices')
          .getPublicUrl(path);
        pdfUrl = publicUrlData.publicUrl;
      }

      const itemsSnapshot = itemsWithProduct.map((i) => {
        const product = products.find((p) => String(p.id) === i.product_id);
        return {
          product_id: Number(i.product_id),
          product_name: product?.name || '',
          sku: product?.sku || '',
          quantity: parseInt(i.quantity) || 0,
          cost: parseFloat(i.cost) || 0,
          subtotal: (parseInt(i.quantity) || 0) * (parseFloat(i.cost) || 0),
        };
      });

      const { error: updateError } = await supabase
        .from('purchases')
        .update({
          supplier_id: Number(form.supplier_id),
          supplier: selectedSupplier?.name || '',
          invoice_number: form.invoice.trim(),
          purchase_date: form.date,
          status: form.status,
          items: itemsSnapshot,
          total_amount: total,
          pdf_url: pdfUrl,
          notes: form.notes.trim() || null,
        })
        .eq('id', purchaseId);
      if (updateError) throw updateError;

      await dialog.alert('Compra actualizada correctamente.', {
        variant: 'success',
        title: 'Guardado',
      });
      router.push('/admin/purchases');
    } catch (err: any) {
      await dialog.alert('Error al actualizar la compra: ' + err.message, {
        variant: 'danger',
        title: 'Error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return <div className="p-6">Cargando compra...</div>;
  }

  if (notFound) {
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
        <h1 className="text-2xl font-bold text-gray-800">Editar Compra</h1>
        <Link
          href="/admin/purchases"
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium px-4 py-2 rounded text-sm"
        >
          ← Volver
        </Link>
      </div>

      {/* NOTA: por ahora cualquier usuario del panel puede editar todo. Cuando
          se implementen roles reales (pendiente en el roadmap), esta pantalla
          debería quedar restringida a un rol elevado. */}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Proveedor
            </label>
            <select
              required
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-gray-900"
            >
              <option value="">Selecciona un proveedor</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              No. Factura
            </label>
            <input
              type="text"
              required
              value={form.invoice}
              onChange={(e) => setForm({ ...form, invoice: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-gray-900"
              placeholder="FAC-001-00001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Fecha
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-gray-900"
            />
          </div>
        </div>

        {/* Subida de archivo */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">
            Sube el comprobante (PDF o Foto) *
          </label>
          {fileError && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-2">
              {fileError}
            </div>
          )}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileChange}
              className="hidden"
              id="invoice-upload"
            />
            <button
              type="button"
              onClick={() => document.getElementById('invoice-upload')?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              {file || existingPdfUrl ? 'Cambiar archivo' : 'Subir Archivo'}
            </button>
            {(filePreviewUrl || existingPdfUrl) && (
              <a
                href={`/invoice-viewer?url=${encodeURIComponent(filePreviewUrl || existingPdfUrl)}&label=${encodeURIComponent('Factura ' + (form.invoice || 'nueva'))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
              >
                Ver
              </a>
            )}
            <span className="text-sm text-gray-600">
              {fileName || (existingPdfUrl ? 'Factura ya guardada' : 'No hay archivo seleccionado')}
            </span>
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Productos</h3>
            <span className="text-xs text-gray-500">
              Al elegir un producto se agrega la siguiente fila automáticamente
            </span>
          </div>

          <div className="space-y-3">
            {form.items.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay productos agregados</p>
            ) : (
              form.items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row gap-3 p-3 border rounded items-start"
                >
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
                          {prod.name} {prod.sku ? `(${prod.sku})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs text-gray-600 mb-1">QR</label>
                    <button
                      type="button"
                      onClick={() => setScannerForRow(index)}
                      title="Escanear código de barras o QR"
                      className="px-3 py-2 rounded bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm whitespace-nowrap"
                    >
                      📷
                    </button>
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs text-gray-600 mb-1">Nuevo</label>
                    <button
                      type="button"
                      onClick={() => setQuickCreateForRow(index)}
                      title="Crear un producto nuevo sin perder esta compra"
                      className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm whitespace-nowrap"
                    >
                      + Nuevo
                    </button>
                  </div>
                  <div className="w-24">
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
                    <label className="block text-xs text-gray-600 mb-1">Costo Unitario</label>
                    <CurrencyInput
                      value={item.cost}
                      onChange={(v) => updateItem(index, 'cost', v)}
                      className="w-full p-2 border border-gray-300 rounded text-gray-900"
                    />
                    {(() => {
                      const selected = products.find((p) => String(p.id) === item.product_id);
                      return selected && selected.cost ? (
                        <p className="text-xs text-gray-500 mt-1">
                          Anterior: ${formatCurrency(selected.cost)}
                        </p>
                      ) : null;
                    })()}
                  </div>
                  <div className="w-20 flex flex-col">
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
              ))
            )}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-3 w-full border-2 border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50 text-gray-500 hover:text-green-700 py-2 rounded text-sm transition-colors"
          >
            + Agregar otra fila manualmente
          </button>
        </div>

        {/* Total */}
        <div className="border-t pt-4 font-bold text-lg text-gray-800">
          Total: ${formatCurrency(total)}
        </div>

        {/* Estado */}
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-800 mb-1">
            Estado
          </label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'recibido' | 'pendiente' })}
            className="w-full p-2 border border-gray-300 rounded text-gray-900"
          >
            <option value="recibido">Recibido</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>

        {/* Notas — después del estado, por si quieres explicar por qué
            quedó pendiente o cualquier otra observación */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">
            Notas (opcional)
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded text-gray-900"
            rows={3}
            placeholder="Observaciones sobre la compra..."
          ></textarea>
        </div>

        {/* Botones */}
        <div className="flex space-x-2 pt-4">
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
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>

      <QuickCreateProductModal
        isOpen={quickCreateForRow !== null}
        onClose={() => {
          setQuickCreateForRow(null);
          setPrefillBarcode(undefined);
        }}
        onCreated={handleProductCreated}
        prefillBarcode={prefillBarcode}
      />

      <BarcodeScannerModal
        isOpen={scannerForRow !== null}
        onClose={() => setScannerForRow(null)}
        onScan={handleScan}
      />
    </div>
  );
}