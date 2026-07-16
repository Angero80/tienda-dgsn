'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../lib/supabaseClient';
import QuickCreateAttributeModal from '../../../components/QuickCreateAttributeModal';
import CurrencyInput from '../../../components/CurrencyInput';
import BarcodeScannerModal from '../../../components/BarcodeScannerModal';
import RelationSearchSelect from '../../../components/RelationSearchSelect';
import TaxSuggestionSearch from '../../../components/TaxSuggestionSearch';
import { useAlertDialog } from '../../../components/AlertDialogProvider';
import { formatCurrency } from '../../../../../lib/formatCurrency';

type Category = { id: number; name: string };
type Brand = { id: number; name: string };
type Presentation = { id: number; name: string; dian_unit_id?: number | null };
type Tax = { id: number; name: string; rate: number; is_active: boolean };

// Iniciales de cada palabra del texto, en mayúscula (ej: "Laptop Premium" -> "LP")
const getInitials = (text: string): string =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

export default function EditProductPage() {
  const dialog = useAlertDialog();
  const router = useRouter();
  const params = useParams();
  const productId = Number(params.id);

  const [businessSector, setBusinessSector] = useState<string>('mixto');
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const loadSector = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'business_sector')
        .maybeSingle();
      if (data?.value) setBusinessSector(data.value);
    };
    loadSector();
  }, []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'bien' as 'bien' | 'servicio',
    cost: '',
    price: '',
    sku: '',
    barcode: '',
    stock: '',
    category_id: '',
    brand_id: '',
    presentation_id: '',
    image_url: null as string | null,
    images: [] as string[],
    selected_tax_ids: [] as number[],
  });
  const [selectedFiles, setSelectedFiles] = useState<(File | null)[]>([null, null, null, null, null]);
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([null, null, null, null, null]);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);

  const [openAttributeModal, setOpenAttributeModal] = useState<
    'category' | 'brand' | 'presentation' | null
  >(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);

  // SKU = iniciales(nombre) + iniciales(categoría) + iniciales(marca) +
  // iniciales(presentación) + consecutivo de 3 dígitos (001, 002...), único
  // por esa combinación de iniciales. Excluye este mismo producto al buscar
  // el consecutivo más alto, para no inflarlo por su propio SKU actual.
  const handleGenerateSku = async () => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push('Nombre');
    if (!form.category_id) missing.push('Categoría');
    if (effectiveType === 'bien' && !form.brand_id) missing.push('Marca');
    if (!form.presentation_id) missing.push('Presentación');

    if (missing.length > 0) {
      await dialog.alert(`Completa estos campos antes de generar el SKU: ${missing.join(', ')}.`, {
        variant: 'warning',
        title: 'Faltan datos',
      });
      return;
    }

    const categoryName = categories.find((c) => String(c.id) === form.category_id)?.name || '';
    const brandName = brands.find((b) => String(b.id) === form.brand_id)?.name || '';
    const presentationName = presentations.find((p) => String(p.id) === form.presentation_id)?.name || '';

    // En servicios la marca no aplica: se marca con "_" en vez de omitirse,
    // para que el SKU mantenga sus 4 segmentos reconocibles.
    const brandInitials = effectiveType === 'servicio' ? '_' : getInitials(brandName);

    const prefix = getInitials(form.name) + getInitials(categoryName) + brandInitials + getInitials(presentationName);

    setGeneratingSku(true);
    const { data, error } = await supabase
      .from('products')
      .select('sku')
      .ilike('sku', `${prefix}%`)
      .neq('id', productId);
    setGeneratingSku(false);

    if (error) {
      console.error('Error buscando SKUs existentes:', error.message);
      return;
    }

    let maxNum = 0;
    const suffixPattern = new RegExp(`^${prefix}(\\d{3})$`);
    (data || []).forEach((p) => {
      const match = p.sku?.match(suffixPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = String(maxNum + 1).padStart(3, '0');
    setForm((f) => ({ ...f, sku: prefix + nextNum }));
  };

  useEffect(() => {
    const loadAll = async () => {
      const [
        { data: cats, error: err1 },
        { data: brs, error: err2 },
        { data: pres, error: err3 },
        { data: txs, error: err4 },
        { data: product, error: prodError },
      ] = await Promise.all([
        supabase.from('categories').select('id, name'),
        supabase.from('brands').select('id, name'),
        supabase.from('presentations').select('id, name, dian_unit_id'),
        supabase.from('taxes').select('id, name, rate, is_active').eq('is_active', true).order('name'),
        supabase.from('products').select('*').eq('id', productId).single(),
      ]);

      if (err1) console.error('Error cargando categorías:', err1);
      if (err2) console.error('Error cargando marcas:', err2);
      if (err3) console.error('Error cargando presentaciones:', err3);
      if (err4) console.error('Error cargando impuestos:', err4);

      setCategories(cats || []);
      setBrands(brs || []);
      setPresentations(pres || []);
      setTaxes(txs || []);

      if (prodError || !product) {
        setNotFound(true);
        setLoadingData(false);
        return;
      }

      const { data: productTaxes } = await supabase
        .from('product_taxes')
        .select('tax_id')
        .eq('product_id', productId);

      const initialPreviewUrls = [product.image_url, ...(product.images || []).filter(Boolean)];
      const paddedUrls = [...initialPreviewUrls, ...Array(5 - initialPreviewUrls.length).fill(null)];

      setForm({
        name: product.name,
        description: product.description || '',
        type: product.type || 'bien',
        cost: product.cost.toString(),
        price: product.price.toString(),
        sku: product.sku,
        barcode: product.barcode || '',
        stock: product.stock.toString(),
        category_id: product.category_id?.toString() || '',
        brand_id: product.brand_id?.toString() || '',
        presentation_id: product.presentation_id?.toString() || '',
        image_url: product.image_url,
        images: (product.images || []).filter(Boolean),
        selected_tax_ids: (productTaxes || []).map((pt) => pt.tax_id),
      });
      setPreviewUrls(paddedUrls as (string | null)[]);
      setLoadingData(false);
    };

    loadAll();
  }, [productId]);

  const handleCostChange = (rawValue: string) => {
    const cost = parseFloat(rawValue) || 0;
    setForm({ ...form, cost: rawValue, price: cost ? (cost * 1.3).toFixed(2) : '' });
  };

  const getStoragePath = (url: string): string | null => {
    const marker = '/product-images/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  };

  const markForDeletionIfSaved = (url: string | null) => {
    if (url && !url.startsWith('blob:')) {
      setFilesToDelete((prev) => [...prev, url]);
    }
  };

  const promoteToCover = (i: number) => {
    setSelectedFiles((prev) => {
      const next = [...prev];
      [next[0], next[i]] = [next[i], next[0]];
      return next;
    });
    setPreviewUrls((prev) => {
      const next = [...prev];
      [next[0], next[i]] = [next[i], next[0]];

      const newCoverIsPendingFile = Boolean(next[0] && next[0]!.startsWith('blob:'));
      setForm((f) => ({
        ...f,
        image_url: newCoverIsPendingFile ? f.image_url : next[0],
      }));

      return next;
    });
  };

  const resizeImage = (file: File, maxWidth = 400, maxHeight = 400): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                type: 'image/webp',
              });
              resolve(resizedFile);
            }
          },
          'image/webp',
          0.8
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const uploadImages = async (): Promise<{ coverUrl: string | null; galleryUrls: string[] }> => {
    let coverUrl = form.image_url;
    const galleryUrls: string[] = [];

    if (selectedFiles[0]) {
      const coverFile = selectedFiles[0] as File;
      const cleanName = `cover_${form.sku || Date.now()}.webp`;

      if (coverUrl) {
        const oldPath = coverUrl.split('/product-images/')[1];
        if (oldPath) await supabase.storage.from('product-images').remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(cleanName, coverFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('product-images').getPublicUrl(cleanName);
      coverUrl = data.publicUrl;
    }

    for (let i = 1; i < 5; i++) {
      if (selectedFiles[i]) {
        const file = selectedFiles[i] as File;
        const cleanName = `${form.sku || Date.now()}_img_${i}.webp`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(cleanName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('product-images').getPublicUrl(cleanName);
        galleryUrls.push(data.publicUrl);
      } else if (previewUrls[i]) {
        galleryUrls.push(previewUrls[i]!);
      }
    }

    return { coverUrl, galleryUrls };
  };

  const effectiveType: 'bien' | 'servicio' =
    businessSector === 'servicios' ? 'servicio' :
    businessSector === 'bienes' ? 'bien' :
    form.type;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      await dialog.alert('El nombre es obligatorio', { variant: 'warning', title: 'Falta un dato' });
      return;
    }
    if (!form.sku.trim()) {
      await dialog.alert('El SKU es obligatorio', { variant: 'warning', title: 'Falta un dato' });
      return;
    }
    if (form.selected_tax_ids.length === 0) {
      await dialog.alert('Debes elegir al menos un impuesto para este producto.', {
        variant: 'warning',
        title: 'Falta un dato',
      });
      return;
    }

    setSaving(true);
    try {
      const { coverUrl, galleryUrls } = await uploadImages();

      const productData = {
        name: form.name.trim(),
        description: form.description.trim(),
        type: effectiveType,
        cost: parseFloat(form.cost) || 0,
        price: parseFloat(form.price) || 0,
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        stock: parseInt(form.stock) || 0,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        brand_id: form.brand_id ? parseInt(form.brand_id) : null,
        presentation_id: form.presentation_id ? parseInt(form.presentation_id) : null,
        image_url: coverUrl,
        images: galleryUrls,
      };

      const { error } = await supabase.from('products').update(productData).eq('id', productId);
      if (error) throw error;

      const { error: deleteTaxesError } = await supabase
        .from('product_taxes')
        .delete()
        .eq('product_id', productId);
      if (deleteTaxesError) throw deleteTaxesError;

      if (form.selected_tax_ids.length > 0) {
        const { error: insertTaxesError } = await supabase
          .from('product_taxes')
          .insert(form.selected_tax_ids.map((taxId) => ({ product_id: productId, tax_id: taxId })));
        if (insertTaxesError) throw insertTaxesError;
      }

      if (filesToDelete.length > 0) {
        const paths = filesToDelete
          .map((url) => getStoragePath(url))
          .filter((p): p is string => Boolean(p));
        if (paths.length > 0) {
          await supabase.storage.from('product-images').remove(paths);
        }
      }

      router.push('/admin/products');
    } catch (err: any) {
      console.error('Error al guardar producto:', err);
      await dialog.alert('Error: ' + (err.message || 'No se pudo guardar el producto'), {
        variant: 'danger',
        title: 'Error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return <div className="p-6">Cargando producto...</div>;
  }

  if (notFound) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">No se encontró este producto.</p>
        <Link href="/admin/products" className="text-blue-600 underline">
          ← Volver a Productos
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Editar Producto</h1>
        <Link
          href="/admin/products"
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium px-4 py-2 rounded text-sm"
        >
          ← Volver
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">Nombre</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
            placeholder="Ej: Laptop"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">Descripción</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
            placeholder="Detalles del producto"
          />
        </div>

        {businessSector === 'mixto' && (
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Tipo</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  checked={form.type === 'bien'}
                  onChange={() => setForm({ ...form, type: 'bien' })}
                />
                Bien
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  checked={form.type === 'servicio'}
                  onChange={() => setForm({ ...form, type: 'servicio', stock: '0', barcode: '', brand_id: '' })}
                />
                Servicio
              </label>
            </div>
            <div className="mt-1 bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs text-blue-800">
              💡 <strong>Bien</strong>: producto físico con inventario que se agota al venderse (ej: una
              laptop). <strong>Servicio</strong>: no maneja stock ni código de barras (ej: una instalación
              o asesoría).
            </div>
          </div>
        )}

        <div className={`grid ${effectiveType === 'servicio' ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Costo</label>
            <CurrencyInput
              required
              value={form.cost}
              onChange={handleCostChange}
              className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
              placeholder="Costo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Precio (30%)</label>
            <CurrencyInput
              required
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
              className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
              placeholder="Precio"
            />
          </div>
          {effectiveType === 'bien' && (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Stock</label>
              <input
                type="number"
                required
                value={form.stock}
                onChange={e => setForm({ ...form, stock: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                placeholder="Cantidad"
              />
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs text-blue-800">
          💡 El precio se sugiere automáticamente (Costo + 30%). Es solo una sugerencia — puedes cambiarlo
          si lo necesitas.
        </div>

        {/* Categoría, Marca y Presentación en una sola fila compacta */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Categoría</label>
            <div className="flex gap-1">
              <div className="flex-1 min-w-0">
                <RelationSearchSelect
                  items={categories}
                  value={form.category_id}
                  onChange={(id) => setForm({ ...form, category_id: id })}
                  placeholder="Buscar categoría..."
                />
              </div>
              <button
                type="button"
                onClick={() => setOpenAttributeModal('category')}
                title="Nueva categoría"
                className="flex-shrink-0 w-9 h-9 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Marca</label>
            <div className="flex gap-1">
              <div className="flex-1 min-w-0">
                <RelationSearchSelect
                  items={brands}
                  value={form.brand_id}
                  onChange={(id) => setForm({ ...form, brand_id: id })}
                  placeholder="Buscar marca..."
                  disabled={effectiveType === 'servicio'}
                />
              </div>
              <button
                type="button"
                onClick={() => setOpenAttributeModal('brand')}
                title="Nueva marca"
                disabled={effectiveType === 'servicio'}
                className="flex-shrink-0 w-9 h-9 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold"
              >
                +
              </button>
            </div>
            {effectiveType === 'servicio' && (
              <p className="text-xs text-gray-500 mt-1">No aplica para servicios.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Presentación</label>
            <div className="flex gap-1">
              <div className="flex-1 min-w-0">
                <RelationSearchSelect
                  items={presentations}
                  value={form.presentation_id}
                  onChange={(id) => setForm({ ...form, presentation_id: id })}
                  placeholder="Buscar presentación..."
                />
              </div>
              <button
                type="button"
                onClick={() => setOpenAttributeModal('presentation')}
                title="Nueva presentación"
                className="flex-shrink-0 w-9 h-9 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                +
              </button>
            </div>

          </div>
        </div>

        <div className={`grid ${effectiveType === 'servicio' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">SKU</label>
            <div className="flex gap-1">
              <input
                type="text"
                required
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                className="flex-1 min-w-0 p-2 border border-gray-300 rounded text-gray-900 bg-white"
                placeholder="Código único"
              />
              <button
                type="button"
                onClick={handleGenerateSku}
                disabled={generatingSku}
                title="Generar SKU automático (iniciales + consecutivo)"
                className="flex-shrink-0 px-3 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm whitespace-nowrap"
              >
                {generatingSku ? '...' : '🔄 Generar'}
              </button>
            </div>
            <div className="mt-1 bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs text-blue-800">
              💡 Se arma con las iniciales de nombre + categoría + marca + presentación, más un
              consecutivo (001, 002...). Puedes editarlo a mano si lo prefieres.
            </div>
          </div>
          {effectiveType === 'bien' && (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Código de Barras</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={form.barcode}
                  onChange={e => setForm({ ...form, barcode: e.target.value })}
                  className="flex-1 min-w-0 p-2 border border-gray-300 rounded text-gray-900 bg-white"
                  placeholder="Opcional"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  title="Escanear el código de fábrica del producto"
                  className="flex-shrink-0 px-3 rounded bg-green-600 hover:bg-green-700 text-white text-sm whitespace-nowrap"
                >
                  📷
                </button>
              </div>
              <div className="mt-1 bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs text-blue-800">
                💡 Escanea el código de barras real del producto (el que trae de fábrica).
              </div>
            </div>
          )}
        </div>

        {/* Impuestos */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">
            Impuestos aplicables
          </label>

          {taxes.length === 0 ? (
            <p className="text-xs text-gray-500">
              No hay impuestos activos. Actívalos en Configuración → Impuestos.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {taxes.map((tax) => (
                <label key={tax.id} className="flex items-center gap-1.5 text-sm text-gray-800">
                  <input
                    type="radio"
                    name="product-tax"
                    required
                    checked={form.selected_tax_ids[0] === tax.id}
                    onChange={() => setForm({ ...form, selected_tax_ids: [tax.id] })}
                  />
                  {tax.name} ({Number(tax.rate).toFixed(0)}%)
                </label>
              ))}
            </div>
          )}
          <div className="mt-1 bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 text-xs text-blue-800">
            💡 Normalmente un producto lleva un solo impuesto (ej: IVA 19%, o INC 8% si es un producto
            de restaurante/bar). Se usará cuando generemos la factura.
          </div>

          <div className="mt-3">
            <TaxSuggestionSearch
              taxes={taxes}
              onApply={(tax) =>
                // "Aplicar" reemplaza la selección (normalmente un producto
                // lleva un solo impuesto), no la acumula.
                setForm((prev) => ({ ...prev, selected_tax_ids: [tax.id] }))
              }
            />
          </div>
        </div>

        {/* Imágenes */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">Imágenes (1 portada + 4 adicionales)</label>
          <div className="grid grid-cols-5 gap-2">
            {/* Cuadro 1: Portada */}
            <div
              className="relative w-full pt-[100%] border-2 border-dashed rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 transition"
              style={{ borderColor: previewUrls[0] ? '#3B82F6' : '#CBD5E1' }}
              onClick={() => document.getElementById('cover-upload')?.click()}
            >
              {previewUrls[0] ? (
                <>
                  <img src={previewUrls[0]} alt="Portada" className="absolute inset-0 w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newUrls = [...previewUrls];
                      const newFiles = [...selectedFiles];
                      if (newUrls[0]) {
                        URL.revokeObjectURL(newUrls[0]!);
                        markForDeletionIfSaved(newUrls[0]);
                      }
                      newUrls[0] = null;
                      newFiles[0] = null;
                      setPreviewUrls(newUrls);
                      setSelectedFiles(newFiles);
                      setForm(prev => ({ ...prev, image_url: null }));
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                  <span className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-1 rounded-br">Portada</span>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl text-gray-400">+</span>
                </div>
              )}
            </div>

            {/* Cuadros 2-5: Imágenes adicionales */}
            {Array.from({ length: 4 }).map((_, index) => {
              const i = index + 1;
              return (
                <div
                  key={i}
                  className="relative w-full pt-[100%] border-2 border-dashed rounded-lg overflow-hidden cursor-pointer hover:border-green-400 transition"
                  style={{ borderColor: previewUrls[i] ? '#10B981' : '#CBD5E1' }}
                  onClick={() => document.getElementById(`img-upload-${i}`)?.click()}
                >
                  {previewUrls[i] ? (
                    <>
                      <img src={previewUrls[i]} alt={`Adicional ${i}`} className="absolute inset-0 w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newUrls = [...previewUrls];
                          const newFiles = [...selectedFiles];
                          if (newUrls[i]) {
                            URL.revokeObjectURL(newUrls[i]!);
                            markForDeletionIfSaved(newUrls[i]);
                          }
                          newUrls[i] = null;
                          newFiles[i] = null;
                          setPreviewUrls(newUrls);
                          setSelectedFiles(newFiles);
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          promoteToCover(i);
                        }}
                        className="absolute bottom-0 left-0 right-0 bg-blue-600 hover:bg-blue-700 text-white text-[10px] py-0.5 text-center"
                      >
                        Usar como portada
                      </button>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl text-gray-400">+</span>
                    </div>
                  )}
                  <input
                    id={`img-upload-${i}`}
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const processedFile = await resizeImage(file);
                      const newFiles = [...selectedFiles];
                      const newUrls = [...previewUrls];
                      newFiles[i] = processedFile;
                      newUrls[i] = URL.createObjectURL(processedFile);
                      setSelectedFiles(newFiles);
                      setPreviewUrls(newUrls);
                    }}
                    className="hidden"
                  />
                </div>
              );
            })}
          </div>

          <input
            id="cover-upload"
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const processedFile = await resizeImage(file);
              const newFiles = [...selectedFiles];
              const newUrls = [...previewUrls];
              if (newUrls[0]) URL.revokeObjectURL(newUrls[0]!);
              newFiles[0] = processedFile;
              newUrls[0] = URL.createObjectURL(processedFile);
              setSelectedFiles(newFiles);
              setPreviewUrls(newUrls);
            }}
            className="hidden"
          />
        </div>

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
            {saving ? 'Guardando...' : 'Actualizar'}
          </button>
        </div>
      </form>

      <QuickCreateAttributeModal
        isOpen={openAttributeModal === 'category'}
        onClose={() => setOpenAttributeModal(null)}
        tableName="categories"
        title="Nueva Categoría"
        existingList={categories}
        onCreated={(newItem) => {
          setCategories((prev) => (prev.some((c) => c.id === newItem.id) ? prev : [...prev, newItem]));
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
          setBrands((prev) => (prev.some((b) => b.id === newItem.id) ? prev : [...prev, newItem]));
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
          setPresentations((prev) => (prev.some((p) => p.id === newItem.id) ? prev : [...prev, newItem]));
          setForm((f) => ({ ...f, presentation_id: String(newItem.id) }));
        }}
      />
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setForm((f) => ({ ...f, barcode: code }));
          setScannerOpen(false);
        }}
      />
    </div>
  );
}