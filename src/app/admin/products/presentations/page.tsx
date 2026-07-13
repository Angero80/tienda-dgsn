'use client';

import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import Modal from '../../../../components/Modal';
import { supabase } from '../../../../lib/supabaseClient';
import { findDuplicate } from '../../../../lib/textNormalize';

type Presentation = {
  id: number;
  name: string;
};

export default function PresentationsPage() {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [form, setForm] = useState({ name: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Presentation | null>(null);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<Presentation[]>([]);

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    const { data, error } = await supabase.from('presentations').select('*');
    if (error) {
      console.error('Error cargando presentaciones:', error);
    } else {
      setPresentations(data || []);
    }
  };

  const openModal = (item: Presentation | null = null) => {
    setEditing(item);
    const name = item ? item.name : '';
    setForm({ name });
    setSearch(name);
    setFiltered(presentations);
    setIsModalOpen(true);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    setForm({ name: value });

    if (value.trim() === '') {
      setFiltered(presentations);
    } else {
      setFiltered(
        presentations.filter(p =>
          p.name.toLowerCase().includes(value.toLowerCase())
        )
      );
    }
  };

  const selectOption = (presentation: Presentation) => {
    setSearch(presentation.name);
    setForm({ name: presentation.name });
    setFiltered(presentations);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) {
      alert('El nombre es obligatorio');
      return;
    }

    // ✅ Validar duplicados
    const existing = findDuplicate(presentations, name, editing?.id ?? null);

    if (existing && !editing) {
      const confirm = window.confirm(
        `Ya existe una presentación con este nombre: "${existing.name}". ¿Quieres usarla?`
      );
      if (confirm) {
        setForm({ name: existing.name });
        setSearch(existing.name);
      }
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase
          .from('presentations')
          .update({ name })
          .eq('id', editing.id);

        if (error) throw error;

        setPresentations(prev =>
          prev.map(p => (p.id === editing.id ? { ...p, name } : p))
        );
      } else {
        const { data, error } = await supabase
          .from('presentations')
          .insert([{ name }])
          .select();

        if (error) throw error;

        if (data && data.length > 0) {
          setPresentations(prev => [...prev, data[0]]);
        }
      }

      setIsModalOpen(false);
      setEditing(null);
      setForm({ name: '' });
      setSearch('');
    } catch (err: any) {
      console.error('Error al guardar presentación:', err);
      alert('Error: ' + err.message);
    }
  };

  const deletePresentation = async (id: number) => {
    if (!confirm('¿Eliminar esta presentación?')) return;
    const { error } = await supabase.from('presentations').delete().eq('id', id);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setPresentations(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <DataTable
      title="Presentaciones"
      columns={[{ key: 'name', label: 'Nombre' }]}
      data={presentations}
      formFields={[{ name: 'name', label: 'Nombre' }]}
      onAdd={() => openModal()}
      onEdit={openModal}
      onDelete={deletePresentation}
    >
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Editar Presentación" : "Nueva Presentación"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Nombre</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                onFocus={() => setFiltered(presentations)}
                className="w-full p-2 bg-white border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                placeholder="Buscar o escribir nueva presentación..."
                autoComplete="off"
              />
              {search && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-auto">
                  {filtered.length === 0 ? (
                    <li className="p-2 text-gray-500 text-sm">No se encontraron resultados</li>
                  ) : (
                    filtered.map((presentation) => (
                      <li
                        key={presentation.id}
                        onClick={() => selectOption(presentation)}
                        className="p-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-800"
                      >
                        {presentation.name}
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