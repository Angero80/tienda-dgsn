'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Truck,
  Receipt,
  Settings,
  ChartBar,
  ChevronDown,
  ChevronRight,
  Store,
  Tag,
  Badge,
  Box,
  Menu,
  X,
  Gem,
  CreditCard,
  PlusCircle,
  DollarSign,
  FileChartLine,
  Building2,
  FileCheck2,
  FileText,
  UserCog,
  ShieldCheck,
  Calendar,
  Package2,
  User,
  BarChart3,
  FileSearch,
  TrendingUp,
  Database,
  Ruler
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);

  // ✅ Sector del negocio (Configuración → General): controla si el
  // módulo de Compras/Inventario aparece en el menú. Un negocio 100%
  // de Servicios normalmente no necesita comprar/almacenar inventario.
  const [businessSector, setBusinessSector] = useState<string>('comercial');

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

  const showCompras = businessSector !== 'servicios';

  const toggleMenu = (menu: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }));
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) {
      setOpenMenus({});
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-gray-800 text-white shadow-lg transition-all duration-300 flex-shrink-0 flex flex-col
        ${isCollapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {!isCollapsed ? (
            <>
              <div>
                <h1 className="text-xl font-bold">Admin</h1>
                <p className="text-xs text-gray-300">Panel</p>
              </div>
              <button
                onClick={toggleSidebar}
                className="text-gray-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              className="text-gray-300 hover:text-white w-full"
              title="Mostrar menú"
            >
              <Menu className="w-6 h-6 mx-auto" />
            </button>
          )}
        </div>

        {/* Menú desplazable */}
        <nav className="flex-1 overflow-y-auto py-2">
          {/* Inicio */}
          {!isCollapsed && (
            <div className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Inicio
            </div>
          )}
          <Link
            href="/admin"
            className={`flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
            ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            {!isCollapsed && <span className="ml-3">Panel</span>}
          </Link>

          {/* Módulos */}
          {!isCollapsed && (
            <div className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6">
              Módulos
            </div>
          )}

          {/* Compras — oculto si el negocio es 100% Servicios */}
          {showCompras && (
          <div>
            <button
              onClick={() => !isCollapsed && toggleMenu('compras')}
              className={`flex items-center justify-between w-full px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
    ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
            >
              <div className="flex items-center">
                <ShoppingCart className="w-5 h-5" />
                {!isCollapsed && <span className="ml-3">Compras</span>}
              </div>
              {!isCollapsed && (
                openMenus['compras'] ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )
              )}
            </button>
            {!isCollapsed && openMenus['compras'] && (
              <div className="bg-gray-700 ml-4 mt-1 rounded">
                <Link
                  href="/admin/purchases"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <ShoppingCart className="w-4 h-4 mr-3 text-blue-400" />
                  Listado
                </Link>
                <Link
                  href="/admin/purchases/new"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <PlusCircle className="w-4 h-4 mr-3 text-green-400" />
                  Registrar
                </Link>
              </div>
            )}
          </div>
          )}

          {/* Ventas (POS) */}
          <div>
            <button
              onClick={() => !isCollapsed && toggleMenu('ventas')}
              className={`flex items-center justify-between w-full px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
              ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
            >
              <div className="flex items-center">
                <Store className="w-5 h-5" />
                {!isCollapsed && <span className="ml-3">Ventas</span>}
              </div>
              {!isCollapsed && (
                openMenus['ventas'] ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )
              )}
            </button>
            {!isCollapsed && openMenus['ventas'] && (
              <div className="bg-gray-700 ml-4 mt-1 rounded">
                <Link
                  href="/admin/pos"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Store className="w-4 h-4 mr-3 text-blue-400" />
                  Inicio
                </Link>
                <Link
                  href="/admin/pos/close"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <DollarSign className="w-4 h-4 mr-3 text-orange-400" />
                  Cerrar Caja
                </Link>
                <Link
                  href="/admin/pos/report"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <FileChartLine className="w-4 h-4 mr-3 text-purple-400" />
                  Informe de Turno
                </Link>
              </div>
            )}
          </div>

          {/* Productos */}
          <div>
            <button
              onClick={() => !isCollapsed && toggleMenu('productos')}
              className={`flex items-center justify-between w-full px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
              ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
            >
              <div className="flex items-center">
                <Package className="w-5 h-5" />
                {!isCollapsed && <span className="ml-3">Productos</span>}
              </div>
              {!isCollapsed && (
                openMenus['productos'] ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )
              )}
            </button>
            {!isCollapsed && openMenus['productos'] && (
              <div className="bg-gray-700 ml-4 mt-1 rounded">
                <Link
                  href="/admin/products/categories"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Tag className="w-4 h-4 mr-3 text-yellow-400" />
                  Categorías
                </Link>
                <Link
                  href="/admin/products/brands"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Badge className="w-4 h-4 mr-3 text-green-400" />
                  Marcas
                </Link>
                <Link
                  href="/admin/products/presentations"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Box className="w-4 h-4 mr-3 text-cyan-400" />
                  Presentaciones
                </Link>
                <Link
                  href="/admin/products"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Package className="w-4 h-4 mr-3 text-purple-400" />
                  Productos
                </Link>
                <Link
                  href="/admin/banners"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Gem className="w-4 h-4 mr-3 text-orange-600" />
                  Banners
                </Link>
              </div>
            )}
          </div>

          {/* Clientes */}
          <Link
            href="/admin/customers"
            className={`flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
            ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
          >
            <Users className="w-5 h-5" />
            {!isCollapsed && <span className="ml-3">Clientes</span>}
          </Link>

          {/* Proveedores */}
          <Link
            href="/admin/suppliers"
            className={`flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
            ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
          >
            <Truck className="w-5 h-5" />
            {!isCollapsed && <span className="ml-3">Proveedores</span>}
          </Link>

          {/* Facturación */}
          <Link
            href="/admin/invoices"
            className={`flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
            ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
          >
            <Receipt className="w-5 h-5" />
            {!isCollapsed && <span className="ml-3">Facturación</span>}
          </Link>

          {/* Notas Crédito */}
          <Link
            href="/admin/credit-notes"
            className={`flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
            ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
          >
            <FileText className="w-5 h-5" />
            {!isCollapsed && <span className="ml-3">Notas Crédito</span>}
          </Link>

{/* Configuración */}
<div>
  <button
    onClick={() => !isCollapsed && toggleMenu('config')}
    className={`flex items-center justify-between w-full px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
    ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
    title="Configuración del sistema"
  >
    <div className="flex items-center">
      <ShieldCheck className="w-5 h-5" /> {/* 👈 Cambiado a ShieldCheck */}
      {!isCollapsed && <span className="ml-3">Configuración</span>}
    </div>
    {!isCollapsed && (
      openMenus['config'] ? (
        <ChevronDown className="w-4 h-4" />
      ) : (
        <ChevronRight className="w-4 h-4" />
      )
    )}
  </button>
  {!isCollapsed && openMenus['config'] && (
    <div className="bg-gray-700 ml-4 mt-1 rounded">
      <Link
        href="/admin/config/business"
        className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
      >
        <Building2 className="w-4 h-4 mr-3 text-blue-400" />
        Empresa
      </Link>
      <Link
        href="/admin/config/resolutions"
        className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
      >
        <FileCheck2 className="w-4 h-4 mr-3 text-green-400" />
        Resoluciones
      </Link>
      <Link
        href="/admin/config/credit-notes-resolutions"
        className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
      >
        <FileCheck2 className="w-4 h-4 mr-3 text-orange-400" />
        Resoluciones N. Crédito
      </Link>
      <Link
        href="/admin/config/taxes"
        className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
      >
        <DollarSign className="w-4 h-4 mr-3 text-emerald-400" />
        Impuestos
      </Link>
      <Link
        href="/admin/config/equivalents"
        className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
      >
        <FileText className="w-4 h-4 mr-3 text-yellow-400" />
        Doc. Equivalentes
      </Link>
      <Link
        href="/admin/config/dian-units"
        className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
      >
        <Ruler className="w-4 h-4 mr-3 text-cyan-400" />
        Unidades Medida
      </Link>
      <Link
        href="/admin/users"
        className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
      >
        <UserCog className="w-4 h-4 mr-3 text-purple-400" />
        Usuarios
      </Link>
      <Link
        href="/admin/config/roles"
        className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
      >
        <ShieldCheck className="w-4 h-4 mr-3 text-red-400" />
        Roles
      </Link>
      <Link
        href="/admin/payments"
        className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
      >
        <CreditCard className="w-4 h-4 mr-3 text-green-400" />
        Pasarelas de Pago
      </Link>
    </div>
  )}
</div>

          {/* Informes */}
          <div>
            <button
              onClick={() => !isCollapsed && toggleMenu('informes')}
              className={`flex items-center justify-between w-full px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition
              ${isCollapsed ? 'justify-center h-12' : 'justify-start'}`}
            >
              <div className="flex items-center">
                <ChartBar className="w-5 h-5" />
                {!isCollapsed && <span className="ml-3">Informes</span>}
              </div>
              {!isCollapsed && (
                openMenus['informes'] ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )
              )}
            </button>
            {!isCollapsed && openMenus['informes'] && (
              <div className="bg-gray-700 ml-4 mt-1 rounded">
                <Link
                  href="/admin/reports/sales-by-date"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Calendar className="w-4 h-4 mr-3 text-blue-400" />
                  Resumen Ventas x Fechas
                </Link>
                <Link
                  href="/admin/reports/sales-by-product"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Package2 className="w-4 h-4 mr-3 text-green-400" />
                  Detalle Ventas x Producto
                </Link>
                <Link
                  href="/admin/reports/sales-by-customer"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <User className="w-4 h-4 mr-3 text-purple-400" />
                  Resumen Ventas x Cliente
                </Link>
                <Link
                  href="/admin/reports/purchases-by-date"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Calendar className="w-4 h-4 mr-3 text-yellow-400" />
                  Resumen Compras x Fechas
                </Link>
                <Link
                  href="/admin/reports/purchases-by-product"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Package2 className="w-4 h-4 mr-3 text-red-400" />
                  Detalle Compras x Producto
                </Link>
                <Link
                  href="/admin/reports/purchases-by-supplier"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Truck className="w-4 h-4 mr-3 text-orange-400" />
                  Resumen Compras x Proveedor
                </Link>
                <Link
                  href="/admin/reports/inventory-summary"
                  className="flex items-center px-6 py-2 text-gray-300 hover:bg-gray-600 text-sm"
                >
                  <Database className="w-4 h-4 mr-3 text-teal-400" />
                  Resumen Entradas - Salidas - Stock
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="bg-gray-900 text-center py-4 border-t border-gray-700 mt-auto">
          {!isCollapsed ? (
            <>
              <p className="text-xs text-gray-400">Bienvenido:</p>
              <p className="text-sm font-medium text-white">Administrador</p>
            </>
          ) : (
            <p className="text-xs text-gray-400">Admin</p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-100">
        {children}
      </main>
    </div>
  );
}