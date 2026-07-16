'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { useAlertDialog } from '../components/AlertDialogProvider';
import { formatCurrency } from '../../../lib/formatCurrency';

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category_id: number | null;
  category_name: string | null;
};

type CartItem = {
  id: number;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
};

export default function POSPage() {
  const dialog = useAlertDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [salesCountByProduct, setSalesCountByProduct] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [justAddedId, setJustAddedId] = useState<number | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Consumidor Final');
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [{ data: productsData, error: productsError }, { data: salesData, error: salesError }] =
        await Promise.all([
          supabase
            .from('products')
            .select('id, name, sku, barcode, price, stock, image_url, category_id, categories(name)'),
          supabase.from('sales').select('items'),
        ]);

      if (productsError) console.error('Error cargando productos:', productsError.message);
      if (salesError) console.error('Error cargando historial de ventas:', salesError.message);

      const normalized: Product[] = (productsData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: Number(p.price),
        stock: p.stock,
        image_url: p.image_url,
        category_id: p.category_id,
        category_name: p.categories?.name || null,
      }));
      setProducts(normalized);

      // Cuántas unidades se han vendido de cada producto en total, para
      // poder mostrar primero "lo más comprado". Mientras no haya ventas
      // reales registradas, todos quedan en 0 y el orden cae al alfabético.
      const counts: Record<number, number> = {};
      (salesData || []).forEach((sale: any) => {
        (sale.items || []).forEach((item: any) => {
          if (!item?.product_id) return;
          counts[item.product_id] = (counts[item.product_id] || 0) + (item.quantity || 0);
        });
      });
      setSalesCountByProduct(counts);

      setLoading(false);
    };

    loadData();
  }, []);

  const categories = useMemo(() => {
    const map = new Map<number, string>();
    products.forEach((p) => {
      if (p.category_id && p.category_name) map.set(p.category_id, p.category_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => selectedCategory === 'all' || p.category_id === selectedCategory)
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          (p.barcode || '').includes(term)
      )
      .sort((a, b) => {
        const diff = (salesCountByProduct[b.id] || 0) - (salesCountByProduct[a.id] || 0);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });
  }, [products, search, selectedCategory, salesCountByProduct]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, image_url: product.image_url, quantity: 1 }];
    });
    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId((current) => (current === product.id ? null : current)), 400);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleScan = async (code: string) => {
    setScannerOpen(false);
    const match = products.find((p) => p.barcode === code || p.sku === code);
    if (match) {
      addToCart(match);
    } else {
      await dialog.alert('No se encontró ningún producto con ese código.', {
        variant: 'warning',
        title: 'Sin resultados',
      });
    }
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // NOTA: el guardado real de la venta (tabla `sales`) queda para cuando
  // conectemos Facturación — por ahora esto sigue siendo una simulación,
  // tal como se acordó para esta ronda enfocada en lo visual.
  const handleCheckout = async () => {
    if (cart.length === 0) {
      await dialog.alert('El carrito está vacío', { variant: 'warning', title: 'Falta un dato' });
      return;
    }
    setCheckingOut(true);
    await dialog.alert(
      `Recibo generado\nCliente: ${customerName}\nTotal: $${formatCurrency(total)}\nImpresión simulada...`,
      { variant: 'success', title: 'Venta registrada' }
    );
    setCart([]);
    setCheckingOut(false);
  };

  if (loading) {
    return <div className="p-6">Cargando punto de venta...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Punto de Venta (POS)</h1>
        <Link
          href="/admin"
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium px-4 py-2 rounded text-sm"
        >
          ← Volver al Panel
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Columna principal: búsqueda + catálogo */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                id="pos-search-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, SKU o código..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400"
              />
            </div>
            <button
              onClick={() => setScannerOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap"
            >
              📷 Escanear código
            </button>
          </div>

          {categories.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Todas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {visibleProducts.length === 0 ? (
            <div className="bg-white p-10 rounded-lg shadow text-center text-gray-500">
              No se encontraron productos.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleProducts.map((product) => {
                const outOfStock = product.stock <= 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                    className={`bg-white rounded-lg shadow text-left overflow-hidden border-2 transition-all ${
                      justAddedId === product.id ? 'border-green-500 scale-[0.98]' : 'border-transparent'
                    } ${outOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:-translate-y-0.5'}`}
                  >
                    <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-contain p-7"
                        />
                      ) : (
                        <span className="text-4xl text-gray-300">📦</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-800 leading-tight line-clamp-2">
                        {product.name}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-blue-700 font-bold">${formatCurrency(product.price)}</span>
                        <span className={`text-xs ${outOfStock ? 'text-red-500' : 'text-gray-400'}`}>
                          {outOfStock ? 'Sin stock' : `Stock: ${product.stock}`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel derecho: resumen de la venta */}
        <div className="bg-white rounded-xl shadow p-6 lg:sticky lg:top-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Resumen de venta</h2>
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="px-3 py-1 text-red-600 hover:text-red-800 disabled:text-gray-300 disabled:cursor-not-allowed text-sm font-medium border border-gray-300 bg-white rounded hover:bg-gray-50 transition"
              title="Vaciar todo el carrito"
            >
              Vaciar todo
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-gray-900 text-sm"
            />
          </div>

          {cart.length === 0 ? (
            <p className="text-gray-700">Tu carrito está vacío.</p>
          ) : (
            <ul className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {cart.map((item) => (
                <li key={item.id} className="flex flex-col border-b pb-3">
                  {/* Producto */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-sm text-gray-300">📦</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900 text-sm block truncate">{item.name}</span>
                        <p className="text-xs text-gray-500">${formatCurrency(item.price)} c/u</p>
                      </div>
                    </div>
                    {/* Botón eliminar individual */}
                    <div className="relative ml-2 group flex-shrink-0">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white text-xs flex items-center justify-center rounded-full transition"
                      >
                        ✕
                      </button>
                      <span className="absolute hidden group-hover:flex -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        Quitar
                      </span>
                    </div>
                  </div>

                  {/* Cantidad */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-gray-900 font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-semibold text-sm text-gray-900">
                      ${formatCurrency((item.price * item.quantity))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Total */}
          <div className="border-t pt-4 font-bold text-gray-900">
            Total: ${formatCurrency(total)}
          </div>

          {/* Botones */}
          <div className="flex space-x-2">
            <button
              onClick={() => {
                document.getElementById('pos-search-input')?.focus();
              }}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-medium transition-colors duration-200"
            >
              Seguir vendiendo
            </button>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkingOut}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-medium transition-colors duration-200"
            >
              💳 Emitir Recibo
            </button>
          </div>
        </div>
      </div>

      <BarcodeScannerModal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}