'use client';

import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import Modal from '../../../../components/Modal';
import { supabase } from '../../../../lib/supabaseClient';
import { findDuplicate } from '../../../../lib/textNormalize';
import { useAlertDialog } from '../../components/AlertDialogProvider';

type Category = {
    id: number;
    name: string;
};

export default function CategoriesPage() {
    const dialog = useAlertDialog();
    const [categories, setCategories] = useState<Category[]>([]);
    const [form, setForm] = useState({ name: '' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const [search, setSearch] = useState('');
    const [filtered, setFiltered] = useState<Category[]>([]);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        const { data, error } = await supabase.from('categories').select('*');
        if (error) {
            console.error('Error cargando categorías:', error);
        } else {
            setCategories(data || []);
        }
    };

    const openModal = (item: Category | null = null) => {
        setEditing(item);
        const name = item ? item.name : '';
        setForm({ name });
        setSearch(name);
        setFiltered(categories);
        setIsModalOpen(true);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);
        setForm({ name: value });

        if (value.trim() === '') {
            setFiltered(categories);
        } else {
            setFiltered(
                categories.filter(c =>
                    c.name.toLowerCase().includes(value.toLowerCase())
                )
            );
        }
    };

    const selectOption = (category: Category) => {
        setSearch(category.name);
        setForm({ name: category.name });
        setFiltered(categories);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const name = form.name.trim();
        if (!name) {
            await dialog.alert('El nombre es obligatorio', { variant: 'warning', title: 'Falta un dato' });
            return;
        }

        // Verificar duplicados (ignorando mayúsculas, tildes y espacios extra)
        const existing = findDuplicate(categories, name, editing?.id ?? null);

        if (existing && !editing) {
            const useExisting = await dialog.confirm(
                `Ya existe una categoría con este nombre: "${existing.name}". ¿Quieres usarla?`,
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
                    .from('categories')
                    .update({ name })
                    .eq('id', editing.id);

                if (error) throw error;

                setCategories(prev =>
                    prev.map(c => (c.id === editing.id ? { ...c, name } : c))
                );
            } else {
                const { data, error } = await supabase
                    .from('categories')
                    .insert([{ name }])
                    .select();

                if (error) throw error;

                if (data && data.length > 0) {
                    setCategories(prev => [...prev, data[0]]);
                }
            }

            setIsModalOpen(false);
            setEditing(null);
            setForm({ name: '' });
            setSearch('');
        } catch (err: any) {
            console.error('Error al guardar categoría:', err);
            await dialog.alert('Error: ' + err.message, { variant: 'danger', title: 'Error' });
        }
    };

    const deleteCategory = async (id: number) => {
        const confirmed = await dialog.confirm('¿Eliminar esta categoría?', {
            variant: 'warning',
            confirmText: 'Sí, eliminar',
        });
        if (!confirmed) return;
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) {
            await dialog.alert('Error: ' + error.message, { variant: 'danger', title: 'Error' });
        } else {
            setCategories(prev => prev.filter(c => c.id !== id));
        }
    };

    return (
        <DataTable
            title="Categorías"
            columns={[{ key: 'name', label: 'Nombre' }]}
            data={categories}
            formFields={[{ name: 'name', label: 'Nombre' }]}
            onAdd={() => openModal()}
            onEdit={openModal}
            onDelete={deleteCategory}
        >
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Editar Categoría" : "Nueva Categoría"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Nombre</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={search}
                                onChange={handleSearch}
                                onFocus={() => setFiltered(categories)}
                                className="w-full p-2 bg-white border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                placeholder="Buscar o escribir nueva categoría..."
                                autoComplete="off"
                            />
                            {search && (
                                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-auto">
                                    {filtered.length === 0 ? (
                                        <li className="p-2 text-gray-500 text-sm">No se encontraron resultados</li>
                                    ) : (
                                        filtered.map((cat) => (
                                            <li
                                                key={cat.id}
                                                onClick={() => selectOption(cat)}
                                                className="p-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-800"
                                            >
                                                {cat.name}
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