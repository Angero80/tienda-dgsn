'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DataTable from '../components/DataTable';
import { supabase } from '../../../lib/supabaseClient';
import { useAlertDialog } from '../components/AlertDialogProvider';
import { formatCurrency } from '../../../lib/formatCurrency';

type Category = { id: number; name: string };

type Product = {
  id: number;
  name: string;
  description: string;
  cost: number;
  price: number;
  sku: string;
  barcode: string;
  stock: number;
  category_id: number | null;
  image_url: string | null;
};

export default function ProductsPage() {
  const dialog = useAlertDialog();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, cost, price, sku, barcode, stock, category_id, image_url');

    if (error) {
      console.error('Error cargando productos:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase.from('categories').select('id, name');
    if (error) console.error('Error cargando categorías:', error);
    setCategories(data || []);
  };

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

  const getCategoryName = (categoryId: number | null) => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : 'Sin categoría';
  };

  if (loading) {
    return <div className="p-6">Cargando productos...</div>;
  }

  return (
    <DataTable
      title="Productos"
      data={products}
      formFields={[]}
      onAdd={() => router.push('/admin/products/new')}
      onEdit={(item: Product) => router.push(`/admin/products/${item.id}/edit`)}
      onDelete={deleteProduct}
      columns={[
        { key: 'name', label: 'Nombre' },
        { key: 'sku', label: 'SKU' },
        { key: 'barcode', label: 'Código de Barras' },
        {
          key: 'cost',
          label: 'Costo',
          render: (item: Product) => `$${formatCurrency(item.cost)}`,
          exportValue: (item: Product) => `$${formatCurrency(item.cost)}`,
        },
        {
          key: 'price',
          label: 'Precio',
          render: (item: Product) => `$${formatCurrency(item.price)}`,
          exportValue: (item: Product) => `$${formatCurrency(item.price)}`,
        },
        { key: 'stock', label: 'Stock' },
        {
          key: 'category',
          label: 'Categoría',
          render: (item: Product) => getCategoryName(item.category_id),
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
    >
      {null}
    </DataTable>
  );
}