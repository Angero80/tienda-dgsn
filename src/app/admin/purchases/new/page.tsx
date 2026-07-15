'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import QuickCreateProductModal, { QuickProduct } from '../../components/QuickCreateProductModal';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import { useAlertDialog } from '../../components/AlertDialogProvider';

type Supplier = { id: number; name: string };

export default function NewPurchasePage() {
  const dialog = useAlertDialog();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<QuickProduct[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Qué fila abrió el modal de "crear producto rápido" (o null si ninguna)
  const [quickCreateForRow, setQuickCreateForRow] = useState<number | null>(null);

  // Qué fila abrió el escáner de código de barras/QR (o null si ninguna)
  const [scannerForRow, setScannerForRow] = useState<number | null>(null);
  const [fileError, setFileError] = useState('');
  const [prefillBarcode, setPrefillBarcode] = useState<string | undefined>(undefined);

  const [form, setForm] = useState({
    supplier_id: '',
    invoice: '',
    date: new Date().toISOString().split('T')[0],
    items: [{ product_id: '', quantity: 1, cost: 0 }] as Array<{ product_id: string; quantity: number; cost: number }>,
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      const [{ data: partiesData, error: partiesError }, { data: productsData, error: productsError }] =
        await Promise.all([
          supabase.from('parties').select('id, name').in('type', ['supplier', 'both']),
          supabase.from('products').select('id, name, sku, price, cost, barcode'),
        ]);

      if (partiesError) console.error('Error cargando proveedores:', partiesError.message);
      if (productsError) console.error('Error cargando productos:', productsError.message);

      setSuppliers(partiesData || []);
      setProducts(productsData || []);
      setLoadingData(false);
    };

    loadData();
  }, []);

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { product_id: '', quantity: 1, cost: 0 }],
    });
  };

  const updateItem = useCallback((index: number, field: string, value: any) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      // @ts-ignore
      newItems[index][field] = value;

      // ✅ Si se acaba de elegir un producto en la ÚLTIMA fila, agrega
      // automáticamente una fila nueva vacía para seguir cargando sin
      // tener que ir a buscar el botón "+ Agregar Producto".
      const isLastRow = index === newItems.length - 1;
      const justPickedProduct = field === 'product_id' && value;
      if (isLastRow && justPickedProduct) {
        newItems.push({ product_id: '', quantity: 1, cost: 0 });
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

  // Cuando se crea un producto nuevo desde el modal apilado, se agrega a la
  // lista local (sin recargar la página) y se selecciona automáticamente
  // en la fila que lo pidió. El resto de filas ya llenas no se tocan.
  const handleProductCreated = (newProduct: QuickProduct) => {
    setProducts((prev) => [...prev, newProduct]);
    if (quickCreateForRow !== null) {
      updateItem(quickCreateForRow, 'product_id', String(newProduct.id));
      updateItem(quickCreateForRow, 'cost', newProduct.cost || 0);
    }
    setQuickCreateForRow(null);
  };

  // Cuando se escanea un código en una fila: busca el producto por barcode.
  // Si existe, lo selecciona. Si no, abre "Crear producto" con el código
  // de barras ya precargado, sin perder el resto de la compra.
  const handleScan = useCallback((code: string) => {
    setScannerForRow((row) => {
      if (row === null) return null;

      const match = products.find((p) => p.barcode === code);
      if (match) {
        updateItem(row, 'product_id', String(match.id));
        updateItem(row, 'cost', match.cost || 0);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileError('');

    if (!file) {
      setFileError('Debes subir una foto o PDF de la factura/recibo antes de guardar.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const itemsWithProduct = form.items.filter((i) => i.product_id);
    if (itemsWithProduct.length === 0) {
      await dialog.alert('Agrega al menos un producto', { variant: 'warning', title: 'Falta un dato' });
      return;
    }
    // TODO: conectar el guardado real a la tabla `purchases` una vez
    // confirmemos su estructura exacta (siguiente paso del roadmap).
    await dialog.alert('Compra registrada exitosamente (guardado real pendiente)', {
      variant: 'success',
      title: 'Guardado',
    });
  };

  const total = form.items.reduce(
    (sum, item) => sum + item.quantity * item.cost,
    0
  );

  if (loadingData) {
    return <div className="p-6">Cargando proveedores y productos...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Nueva Compra</h1>
        <Link href="/admin/purchases" className="text-gray-600 hover:text-gray-800">
          ← Volver
        </Link>
      </div>

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
            {suppliers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No hay proveedores registrados.{' '}
                <Link href="/admin/suppliers" className="underline">
                  Crear uno primero
                </Link>
              </p>
            )}
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
            Factura o recibo (PDF o Foto) *
          </label>
          {fileError && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-2">
              {fileError}
            </div>
          )}
          <div className="flex items-center space-x-2">
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
              Subir Archivo
            </button>
            <span className="text-sm text-gray-600">
              {fileName || 'No hay archivo seleccionado'}
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
                      onChange={(e) =>
                        updateItem(index, 'product_id', e.target.value)
                      }
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
                      className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm whitespace-nowrap"
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
                      onChange={(e) =>
                        updateItem(index, 'quantity', parseInt(e.target.value))
                      }
                      className="w-full p-2 border border-gray-300 rounded text-gray-900"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs text-gray-600 mb-1">Costo Unitario</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.cost}
                      onChange={(e) =>
                        updateItem(index, 'cost', parseFloat(e.target.value))
                      }
                      className="w-full p-2 border border-gray-300 rounded text-gray-900"
                    />
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

        {/* Notas */}
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

        {/* Total */}
        <div className="border-t pt-4 font-bold text-lg text-gray-800">
          Total: ${total.toFixed(2)}
        </div>

        {/* Botones */}
        <div className="flex space-x-2 pt-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex-1 bg-gray-500 text-white py-2 rounded"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 rounded"
          >
            Guardar Compra
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