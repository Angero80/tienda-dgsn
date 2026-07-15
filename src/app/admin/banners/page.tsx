'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { applyMaxOpacity, PASTEL_BANNER_TEXT_COLOR } from '../../../lib/colorUtils';
import { useAlertDialog } from '../components/AlertDialogProvider';

type Product = {
  id: number;
  name: string;
  image_url: string;
  images: string[] | null;
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
  image_position: 'left' | 'right';
  is_full_banner: boolean;
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
  image_position: 'left' as 'left' | 'right',
  is_full_banner: false,
};

export default function BannersPage() {
  const dialog = useAlertDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>('');
  const [dimensionWarning, setDimensionWarning] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [savedSnapshot, setSavedSnapshot] = useState(emptyForm);
  const [bannerSource, setBannerSource] = useState<'product' | 'custom' | 'full'>('product');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  const isDirty =
    JSON.stringify(form) !== JSON.stringify(savedSnapshot) || uploadFile !== null;

  // Aviso nativo del navegador si intenta cerrar la pestaña o recargar con
  // cambios sin guardar (no cubre la navegación interna del panel, solo
  // cierre/recarga/URL directa).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    if (!uploadFile) {
      setLocalPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(uploadFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadFile]);

  // Solo importa la proporción recomendada (5:1) cuando es "banner completo":
  // en modo normal la imagen es libre (foto de producto).
  useEffect(() => {
    if (!localPreviewUrl || !form.is_full_banner) {
      setDimensionWarning('');
      return;
    }
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      const targetRatio = 5; // 1200x240
      const tolerance = 0.15;
      if (Math.abs(ratio - targetRatio) / targetRatio > tolerance) {
        setDimensionWarning(
          `Esta imagen es ${img.width}×${img.height}px (proporción ${ratio.toFixed(2)}:1) y no coincide exactamente con la proporción recomendada (5:1). Se mostrará completa sin recortar y el espacio sobrante se rellenará con el color de fondo.`
        );
      } else {
        setDimensionWarning('');
      }
    };
    img.src = localPreviewUrl;
  }, [localPreviewUrl, form.is_full_banner]);

  const activeCount = banners.filter((b) => b.active).length;

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, image_url, images, price')
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
    localPreviewUrl || form.custom_image_url || selectedProduct?.image_url || '';

  const resetForm = () => {
    setForm(emptyForm);
    setSavedSnapshot(emptyForm);
    setUploadFile(null);
    setErrorMsg('');
    setBannerSource('product');
    setProductSearchTerm('');
    setProductDropdownOpen(false);
  };

  const handleEdit = (banner: Banner) => {
    const loaded = {
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
      image_position: banner.image_position || 'left',
      is_full_banner: banner.is_full_banner || false,
    };
    setForm(loaded);
    setSavedSnapshot(loaded);
    setUploadFile(null);
    setErrorMsg('');
    setBannerSource(banner.is_full_banner ? 'full' : banner.product_id ? 'product' : 'custom');
    setProductSearchTerm('');
    setProductDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProductChange = (productId: string) => {
    const p = products.find((pr) => pr.id === Number(productId));
    setForm((prev) => ({
      ...prev,
      product_id: productId,
      title: p?.name || '',
      custom_image_url: '',
    }));
    setProductSearchTerm('');
    setProductDropdownOpen(false);
  };

  const handleSourceChange = (source: 'product' | 'custom' | 'full') => {
    setBannerSource(source);
    setForm((prev) => ({
      ...prev,
      is_full_banner: source === 'full',
      product_id: source === 'product' ? prev.product_id : '',
      custom_image_url: '',
    }));
    setUploadFile(null);
    setProductSearchTerm('');
    setProductDropdownOpen(false);
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

    if (bannerSource === 'product' && !form.product_id) {
      setErrorMsg('Debes seleccionar un producto, o cambiar el origen del banner a "Personalizado".');
      return;
    }
    if (!form.title.trim()) {
      setErrorMsg('El título es obligatorio.');
      return;
    }
    if (form.is_full_banner && !uploadFile && !form.custom_image_url) {
      setErrorMsg('Debes subir la imagen del banner completo.');
      return;
    }

    setSaving(true);

    const customImageUrl = await uploadCustomImage();
    if (uploadFile && !customImageUrl) {
      setSaving(false);
      return;
    }

    const payload = {
      product_id: bannerSource === 'product' ? Number(form.product_id) : null,
      title: form.title.trim(),
      subtitle: form.is_full_banner ? null : form.subtitle.trim() || null,
      discount_text_top: form.is_full_banner ? null : form.discount_text_top.trim() || null,
      discount_text_bottom: form.is_full_banner ? null : form.discount_text_bottom.trim() || null,
      background_color: form.background_color,
      text_color: form.text_color,
      active: form.active,
      custom_image_url: customImageUrl,
      image_url: selectedProduct?.image_url || null,
      image_position: form.image_position,
      is_full_banner: form.is_full_banner,
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
      await dialog.alert(
        error.message.includes('5 banners activos')
          ? 'Ya tienes 5 banners activos. Desactiva uno antes de activar otro.'
          : 'Error: ' + error.message,
        { variant: 'warning', title: error.message.includes('5 banners activos') ? 'Límite alcanzado' : 'Error' }
      );
      return;
    }
    loadData();
  };

  const handleDelete = async (id: number) => {
    const confirmed = await dialog.confirm('¿Eliminar este banner? Esta acción no se puede deshacer.', {
      variant: 'warning',
      confirmText: 'Sí, eliminar',
    });
    if (!confirmed) return;
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
              <label className="block text-sm font-medium mb-2">
                Origen del banner
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="banner_source"
                    checked={bannerSource === 'product'}
                    onChange={() => handleSourceChange('product')}
                  />
                  Producto del catálogo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="banner_source"
                    checked={bannerSource === 'custom'}
                    onChange={() => handleSourceChange('custom')}
                  />
                  Personalizado (sin producto — subes imagen y escribes el mensaje)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="banner_source"
                    checked={bannerSource === 'full'}
                    onChange={() => handleSourceChange('full')}
                  />
                  Imagen de banner completo (sin producto, sin texto superpuesto)
                </label>
              </div>
            </div>

            {bannerSource === 'product' && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Producto *
                </label>
                {form.product_id && !productSearchTerm ? (
                  <div className="flex items-center justify-between border rounded px-3 py-2 bg-gray-50">
                    <span className="text-sm">
                      {selectedProduct?.name || 'Producto seleccionado'}
                      {selectedProduct && (
                        <span className="text-gray-500"> — ${selectedProduct.price}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, product_id: '' })}
                      className="text-blue-600 text-xs underline"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      autoComplete="off"
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      onFocus={() => setProductDropdownOpen(true)}
                      onBlur={() => setProductDropdownOpen(false)}
                      placeholder="Buscar o elegir un producto..."
                      className="w-full border rounded px-3 py-2"
                    />
                    {productDropdownOpen && (
                      <ul className="absolute z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-[180px] overflow-y-auto">
                        {products
                          .filter((p) =>
                            p.name.toLowerCase().includes(productSearchTerm.trim().toLowerCase())
                          )
                          .map((p) => (
                            <li
                              key={p.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleProductChange(String(p.id))}
                              className="h-9 px-2 flex items-center justify-between hover:bg-gray-100 cursor-pointer text-sm"
                            >
                              <span className="truncate">{p.name}</span>
                              <span className="text-gray-500 ml-2 flex-shrink-0">${p.price}</span>
                            </li>
                          ))}
                        {products.filter((p) =>
                          p.name.toLowerCase().includes(productSearchTerm.trim().toLowerCase())
                        ).length === 0 && (
                          <li className="h-9 px-2 flex items-center text-gray-500 text-sm">Sin resultados</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

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

            {!form.is_full_banner && (
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
            )}

            {!form.is_full_banner && (
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
            )}

            {!form.is_full_banner && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Posición de la imagen
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="image_position"
                      checked={form.image_position === 'left'}
                      onChange={() => setForm({ ...form, image_position: 'left' })}
                    />
                    Izquierda (texto a la derecha)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="image_position"
                      checked={form.image_position === 'right'}
                      onChange={() => setForm({ ...form, image_position: 'right' })}
                    />
                    Derecha (texto a la izquierda)
                  </label>
                </div>
              </div>
            )}

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

            {bannerSource === 'product' ? (
              <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                <label className="block text-sm font-medium mb-1">
                  Foto para el banner
                </label>
                {selectedProduct ? (
                  (() => {
                    const photos = Array.from(
                      new Set([selectedProduct.image_url, ...(selectedProduct.images || [])].filter(Boolean))
                    );
                    return photos.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {photos.map((url) => {
                          const isSelected =
                            (form.custom_image_url || selectedProduct.image_url) === url;
                          return (
                            <button
                              key={url}
                              type="button"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  custom_image_url: url === selectedProduct.image_url ? '' : url,
                                })
                              }
                              className={`w-16 h-16 rounded border-2 overflow-hidden bg-white flex-shrink-0 ${isSelected ? 'border-blue-600' : 'border-gray-200'
                                }`}
                              title={url === selectedProduct.image_url ? 'Foto principal' : 'Foto adicional'}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="w-full h-full object-contain p-1" />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Este producto no tiene fotos cargadas.</p>
                    );
                  })()
                ) : (
                  <p className="text-xs text-gray-500">Selecciona un producto para ver sus fotos.</p>
                )}
              </div>
            ) : (
              <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {form.is_full_banner ? 'Imagen del banner completo *' : 'Imagen (opcional)'}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="banner-image-upload"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => document.getElementById('banner-image-upload')?.click()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                    >
                      Subir imagen
                    </button>
                    <span className="text-sm text-gray-600 truncate">
                      {uploadFile?.name ||
                        (form.custom_image_url ? 'Imagen ya cargada' : 'No hay archivo seleccionado')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {form.is_full_banner
                      ? 'Tamaño recomendado: 1200×240px (proporción 5:1), formato JPG o PNG. Si la imagen no cumple exactamente esa proporción, se muestra completa sin recortar y el espacio sobrante se rellena con el color de fondo.'
                      : 'Recomendado: imagen cuadrada o con fondo transparente, mínimo 500×500px.'}
                  </p>
                  {dimensionWarning && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                      ⚠️ {dimensionWarning}
                    </p>
                  )}
                </div>
              </div>
            )}

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
              <button
                onClick={async () => {
                  if (isDirty) {
                    const confirmed = await dialog.confirm(
                      'Tienes cambios sin guardar. Si sales ahora, se perderán.',
                      { variant: 'warning', confirmText: 'Sí, descartar cambios' }
                    );
                    if (!confirmed) return;
                  }
                  resetForm();
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
              >
                {form.id ? 'Cancelar edición' : 'Cancelar'}
              </button>
            </div>
          </div>

          {/* Columna derecha: vista previa */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Vista previa
            </label>
            <div
              className="relative w-full rounded-lg overflow-hidden flex"
              style={
                form.is_full_banner
                  ? { aspectRatio: '5 / 1', backgroundColor: form.background_color }
                  : { aspectRatio: '5 / 1', backgroundColor: applyMaxOpacity(form.background_color) }
              }
            >
              {form.is_full_banner ? (
                previewImage ? (
                  // Imagen completa: se muestra entera sin recortar; si no
                  // llena el espacio, el color de fondo rellena el resto.
                  <div className="w-full h-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImage}
                      alt={form.title || 'Banner'}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
                    Sube la imagen del banner completo
                  </div>
                )
              ) : (
                <div
                  className={`w-full h-full flex ${form.image_position === 'right' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                >
                  {/* Panel de texto (color sólido, garantiza contraste) */}
                  <div
                    className="flex-1 flex flex-col justify-center px-5 py-4 min-w-0"
                    style={{ color: PASTEL_BANNER_TEXT_COLOR }}
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
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {form.is_full_banner
                ? 'Modo imagen completa: no se superpone ningún texto. Si la imagen no cubre todo el espacio, el color de fondo rellena el resto.'
                : 'El color que elijas se suaviza automáticamente a un tono pastel si es muy oscuro o muy saturado, para proteger el contraste con el texto (siempre en gris oscuro). Esta vista previa ya muestra el resultado final.'}
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
                    style={{ backgroundColor: applyMaxOpacity(banner.background_color) }}
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
                      {banner.is_full_banner && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          Imagen completa
                        </span>
                      )}
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