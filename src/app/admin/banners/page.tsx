'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type Product = {
  id: number;
  name: string;
  image_url: string;
  price: number;
};

type Banner = {
  id: number;
  product_id: number | null;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  custom_image_url: string | null;
  discount_text_top: string | null;
  discount_text_bottom: string | null;
  order_index: number;
  active: boolean;
  background_color: string;
  text_color: string;
  products?: Product;
};

const emptyForm = {
  id: null as number | null,
  product_id: '' as string,
  title: '',
  subtitle: '',
  discount_text_top: '',
  discount_text_bottom: '',
  background_color: '#1e40af',
  text_color: '#ffffff',
  active: true,
  custom_image_url: '' as string,
};

export default function BannersPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [form, setForm] = useState(emptyForm);

  const activeCount = banners.filter((b) => b.active).length;

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, image_url, price')
      .order('name');

    const { data: bannersData } = await supabase
      .from('banners')
      .select('*, products(id, name, image_url, price)')
      .order('order_index');

    setProducts(productsData || []);
    setBanners(bannersData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedProduct = products.find(
    (p) => p.id === Number(form.product_id)
  );

  const previewImage =
    form.custom_image_url || selectedProduct?.image_url || '';

  const resetForm = () => {
    setForm(emptyForm);
    setUploadFile(null);
    setErrorMsg('');
  };

  const handleEdit = (banner: Banner) => {
    setForm({
      id: banner.id,
      product_id: banner.product_id ? String(banner.product_id) : '',
      title: banner.title,
      subtitle: banner.subtitle || '',
      discount_text_top: banner.discount_text_top || '',
      discount_text_bottom: banner.discount_text_bottom || '',
      background_color: banner.background_color || '#1e40af',
      text_color: banner.text_color || '#ffffff',
      active: banner.active,
      custom_image_url: banner.custom_image_url || '',
    });
    setUploadFile(null);
    setErrorMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProductChange = (productId: string) => {
    const p = products.find((pr) => pr.id === Number(productId));
    setForm((prev) => ({
      ...prev,
      product_id: productId,
      title: prev.title || p?.name || '',
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadFile(file);
  };

  const uploadCustomImage = async (): Promise<string | null> => {
    if (!uploadFile) return form.custom_image_url || null;

    const fileExt = uploadFile.name.split('.').pop();
    const fileName = `banner_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, uploadFile);

    if (uploadError) {
      setErrorMsg('Error subiendo la imagen: ' + uploadError.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  };

  const handleSave = async () => {
    setErrorMsg('');

    if (!form.product_id) {
      setErrorMsg('Debes seleccionar un producto ya creado.');
      return;
    }
    if (!form.title.trim()) {
      setErrorMsg('El título es obligatorio.');
      return;
    }

    setSaving(true);

    const customImageUrl = await uploadCustomImage();
    if (uploadFile && !customImageUrl) {
      setSaving(false);
      return;
    }

    const payload = {
      product_id: Number(form.product_id),
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      discount_text_top: form.discount_text_top.trim() || null,
      discount_text_bottom: form.discount_text_bottom.trim() || null,
      background_color: form.background_color,
      text_color: form.text_color,
      active: form.active,
      custom_image_url: customImageUrl,
      image_url: selectedProduct?.image_url || null,
    };

    let error;
    if (form.id) {
      ({ error } = await supabase
        .from('banners')
        .update(payload)
        .eq('id', form.id));
    } else {
      const nextOrder =
        banners.length > 0
          ? Math.max(...banners.map((b) => b.order_index)) + 1
          : 0;
      ({ error } = await supabase
        .from('banners')
        .insert({ ...payload, order_index: nextOrder }));
    }

    setSaving(false);

    if (error) {
      if (error.message.includes('5 banners activos')) {
        setErrorMsg(
          'Ya tienes 5 banners activos. Desactiva uno antes de activar otro.'
        );
      } else {
        setErrorMsg('Error guardando: ' + error.message);
      }
      return;
    }

    resetForm();
    loadData();
  };

  const toggleActive = async (banner: Banner) => {
    const { error } = await supabase
      .from('banners')
      .update({ active: !banner.active })
      .eq('id', banner.id);

    if (error) {
      alert(
        error.message.includes('5 banners activos')
          ? 'Ya tienes 5 banners activos. Desactiva uno antes de activar otro.'
          : 'Error: ' + error.message
      );
      return;
    }
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este banner? Esta acción no se puede deshacer.'))
      return;
    await supabase.from('banners').delete().eq('id', id);
    loadData();
  };

  const moveOrder = async (banner: Banner, direction: 'up' | 'down') => {
    const sorted = [...banners].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex((b) => b.id === banner.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];

    await supabase
      .from('banners')
      .update({ order_index: other.order_index })
      .eq('id', banner.id);
    await supabase
      .from('banners')
      .update({ order_index: banner.order_index })
      .eq('id', other.id);

    loadData();
  };

  if (loading) {
    return <div className="p-6">Cargando banners...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Banners Rotativos</h1>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${activeCount >= 5
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
            }`}
        >
          {activeCount} / 5 activos
        </span>
      </div>

      {/* Formulario */}
      <div className="bg-white border rounded-lg p-5 mb-8 shadow-sm">
        <h2 className="font-semibold mb-4">
          {form.id ? 'Editar banner' : 'Nuevo banner'}
        </h2>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-4">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Columna izquierda: campos */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Producto *
              </label>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.product_id}
                onChange={(e) => handleProductChange(e.target.value)}
              >
                <option value="">Selecciona un producto...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - ${p.price}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Título *
              </label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Subtítulo
              </label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.subtitle}
                onChange={(e) =>
                  setForm({ ...form, subtitle: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Texto superior (ej: 30% OFF)
                </label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.discount_text_top}
                  onChange={(e) =>
                    setForm({ ...form, discount_text_top: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Texto inferior (ej: Solo hoy)
                </label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.discount_text_bottom}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      discount_text_bottom: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Color de fondo
                </label>
                <input
                  type="color"
                  className="w-full h-10 border rounded"
                  value={form.background_color}
                  onChange={(e) =>
                    setForm({ ...form, background_color: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Color de texto
                </label>
                <input
                  type="color"
                  className="w-full h-10 border rounded"
                  value={form.text_color}
                  onChange={(e) =>
                    setForm({ ...form, text_color: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Imagen personalizada (opcional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si no subes ninguna, se usa la imagen del producto.
              </p>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              <span className="text-sm">Banner activo</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {saving ? 'Guardando...' : form.id ? 'Actualizar' : 'Crear banner'}
              </button>
              {form.id && (
                <button
                  onClick={resetForm}
                  className="border px-4 py-2 rounded"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </div>

          {/* Columna derecha: vista previa */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Vista previa
            </label>
            <div
              className="relative w-full h-56 rounded-lg overflow-hidden flex"
              style={{ backgroundColor: form.background_color }}
            >
              {/* Panel de texto (color sólido, garantiza contraste) */}
              <div
                className="flex-1 flex flex-col justify-center px-5 py-4 min-w-0"
                style={{ color: form.text_color }}
              >
                {form.discount_text_top && (
                  <p className="text-xl font-extrabold mb-1 leading-tight">
                    {form.discount_text_top}
                  </p>
                )}
                <h3 className="text-lg font-bold leading-tight">
                  {form.title || 'Título del banner'}
                </h3>
                {form.subtitle && (
                  <p className="text-sm mt-1 opacity-90">{form.subtitle}</p>
                )}
                {form.discount_text_bottom && (
                  <p className="text-sm mt-2 font-semibold">
                    {form.discount_text_bottom}
                  </p>
                )}
              </div>

              {/* Imagen del producto, sin recortar ni deformar */}
              {previewImage && (
                <div className="w-2/5 bg-white flex items-center justify-center flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewImage}
                    alt={form.title || 'Producto'}
                    className="w-full h-full object-contain p-3"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Tip: elige un color de texto que contraste bien con el color de
              fondo (ej: texto blanco sobre fondo azul oscuro).
            </p>
          </div>
        </div>
      </div>

      {/* Listado de banners */}
      <div className="bg-white border rounded-lg shadow-sm">
        <h2 className="font-semibold p-4 border-b">
          Banners existentes ({banners.length})
        </h2>
        {banners.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm">
            No hay banners creados todavía.
          </p>
        ) : (
          <div className="divide-y">
            {[...banners]
              .sort((a, b) => a.order_index - b.order_index)
              .map((banner) => (
                <div
                  key={banner.id}
                  className="flex items-center gap-4 p-4"
                >
                  <div
                    className="w-24 h-16 rounded flex-shrink-0 flex overflow-hidden"
                    style={{ backgroundColor: banner.background_color }}
                  >
                    <div className="flex-1 bg-white flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          banner.custom_image_url ||
                          banner.image_url ||
                          banner.products?.image_url ||
                          ''
                        }
                        alt={banner.title}
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{banner.title}</p>
                    <p className="text-xs text-gray-500">
                      Producto: {banner.products?.name || '—'}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${banner.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}
                  >
                    {banner.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveOrder(banner, 'up')}
                      className="px-2 py-1 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      title="Subir"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveOrder(banner, 'down')}
                      className="px-2 py-1 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      title="Bajar"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => toggleActive(banner)}
                      className={`px-3 py-1 rounded text-sm text-white ${banner.active
                          ? 'bg-yellow-500 hover:bg-yellow-600'
                          : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                      {banner.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleEdit(banner)}
                      className="px-3 py-1 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className="px-3 py-1 rounded text-sm bg-red-600 hover:bg-red-700 text-white"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
