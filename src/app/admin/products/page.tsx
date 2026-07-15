'use client';

import { useEffect, useState, useRef } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../../../components/Modal';
import { supabase } from '../../../lib/supabaseClient';
import QuickCreateAttributeModal from '../components/QuickCreateAttributeModal';
import { useAlertDialog } from '../components/AlertDialogProvider';

// Tipos
type Category = { id: number; name: string };
type Brand = { id: number; name: string };
type Presentation = { id: number; name: string; dian_unit_id?: number | null };

type Product = {
  id: number;
  name: string;
  description: string;
  type?: 'bien' | 'servicio';
  cost: number;
  price: number;
  sku: string;
  barcode: string;
  stock: number;
  category_id: number | null;
  brand_id: number | null;
  presentation_id: number | null;
  image_url: string | null;
  images: string[] | null;
};

export default function ProductsPage() {
  const dialog = useAlertDialog();
  const [businessSector, setBusinessSector] = useState<string>('mixto');

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

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
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
  });
  const [selectedFiles, setSelectedFiles] = useState<(File | null)[]>([null, null, null, null, null]);
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([null, null, null, null, null]);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Qué mini-modal de atributo está abierto ahora mismo (o ninguno)
  const [openAttributeModal, setOpenAttributeModal] = useState<
    'category' | 'brand' | 'presentation' | null
  >(null);

  // Cargar productos
  useEffect(() => {
    loadProducts();
    loadDependencies();
  }, []);

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, cost, price, sku, barcode, stock, category_id, brand_id, presentation_id, image_url, images');

    if (error) {
      console.error('Error cargando productos:', error);
    } else {
      setProducts(data || []);
    }
  };

  // Cargar categorías, marcas y presentaciones
  const loadDependencies = async () => {
    const {  data: cats, error: err1 } = await supabase.from('categories').select('id, name');
    const {  data: brs, error: err2 } = await supabase.from('brands').select('id, name');
    const {  data: pres, error: err3 } = await supabase.from('presentations').select('id, name, dian_unit_id');

    if (err1) console.error('Error cargando categorías:', err1);
    if (err2) console.error('Error cargando marcas:', err2);
    if (err3) console.error('Error cargando presentaciones:', err3);

    setCategories(cats || []);
    setBrands(brs || []);
    setPresentations(pres || []);
  };

  // Abrir modal (nuevo o editar)
  const openModal = (item: Product | null = null) => {
    setEditing(item);
    setFilesToDelete([]);
    if (item) {
      const initialPreviewUrls = [
        item.image_url,
        ...(item.images || []).filter(Boolean)
      ];
      const paddedUrls = [...initialPreviewUrls, ...Array(5 - initialPreviewUrls.length).fill(null)];

      setForm({
        name: item.name,
        description: item.description || '',
        type: item.type || 'bien',
        cost: item.cost.toString(),
        price: item.price.toString(),
        sku: item.sku,
        barcode: item.barcode || '',
        stock: item.stock.toString(),
        category_id: item.category_id?.toString() || '',
        brand_id: item.brand_id?.toString() || '',
        presentation_id: item.presentation_id?.toString() || '',
        image_url: item.image_url,
        images: (item.images || []).filter(Boolean),
      });
      setPreviewUrls(paddedUrls as (string | null)[]);
      setSelectedFiles([null, null, null, null, null]);
    } else {
      setForm({
        name: '',
        description: '',
        type: 'bien',
        cost: '',
        price: '',
        sku: '',
        barcode: '',
        stock: '',
        category_id: '',
        brand_id: '',
        presentation_id: '',
        image_url: null,
        images: [],
      });
      setPreviewUrls([null, null, null, null, null]);
      setSelectedFiles([null, null, null, null, null]);
    }
    setIsModalOpen(true);
  };

  // Actualizar precio al cambiar costo (30% de margen)
  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cost = parseFloat(e.target.value) || 0;
    setForm({ ...form, cost: e.target.value, price: cost ? (cost * 1.3).toFixed(2) : '' });
  };

  // ✅ Extrae el path relativo dentro del bucket a partir de una URL pública
  const getStoragePath = (url: string): string | null => {
    const marker = '/product-images/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  };

  // ✅ Marca una imagen existente (ya guardada, no un blob local) para borrarla del storage al guardar
  const markForDeletionIfSaved = (url: string | null) => {
    if (url && !url.startsWith('blob:')) {
      setFilesToDelete((prev) => [...prev, url]);
    }
  };

  // ✅ Promueve una de las imágenes adicionales a portada, intercambiando posiciones
  const promoteToCover = (i: number) => {
    setSelectedFiles((prev) => {
      const next = [...prev];
      [next[0], next[i]] = [next[i], next[0]];
      return next;
    });
    setPreviewUrls((prev) => {
      const next = [...prev];
      [next[0], next[i]] = [next[i], next[0]];

      // Si la nueva portada (índice 0) es una URL ya guardada (no un archivo
      // nuevo pendiente de subir), actualizamos form.image_url para que
      // uploadImages() la use como portada correctamente.
      const newCoverIsPendingFile = Boolean((next[0] && next[0]!.startsWith('blob:')));
      setForm((f) => ({
        ...f,
        image_url: newCoverIsPendingFile ? f.image_url : next[0],
      }));

      return next;
    });
  };

  // ✅ Redimensionar imagen a WebP
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

  // ✅ Subir imágenes y portada
  const uploadImages = async (): Promise<{ coverUrl: string | null; galleryUrls: string[] }> => {
    let coverUrl = form.image_url;
    const galleryUrls: string[] = [];

    // Subir portada solo si hay archivo nuevo
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

    // Subir imágenes adicionales (índices 1-4)
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

  // Guardar producto (crear o editar)
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

      if (editing) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editing.id);

        if (error) throw error;

        setProducts(prev => prev.map(p => (p.id === editing.id ? { ...p, ...productData } : p)));
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select();

        if (error) throw error;

        if (data && data.length > 0) {
          setProducts(prev => [...prev, data[0]]);
        }
      }

      // ✅ Borra del storage las imágenes que el usuario quitó sin reemplazo,
      // evitando archivos huérfanos acumulándose en el bucket.
      if (filesToDelete.length > 0) {
        const paths = filesToDelete
          .map((url) => getStoragePath(url))
          .filter((p): p is string => Boolean(p));
        if (paths.length > 0) {
          await supabase.storage.from('product-images').remove(paths);
        }
        setFilesToDelete([]);
      }

      setIsModalOpen(false);
      setEditing(null);
      setForm({
        name: '',
        description: '',
        type: 'bien',
        cost: '',
        price: '',
        sku: '',
        barcode: '',
        stock: '',
        category_id: '',
        brand_id: '',
        presentation_id: '',
        image_url: null,
        images: [],
      });
      setSelectedFiles([null, null, null, null, null]);
      setPreviewUrls([null, null, null, null, null]);
    } catch (err: any) {
      console.error('Error al guardar producto:', err);
      await dialog.alert('Error: ' + (err.message || 'No se pudo guardar el producto'), { variant: 'danger', title: 'Error' });
    }
  };

  // Eliminar producto
  const deleteProduct = async (id: number) => {
    const confirmed = await dialog.confirm('¿Eliminar este producto?', {
      variant: 'warning',
      confirmText: 'Sí, eliminar',
    });
    if (!confirmed) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      await dialog.alert('Error: ' + error.message, { variant: 'danger', title: 'Error' });
    } else {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  // Renderizar nombre de categoría
  const getCategoryName = (categoryId: number | null) => {
    const category = categories.find((c: Category) => c.id === categoryId);
    return category ? category.name : 'Sin categoría';
  };

  const effectiveType: 'bien' | 'servicio' =
    businessSector === 'servicios' ? 'servicio' :
    businessSector === 'bienes' ? 'bien' :
    form.type;

  return (
    <DataTable
      title="Productos"
      columns={[
        { key: 'name', label: 'Nombre' },
        { key: 'sku', label: 'SKU' },
        { key: 'barcode', label: 'Código de Barras' },
        { key: 'cost', label: 'Costo' },
        { key: 'price', label: 'Precio' },
        { key: 'stock', label: 'Stock' },
        {
          key: 'category',
          label: 'Categoría',
          render: (item: Product) => getCategoryName(item.category_id)
        },
        {
          key: 'image',
          label: 'Imagen',
          render: (item: Product) => (
            <img
              src={item.image_url || 'https://placehold.co/50x50/e2e8f0/64748b?text=No'}
              alt={item.name}
              className="w-12 h-12 object-cover rounded"
            />
          ),
          excludeFromExport: true,
        },
      ]}
      data={products}
      formFields={[
        { name: 'name', label: 'Nombre' },
        { name: 'description', label: 'Descripción' },
        { name: 'cost', label: 'Costo' },
        { name: 'price', label: 'Precio' },
        { name: 'sku', label: 'SKU' },
        { name: 'barcode', label: 'Código de Barras' },
        { name: 'stock', label: 'Stock' },
        { name: 'category_id', label: 'Categoría', type: 'select', options: categories.map((c: Category) => ({ value: c.id.toString(), label: c.name })) },
        { name: 'brand_id', label: 'Marca', type: 'select', options: brands.map((b: Brand) => ({ value: b.id.toString(), label: b.name })) },
        { name: 'presentation_id', label: 'Presentación', type: 'select', options: presentations.map((p: Presentation) => ({ value: p.id.toString(), label: p.name })) },
      ]}
      onAdd={() => openModal()}
      onEdit={openModal}
      onDelete={deleteProduct}
    >
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Editar Producto" : "Nuevo Producto"}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                  Bien (con inventario)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="radio"
                    checked={form.type === 'servicio'}
                    onChange={() => setForm({ ...form, type: 'servicio', stock: '0', barcode: '' })}
                  />
                  Servicio (sin inventario)
                </label>
              </div>
            </div>
          )}

          <div className={`grid ${effectiveType === 'servicio' ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Costo</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.cost}
                onChange={handleCostChange}
                className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                placeholder="Costo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Precio (30%)</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
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

          <div className={`grid ${effectiveType === 'servicio' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">SKU</label>
              <input
                type="text"
                required
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                placeholder="Código único"
              />
            </div>
            {effectiveType === 'bien' && (
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Código de Barras</label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={e => setForm({ ...form, barcode: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                  placeholder="Opcional"
                />
              </div>
            )}
          </div>

          {/* Categoría, Marca y Presentación en una sola fila compacta */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Categoría</label>
              <div className="flex gap-1">
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="flex-1 min-w-0 p-2 border border-gray-300 rounded text-gray-900 bg-white text-sm"
                >
                  <option value="">Seleccionar</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                <select
                  value={form.brand_id}
                  onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                  className="flex-1 min-w-0 p-2 border border-gray-300 rounded text-gray-900 bg-white text-sm"
                >
                  <option value="">Seleccionar</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setOpenAttributeModal('brand')}
                  title="Nueva marca"
                  className="flex-shrink-0 w-9 h-9 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Presentación</label>
              <div className="flex gap-1">
                <select
                  value={form.presentation_id}
                  onChange={(e) => setForm({ ...form, presentation_id: e.target.value })}
                  className="flex-1 min-w-0 p-2 border border-gray-300 rounded text-gray-900 bg-white text-sm"
                >
                  <option value="">Seleccionar</option>
                  {presentations.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
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

          {/* Imágenes */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Imágenes (1 portada + 4 adicionales)</label>
            <div className="grid grid-cols-5 gap-2">
              {/* Cuadro 1: Portada */}
              <div
                className="relative w-full pt-[100%] border-2 border-dashed rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 transition"
                style={{
                  borderColor: previewUrls[0] ? '#3B82F6' : '#CBD5E1'
                }}
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
                    style={{
                      borderColor: previewUrls[i] ? '#10B981' : '#CBD5E1'
                    }}
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

            {/* Input oculto para portada */}
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
              onClick={() => {
                setIsModalOpen(false);
                setSelectedFiles([null, null, null, null, null]);
                setPreviewUrls([null, null, null, null, null]);
              }}
              className="flex-1 bg-gray-500 text-white py-2 rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded"
            >
              {editing ? 'Actualizar' : 'Guardar'}
            </button>
          </div>

        </form>
      </Modal>

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
    </DataTable>
  );
}