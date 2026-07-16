'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { applyMaxOpacity, PASTEL_BANNER_TEXT_COLOR } from '../lib/colorUtils';
import { useAlertDialog } from './admin/components/AlertDialogProvider';
import { formatCurrency } from '../lib/formatCurrency';

type Product = {
  id: number;
  name: string;
  description: string;
  long_description: string | null;
  price: number;
  cost: number;
  image_url: string;
  images: string[] | null;
  sku: string;
  barcode: string;
  stock: number;
};

type CartItem = {
  id: number;
  product_id: number;
  quantity: number;
  created_at: string;
  session_id: string;
};

type Banner = {
  id: number;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  custom_image_url: string | null;
  discount_text_top: string | null;
  discount_text_bottom: string | null;
  background_color: string;
  text_color: string;
  image_position: 'left' | 'right';
  is_full_banner: boolean;
  product_id: number | null;
  order_index: number;
  active: boolean;
  created_at: string;
};

export default function Home() {
  const dialog = useAlertDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [session_id] = useState(() => {
    if (typeof window === 'undefined') {
      // Renderizado en servidor: valor temporal, se reemplaza en el cliente
      return Math.random().toString(36).substring(2, 15);
    }
    const existing = window.localStorage.getItem('dgsn_session_id');
    if (existing) return existing;
    const fresh = Math.random().toString(36).substring(2, 15);
    window.localStorage.setItem('dgsn_session_id', fresh);
    return fresh;
  });
  const [activeImage, setActiveImage] = useState<string>('');
  const [bannerIndex, setBannerIndex] = useState(0);

  // Cargar productos, carrito y banners
  useEffect(() => {
    const loadData = async () => {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*');

      if (productsError) {
        console.error('Error al cargar productos:', productsError);
      } else {
        const formattedProducts = productsData?.map((p: Product) => ({
          ...p,
          images: Array.isArray(p.images) ? p.images : [],
          long_description: p.long_description || '',
        })) || [];
        setProducts(formattedProducts);
      }

      const { data: cartData, error: cartError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('session_id', session_id);

      if (cartError) {
        console.error('Error al cargar carrito:', cartError);
      } else {
        setCart(cartData || []);
      }

      const { data: bannersData, error: bannersError } = await supabase
        .from('banners')
        .select('*')
        .eq('active', true)
        .order('order_index');

      if (bannersError) {
        console.error('Error al cargar banners:', bannersError);
      } else {
        setBanners(bannersData || []);
      }

      setLoading(false);
    };

    loadData();
  }, [session_id]);

  // Auto-rotación del banner
  useEffect(() => {
    if (banners.length === 0) return;
    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners]);

  // Añadir al carrito desde lista
  const addToCart = async (product: Product) => {
    const input = document.getElementById(`qty-${product.id}`) as HTMLInputElement;
    const qty = parseInt(input.value) || 1;

    const { data, error } = await supabase
      .from('cart_items')
      .insert([{ product_id: product.id, quantity: qty, session_id }])
      .select();

    if (error) {
      console.error('Error al añadir al carrito:', error);
    } else {
      setCart([...cart, data[0]]);
      input.value = '1';
    }
  };

  // Añadir desde modal
  const addToCartFromModal = async () => {
    if (!selectedProduct) return;

    const { data, error } = await supabase
      .from('cart_items')
      .insert([{ product_id: selectedProduct.id, quantity, session_id }])
      .select();

    if (error) {
      console.error('Error al añadir al carrito:', error);
    } else {
      setCart([...cart, data[0]]);
      await dialog.alert('Producto añadido al carrito', { variant: 'success', title: 'Listo' });
      closeProductModal();
    }
  };

  // Quitar del carrito
  const removeFromCart = async (id: number) => {
    await supabase.from('cart_items').delete().eq('id', id);
    setCart(cart.filter(item => item.id !== id));
  };

  // Vaciar carrito
  const clearCart = async () => {
    const confirmed = await dialog.confirm('¿Estás seguro de vaciar el carrito?', {
      variant: 'warning',
      confirmText: 'Sí, vaciar',
    });
    if (confirmed) {
      await supabase.from('cart_items').delete().eq('session_id', session_id);
      setCart([]);
      setIsCartOpen(false);
    }
  };

  // Calcular total
  const total = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.product_id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  // Abrir modal del producto
  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setActiveImage(product.image_url || 'https://placehold.co/300x200/e2e8f0/64748b?text=No+Image');
    setQuantity(1);
  };

  // Cerrar modal
  const closeProductModal = () => {
    setSelectedProduct(null);
    setQuantity(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-600">Cargando productos y banners...</p>
      </div>
    );
  }

  // Filtrar productos por búsqueda
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🛒</span>
            <h1 className="text-2xl font-bold text-gray-800">DGSN</h1>
            <span className="text-sm text-gray-500">digitalicesunegocio.com</span>
          </div>
          <button
            onClick={() => setIsCartOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Carrito ({cart.length})
          </button>
        </div>
      </header>

      {/* ✅ Contenedor superior con más espacio (10% extra de padding-top) */}
      <div className="pt-6 sm:pt-7 md:pt-8 max-w-6xl mx-auto px-4"> {/* Aumentado ~10% */}

        {/* ✅ BANNER ROTATIVO - Clickeable con apertura de modal */}
        <section
          className="relative w-full overflow-hidden rounded-lg shadow-lg"
          style={{
            aspectRatio: '5 / 1',
            backgroundColor: banners[bannerIndex]?.background_color
              ? (banners[bannerIndex].is_full_banner
                ? banners[bannerIndex].background_color
                : applyMaxOpacity(banners[bannerIndex].background_color))
              : '#fff',
            cursor: banners[bannerIndex]?.product_id ? 'pointer' : 'default',
          }}
          onClick={() => {
            if (banners[bannerIndex]?.product_id) {
              const product = products.find(p => p.id === banners[bannerIndex].product_id);
              if (product) openProductModal(product);
            }
          }}
        >
          {banners.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500">No hay banners disponibles</p>
            </div>
          ) : (
            banners.map((banner, index) => {
              const bannerImage = banner.custom_image_url || banner.image_url;
              const imageFirst = (banner.image_position || 'left') !== 'right';

              if (banner.is_full_banner) {
                return (
                  <div
                    key={banner.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ${index === bannerIndex ? 'opacity-100' : 'opacity-0'
                      }`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: banner.background_color || '#fff',
                    }}
                  >
                    {bannerImage && (
                      <img
                        src={bannerImage}
                        alt={banner.title}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    )}
                  </div>
                );
              }

              const imageBlock = bannerImage && (
                <div
                  key="image"
                  style={{
                    maxWidth: '320px',
                    flex: '1 1 0',
                    height: '85%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                  }}
                >
                  <img
                    src={bannerImage}
                    alt={banner.title}
                    style={{
                      maxHeight: '90%',
                      maxWidth: '100%',
                      objectFit: 'contain',
                    }}
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                </div>
              );

              const textBlock = (
                <div
                  key="text"
                  style={{
                    maxWidth: bannerImage ? '480px' : '100%',
                    flex: bannerImage ? '1 1 0' : 'initial',
                    color: PASTEL_BANNER_TEXT_COLOR,
                    textAlign: imageFirst ? 'left' : 'right',
                    lineHeight: '1.2',
                  }}
                >
                  {banner.discount_text_top && (
                    <p style={{ fontSize: 'clamp(14px, 4vw, 28px)', fontWeight: 800, marginBottom: '4px' }}>
                      {banner.discount_text_top}
                    </p>
                  )}
                  <p style={{ fontSize: 'clamp(16px, 5vw, 32px)', fontWeight: 'bold' }}>
                    {banner.title}
                  </p>
                  {banner.subtitle && (
                    <p style={{ fontSize: 'clamp(12px, 3vw, 20px)', fontWeight: 'normal', marginTop: '4px' }}>
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.discount_text_bottom && (
                    <p style={{ fontSize: 'clamp(11px, 2.5vw, 16px)', fontWeight: 600, marginTop: '8px' }}>
                      {banner.discount_text_bottom}
                    </p>
                  )}
                </div>
              );

              return (
                <div
                  key={banner.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${index === bannerIndex ? 'opacity-100' : 'opacity-0'
                    }`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'clamp(12px, 4vw, 40px)',
                    padding: '0 clamp(16px, 5vw, 60px)',
                    backgroundColor: banner.background_color
                      ? applyMaxOpacity(banner.background_color)
                      : '#fff',
                  }}
                >
                  {imageFirst ? (
                    <>
                      {imageBlock}
                      {textBlock}
                    </>
                  ) : (
                    <>
                      {textBlock}
                      {imageBlock}
                    </>
                  )}
                </div>
              );
            })
          )}

          {/* Puntos de indicación */}
          {banners.length > 0 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBannerIndex(index);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${index === bannerIndex ? 'bg-gray-800' : 'bg-gray-500'
                    }`}
                ></button>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Buscador */}
      <section className="bg-blue-700 py-6 shadow-inner">
        <div className="max-w-3xl mx-auto px-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-4 pl-12 border bg-white border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg placeholder:text-gray-700 text-gray-700"
            />
            <svg
              className="w-6 h-6 text-gray-600 absolute left-4 top-1/2 transform -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </section>

      {/* Productos */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Productos Disponibles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.length === 0 ? (
              <p className="col-span-full text-center text-gray-500 text-lg">No se encontraron productos.</p>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => openProductModal(product)}
                  className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition transform hover:-translate-y-1 flex flex-col cursor-pointer"
                >
                  {/* Imagen principal */}
                  <div className="w-full h-48 bg-white flex items-center justify-center overflow-hidden">
                    <img
                      src={product.image_url || 'https://placehold.co/300x200/e2e8f0/64748b?text=No+Image'}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain p-2"
                    />
                  </div>
                  <div className="p-6 flex-1">
                    <h3 className="text-xl font-semibold text-gray-800">{product.name}</h3>
                    <p className="text-gray-600 mt-1">{product.description}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">${formatCurrency(product.price)}</p>
                  </div>

                  {/* Cantidad y botón Añadir */}
                  <div className="p-6 pt-0 flex items-center justify-end space-x-2">
                    <div className="flex items-center space-x-2">
                      <label htmlFor={`qty-${product.id}`} className="text-sm font-medium text-gray-700">Cantidad:</label>
                      <input
                        type="number"
                        id={`qty-${product.id}`}
                        defaultValue="1"
                        min="1"
                        className="w-16 p-2 border border-gray-300 rounded text-center text-gray-900 text-sm"
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-6xl mx-auto text-center">
          <p>© 2025 DGSN – digitalicesunegocio.com</p>
        </div>
      </footer>

      {/* Modal del Carrito */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-white sm:bg-black sm:bg-opacity-50 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="bg-white h-full sm:h-auto sm:rounded-xl sm:max-w-md w-full sm:max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Encabezado fijo arriba */}
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex justify-between items-center z-10">
              <h3 className="text-xl font-bold text-blue-700">Carrito de compras</h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="p-5 flex-1">
              {cart.length > 0 && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={clearCart}
                    className="px-3 py-1 text-red-600 hover:text-red-800 text-sm font-medium border border-gray-300 bg-white rounded hover:bg-gray-50 transition"
                    title="Vaciar todo el carrito"
                  >
                    Vaciar todo
                  </button>
                </div>
              )}

              {cart.length === 0 ? (
                <p className="text-gray-700">Tu carrito está vacío.</p>
              ) : (
                <ul className="space-y-3">
                  {cart.map((item) => {
                    const product = products.find(p => p.id === item.product_id);
                    if (!product) return null;

                    return (
                      <li key={item.id} className="border rounded-xl p-3 flex gap-3">
                        {/* Miniatura */}
                        <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-50 overflow-hidden flex items-center justify-center">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-2xl text-gray-300">📦</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-gray-900 leading-tight">{product.name}</span>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="flex-shrink-0 text-gray-400 hover:text-red-600 transition"
                              title="Quitar del carrito"
                              aria-label="Quitar del carrito"
                            >
                              🗑️
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center border border-gray-300 rounded-full overflow-hidden">
                              <button
                                onClick={async () => {
                                  if (item.quantity > 1) {
                                    await supabase
                                      .from('cart_items')
                                      .update({ quantity: item.quantity - 1 })
                                      .eq('id', item.id);
                                    setCart(cart.map(c =>
                                      c.id === item.id ? { ...c, quantity: c.quantity - 1 } : c
                                    ));
                                  } else {
                                    await removeFromCart(item.id);
                                  }
                                }}
                                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                              >
                                ‹
                              </button>
                              <span className="w-7 text-center text-gray-900 font-medium text-sm">
                                {item.quantity}
                              </span>
                              <button
                                onClick={async () => {
                                  await supabase
                                    .from('cart_items')
                                    .update({ quantity: item.quantity + 1 })
                                    .eq('id', item.id);
                                  setCart(cart.map(c =>
                                    c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
                                  ));
                                }}
                                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                              >
                                ›
                              </button>
                            </div>
                            <span className="font-bold text-gray-900">
                              ${formatCurrency((product.price * item.quantity))}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Total + acciones, fijo abajo */}
            <div className="sticky bottom-0 bg-white border-t px-5 py-4 space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-lg font-bold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-blue-700">${formatCurrency(total)}</span>
              </div>

              <button
                disabled={cart.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3.5 rounded-lg font-bold tracking-wide uppercase transition-colors duration-200"
              >
                Iniciar Compra
              </button>

              <button
                onClick={() => setIsCartOpen(false)}
                className="w-full text-center text-gray-600 hover:text-gray-900 text-sm underline"
              >
                Ver más productos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal del Producto */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-screen overflow-hidden flex flex-col relative">
            {/* Botón de cerrar */}
            <button
              onClick={closeProductModal}
              className="absolute top-2 right-2 z-10 bg-gray-500 hover:bg-gray-600 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center text-lg transition"
            >
              ✕
            </button>

            {/* Galería de imágenes */}
            <div className="w-full bg-white">
              {/* Imagen principal */}
              <div className="w-full h-64 flex items-center justify-center overflow-hidden">
                <img
                  src={activeImage || selectedProduct.image_url || 'https://placehold.co/300x200/e2e8f0/64748b?text=No+Image'}
                  alt={selectedProduct.name}
                  className="max-h-full max-w-full object-contain p-2"
                />
              </div>

              {/* Flechas de navegación y puntos */}
              <div className="flex justify-between items-center px-4 py-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const allImages = [selectedProduct.image_url, ...(selectedProduct.images || [])].filter(Boolean) as string[];
                    const currentIndex = allImages.indexOf(activeImage);
                    const prevIndex = (currentIndex - 1 + allImages.length) % allImages.length;
                    setActiveImage(allImages[prevIndex]);
                  }}
                  className="w-8 h-8 bg-gray-300 bg-opacity-50 hover:bg-opacity-70 text-gray-800 text-lg font-bold rounded-full flex items-center justify-center transition"
                >
                  ‹
                </button>

                <div className="flex space-x-1">
                  {([selectedProduct.image_url, ...(selectedProduct.images || [])] as string[]).map((_, index) => {
                    const allImages = [selectedProduct.image_url, ...(selectedProduct.images || [])].filter(Boolean) as string[];
                    return (
                      <div
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full ${allImages[index] === activeImage ? 'bg-gray-800' : 'bg-gray-400'
                          }`}
                      ></div>
                    );
                  })}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const allImages = [selectedProduct.image_url, ...(selectedProduct.images || [])].filter(Boolean) as string[];
                    const currentIndex = allImages.indexOf(activeImage);
                    const nextIndex = (currentIndex + 1) % allImages.length;
                    setActiveImage(allImages[nextIndex]);
                  }}
                  className="w-8 h-8 bg-gray-300 bg-opacity-50 hover:bg-opacity-70 text-gray-800 text-lg font-bold rounded-full flex items-center justify-center transition"
                >
                  ›
                </button>
              </div>
            </div>

            {/* Contenido inferior */}
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{selectedProduct.name}</h3>
              <p className="text-3xl font-bold text-blue-600 mb-4">${formatCurrency(selectedProduct.price)}</p>

              <div className="mb-4 flex-1 overflow-y-auto pr-2">
                <h4 className="font-semibold text-gray-800 mb-2">Características:</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  {selectedProduct.long_description
                    ? selectedProduct.long_description
                      .split('\n')
                      .filter(line => line.trim() !== '')
                      .map((line, i) => (
                        <li key={i} className="whitespace-pre-line">{line.trim()}</li>
                      ))
                    : <li>Sin descripción disponible</li>
                  }
                </ul>
              </div>

              <div className="flex items-center justify-end space-x-2">
                <div className="flex items-center space-x-2">
                  <label htmlFor="quantity" className="text-sm font-medium text-gray-700">Cantidad:</label>
                  <input
                    type="number"
                    id="quantity"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-16 p-2 border border-gray-300 rounded text-center text-gray-900 text-sm"
                  />
                </div>
                <button
                  onClick={addToCartFromModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium"
                >
                  Añadir al carrito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}