// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Sale = {
  id: number;
  sale_date: string;
  type: string;
  total: number;
  invoice_number: number | null;
  receipt_number: number | null;
};

type Product = {
  id: number;
  name: string;
  stock: number;
  price: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProducts: 0,
    lowStockCount: 0,
    totalRevenue: 0,
  });

  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      // Cada consulta se maneja de forma independiente: si una falla,
      // las demás igual actualizan su parte del dashboard en vez de
      // dejar todo en cero (ese era el bug original).

      // Productos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock, price');

      if (productsError) {
        console.error('Error cargando productos:', productsError.message);
      } else if (productsData) {
        const lowStock = productsData.filter((p) => p.stock < 10);
        setStats((prev) => ({
          ...prev,
          totalProducts: productsData.length,
          lowStockCount: lowStock.length,
        }));
      }

      // Últimos productos agregados
      const { data: recentProductsData, error: recentProductsError } = await supabase
        .from('products')
        .select('id, name, stock, price')
        .order('id', { ascending: false })
        .limit(5);

      if (recentProductsError) {
        console.error('Error cargando productos recientes:', recentProductsError.message);
      } else {
        setRecentProducts(recentProductsData || []);
      }

      // Ventas (facturas/recibos reales)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, sale_date, type, total, invoice_number, receipt_number')
        .order('sale_date', { ascending: false });

      if (salesError) {
        console.error('Error cargando ventas:', salesError.message);
        setLoadError(salesError.message);
      } else if (salesData) {
        const totalRevenue = salesData.reduce((sum, s) => sum + (s.total || 0), 0);
        setStats((prev) => ({
          ...prev,
          totalSales: salesData.length,
          totalRevenue,
        }));
        setRecentSales(salesData.slice(0, 5));
      }

      setLoading(false);
    };

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Cargando dashboard...</h1>
      </div>
    );
  }

  return (
    <div className="p-6 text-gray-900">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {loadError && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded mb-4">
          No se pudieron cargar las ventas: {loadError}
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold text-gray-700">Facturas/Recibos</h2>
          <p className="text-2xl font-bold text-blue-600 mt-2">{stats.totalSales}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold text-gray-700">Ingresos Totales</h2>
          <p className="text-2xl font-bold text-green-600 mt-2">${stats.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold text-gray-700">Productos</h2>
          <p className="text-2xl font-bold text-purple-600 mt-2">{stats.totalProducts}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold text-gray-700">Bajo Stock</h2>
          <p className="text-2xl font-bold text-red-600 mt-2">{stats.lowStockCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Últimos Productos */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Productos Recientes</h2>
          {recentProducts.length === 0 ? (
            <p className="text-gray-500">No hay productos registrados.</p>
          ) : (
            <ul className="space-y-3">
              {recentProducts.map((product) => (
                <li key={product.id} className="border-b pb-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-sm text-gray-600">Stock: {product.stock}</span>
                  </div>
                  <p className="text-sm text-gray-500">Precio: ${product.price.toFixed(2)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Últimas Ventas */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Últimas Facturas/Recibos</h2>
          {recentSales.length === 0 ? (
            <p className="text-gray-500">No hay facturas o recibos registrados.</p>
          ) : (
            <ul className="space-y-3">
              {recentSales.map((sale) => (
                <li key={sale.id} className="border-b pb-2">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {sale.type === 'invoice'
                        ? `Factura #${sale.invoice_number ?? sale.id}`
                        : `Recibo #${sale.receipt_number ?? sale.id}`}
                    </span>
                    <span className="text-sm text-gray-600">
                      {new Date(sale.sale_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{sale.type}</span>
                    <span className="font-semibold">${(sale.total || 0).toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}