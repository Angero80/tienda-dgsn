'use client';

import { useState } from 'react';
import Link from 'next/link';

// Datos de ejemplo (luego vienen de Supabase)
const products = [
  {
    id: 1,
    name: 'Laptop Premium',
    sku: 'LP001',
    barcode: '8473625190128',
    price: 1299.99,
  },
  {
    id: 2,
    name: 'Mochila Antirrobo',
    sku: 'MB002',
    barcode: '8473625190129',
    price: 89.99,
  },
  {
    id: 3,
    name: 'Mouse Inalámbrico',
    sku: 'MS003',
    barcode: '8473625190130',
    price: 25.00,
  },
];

export default function POSPage() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [cart, setCart] = useState<Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
  }>>([]);
  const [customerName, setCustomerName] = useState('John Doe');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filtrar productos para autocompletado
  const filteredProducts = searchInput
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchInput.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchInput.toLowerCase()) ||
          p.barcode.includes(searchInput)
      )
    : [];

  const addToCartByCode = () => {
    if (!barcodeInput.trim()) return;

    const product = products.find(
      (p) => p.barcode === barcodeInput || p.sku === barcodeInput
    );

    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      alert('❌ Producto no encontrado');
    }
  };

  const addToCartByName = (product: typeof products[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearchInput('');
    setShowSuggestions(false);
  };

  const addToCart = (product: typeof products[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }
    alert(
      `✅ Recibo generado\nCliente: ${customerName}\nTotal: $${total.toFixed(
        2
      )}\nImpresión simulada...`
    );
    setCart([]);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Punto de Venta (POS)</h1>
        <Link href="/admin" className="text-gray-700 hover:text-gray-900">
          ← Volver al Panel
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado izquierdo: Escáner y Búsqueda */}
        <div className="bg-white p-6 rounded-lg shadow col-span-1 space-y-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Agregar Productos</h2>

          {/* Por código de barras o SKU */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Código de Barras o SKU
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addToCartByCode()}
                placeholder="Ej: 8473625190128 o LP001"
                className="flex-1 p-3 border border-gray-300 rounded text-gray-900 bg-white placeholder-gray-500"
              />
              <button
                onClick={addToCartByCode}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded font-medium"
              >
                ➕
              </button>
            </div>
          </div>

          {/* Por nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Buscar por Nombre o Código
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => searchInput && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Buscar producto..."
              className="w-full p-3 border border-gray-300 rounded text-gray-900 bg-white placeholder-gray-500"
            />

            {/* Sugerencias */}
            {showSuggestions && filteredProducts.length > 0 && (
              <ul className="absolute bg-white border border-gray-300 rounded mt-1 w-80 max-h-60 overflow-y-auto z-10 shadow-lg">
                {filteredProducts.map((product) => (
                  <li
                    key={product.id}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between text-sm"
                    onClick={() => addToCartByName(product)}
                  >
                    <span className="text-gray-800">{product.name}</span>
                    <span className="text-gray-700">${product.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-700">
              🔍 Usa el código o escribe el nombre para buscar.
            </p>
          </div>
        </div>

        {/* Centro: Carrito */}
        <div className="bg-white p-6 rounded-lg shadow col-span-1">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Carrito de Compra</h2>

          {cart.length === 0 ? (
            <p className="text-gray-700 text-center py-8">Carrito vacío</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-sm text-gray-700">
                      ${item.price.toFixed(2)} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-800"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-medium text-gray-800">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-800"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t mt-4 pt-4 font-bold text-lg text-gray-800">
            Total: ${total.toFixed(2)}
          </div>
        </div>

        {/* Derecho: Acciones */}
        <div className="bg-white p-6 rounded-lg shadow col-span-1">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Cliente</h2>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nombre del cliente"
            className="w-full p-3 border border-gray-300 rounded text-gray-900 mb-6 placeholder-gray-500"
          />

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold text-lg"
          >
            💳 Emitir Recibo
          </button>

          <div className="mt-6 p-4 bg-gray-50 rounded text-sm text-gray-700">
            <p><strong>Atajo:</strong> Enter → Agregar por código</p>
            <p><strong>Cliente por defecto:</strong> John Doe</p>
          </div>
        </div>
      </div>
    </div>
  );
}