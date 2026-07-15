'use client';

import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import Modal from '../../../../components/Modal';
import { supabase } from '../../../../lib/supabaseClient';
import { findDuplicate } from '../../../../lib/textNormalize';
import { useAlertDialog } from '../../components/AlertDialogProvider';

type Brand = {
  id: number;
  name: string;
};

export default function BrandsPage() {
  const dialog = useAlertDialog();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState({ name: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<Brand[]>([]);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    const { data, error } = await supabase.from('brands').select('*');
    if (error) {
      console.error('Error cargando marcas:', error);
    } else {
      setBrands(data || []);
    }
  };

  const openModal = (item: Brand | null = null) => {
    setEditing(item);
    const name = item ? item.name : '';
    setForm({ name });
    setSearch(name);
    setFiltered(brands);
    setIsModalOpen(true);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    setForm({ name: value });

    if (value.trim() === '') {
      setFiltered(brands);
    } else {
      setFiltered(
        brands.filter(b =>
          b.name.toLowerCase().includes(value.toLowerCase())
        )
      );
    }
  };

  const selectOption = (brand: Brand) => {
    setSearch(brand.name);
    setForm({ name: brand.name });
    setFiltered(brands);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) {
      await dialog.alert('El nombre es obligatorio', { variant: 'warning', title: 'Falta un dato' });
      return;
    }

    // ✅ Validar duplicados
    const existing = findDuplicate(brands, name, editing?.id ?? null);

    if (existing && !editing) {
      const useExisting = await dialog.confirm(
        `Ya existe una marca con este nombre: "${existing.name}". ¿Quieres usarla?`,
        { variant: 'info', confirmText: 'Usar existente' }
      );
      if (useExisting) {
        setForm({ name: existing.name });
        setSearch(existing.name);
      }
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase
          .from('brands')
          .update({ name })
          .eq('id', editing.id);

        if (error) throw error;

        setBrands(prev =>
          prev.map(b => (b.id === editing.id ? { ...b, name } : b))
        );
      } else {
        const { data, error } = await supabase
          .from('brands')
          .insert([{ name }])
          .select();

        if (error) throw error;

        if (data && data.length > 0) {
          setBrands(prev => [...prev, data[0]]);
        }
      }

      setIsModalOpen(false);
      setEditing(null);
      setForm({ name: '' });
      setSearch('');
    } catch (err: any) {
      console.error('Error al guardar marca:', err);
      await dialog.alert('Error: ' + err.message, { variant: 'danger', title: 'Error' });
    }
  };

  const deleteBrand = async (id: number) => {
    const confirmed = await dialog.confirm('¿Eliminar esta marca?', {
      variant: 'warning',
      confirmText: 'Sí, eliminar',
    });
    if (!confirmed) return;
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) {
      await dialog.alert('Error: ' + error.message, { variant: 'danger', title: 'Error' });
    } else {
      setBrands(prev => prev.filter(b => b.id !== id));
    }
  };

  return (
    <DataTable
      title="Marcas"
      columns={[{ key: 'name', label: 'Nombre' }]}
      data={brands}
      formFields={[{ name: 'name', label: 'Nombre' }]}
      onAdd={() => openModal()}
      onEdit={openModal}
      onDelete={deleteBrand}
    >
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Editar Marca" : "Nueva Marca"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Nombre</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                onFocus={() => setFiltered(brands)}
                className="w-full p-2 bg-white border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                placeholder="Buscar o escribir nueva marca..."
                autoComplete="off"
              />
              {search && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-auto">
                  {filtered.length === 0 ? (
                    <li className="p-2 text-gray-500 text-sm">No se encontraron resultados</li>
                  ) : (
                    filtered.map((brand) => (
                      <li
                        key={brand.id}
                        onClick={() => selectOption(brand)}
                        className="p-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-800"
                      >
                        {brand.name}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
          <div className="flex space-x-2 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
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
    </DataTable>
  );
}