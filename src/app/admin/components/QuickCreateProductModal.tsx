'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import QuickCreateAttributeModal from './QuickCreateAttributeModal';

type AttributeItem = { id: number; name: string };

export type QuickProduct = {
  id: number;
  name: string;
  sku: string;
  price: number;
  cost: number;
  barcode: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (product: QuickProduct) => void;
  prefillBarcode?: string;
};

export default function QuickCreateProductModal({ isOpen, onClose, onCreated, prefillBarcode }: Props) {
  const [categories, setCategories] = useState<AttributeItem[]>([]);
  const [brands, setBrands] = useState<AttributeItem[]>([]);
  const [presentations, setPresentations] = useState<AttributeItem[]>([]);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    cost: '',
    price: '',
    stock: '0',
    category_id: '',
    brand_id: '',
    presentation_id: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [openAttributeModal, setOpenAttributeModal] = useState<
    'category' | 'brand' | 'presentation' | null
  >(null);

  useEffect(() => {
    if (!isOpen) return;

    if (prefillBarcode) {
      setForm((f) => ({ ...f, barcode: prefillBarcode }));
    }

    const loadAttributes = async () => {
      const [{ data: cats }, { data: brs }, { data: pres }] = await Promise.all([
        supabase.from('categories').select('id, name'),
        supabase.from('brands').select('id, name'),
        supabase.from('presentations').select('id, name'),
      ]);
      setCategories(cats || []);
      setBrands(brs || []);
      setPresentations(pres || []);
    };

    loadAttributes();
  }, [isOpen]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setForm({
      name: '',
      sku: '',
      barcode: '',
      cost: '',
      price: '',
      stock: '0',
      category_id: '',
      brand_id: '',
      presentation_id: '',
    });
    setError('');
    onClose();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('El nombre del producto es obligatorio.');
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setError('El precio de venta debe ser mayor a cero.');
      return;
    }

    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('products')
      .insert([
        {
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          barcode: form.barcode.trim() || null,
          cost: form.cost ? Number(form.cost) : 0,
          price: Number(form.price),
          stock: form.stock ? Number(form.stock) : 0,
          category_id: form.category_id ? Number(form.category_id) : null,
          brand_id: form.brand_id ? Number(form.brand_id) : null,
          presentation_id: form.presentation_id ? Number(form.presentation_id) : null,
        },
      ])
      .select();

    setSaving(false);

    if (insertError) {
      setError('Error al guardar: ' + insertError.message);
      return;
    }

    if (data && data.length > 0) {
      const created = data[0];
      onCreated({
        id: created.id,
        name: created.name,
        sku: created.sku,
        price: created.price,
        cost: created.cost,
        barcode: created.barcode,
      });
      resetAndClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg text-gray-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Crear producto rápido</h2>
          <span className="text-xs text-gray-400">
            Las fotos se agregan después desde Productos
          </span>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              className="w-full border rounded px-3 py-2 text-gray-900 bg-white"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Código de barras</label>
              <input
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Costo</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Precio *</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock inicial</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium mb-1">Categoría</label>
            <div className="flex gap-2">
              <select
                className="flex-1 border rounded px-3 py-2 text-gray-900 bg-white"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setOpenAttributeModal('category')}
                className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm whitespace-nowrap"
              >
                + Nuevo
              </button>
            </div>
          </div>

          {/* Marca */}
          <div>
            <label className="block text-sm font-medium mb-1">Marca</label>
            <div className="flex gap-2">
              <select
                className="flex-1 border rounded px-3 py-2 text-gray-900 bg-white"
                value={form.brand_id}
                onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
              >
                <option value="">Sin marca</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setOpenAttributeModal('brand')}
                className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm whitespace-nowrap"
              >
                + Nuevo
              </button>
            </div>
          </div>

          {/* Presentación */}
          <div>
            <label className="block text-sm font-medium mb-1">Presentación</label>
            <div className="flex gap-2">
              <select
                className="flex-1 border rounded px-3 py-2 text-gray-900 bg-white"
                value={form.presentation_id}
                onChange={(e) => setForm({ ...form, presentation_id: e.target.value })}
              >
                <option value="">Sin presentación</option>
                {presentations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setOpenAttributeModal('presentation')}
                className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm whitespace-nowrap"
              >
                + Nuevo
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
          <button
            type="button"
            onClick={resetAndClose}
            className="px-4 py-2 rounded border"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear producto'}
          </button>
        </div>
      </div>

      <QuickCreateAttributeModal
        isOpen={openAttributeModal === 'category'}
        onClose={() => setOpenAttributeModal(null)}
        tableName="categories"
        title="Nueva Categoría"
        existingList={categories}
        onCreated={(newItem) => {
          setCategories((prev) => [...prev, newItem]);
          setForm((f) => ({ ...f, category_id: String(newItem.id) }));
        }}
      />
      <QuickCreateAttributeModal
        isOpen={openAttributeModal === 'brand'}
        onClose={() => setOpenAttributeModal(null)}
        tableName="brands"
        title="Nueva Marca"
        existingList={brands}
        onCreated={(newItem) => {
          setBrands((prev) => [...prev, newItem]);
          setForm((f) => ({ ...f, brand_id: String(newItem.id) }));
        }}
      />
      <QuickCreateAttributeModal
        isOpen={openAttributeModal === 'presentation'}
        onClose={() => setOpenAttributeModal(null)}
        tableName="presentations"
        title="Nueva Presentación"
        existingList={presentations}
        onCreated={(newItem) => {
          setPresentations((prev) => [...prev, newItem]);
          setForm((f) => ({ ...f, presentation_id: String(newItem.id) }));
        }}
      />
    </div>
  );
}
