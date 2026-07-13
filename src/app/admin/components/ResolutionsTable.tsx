'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DataTable from './DataTable';

interface ResolutionsTableProps {
  filterType: 'dian' | 'equivalent';
}

type Resolution = {
  id: number;
  number: string;
  from_date: string | null;
  to_date: string | null;
  start_consecutive: number | null;
  end_consecutive: number | null;
  footer_note: string | null;
  type: 'invoice' | 'receipt';
  created_at: string;
};

const formatDate = (isoDate: string | null) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
};

export default function ResolutionsTable({ filterType }: ResolutionsTableProps) {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Resolution | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [form, setForm] = useState({
    number: '',
    from_date: '',
    to_date: '',
    start_consecutive: '',
    end_consecutive: '',
    footer_note: '',
  });

  const dbType: 'invoice' | 'receipt' = filterType === 'dian' ? 'invoice' : 'receipt';

  useEffect(() => {
    const loadResolutions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('resolutions')
        .select('*')
        .eq('type', dbType);

      if (error) {
        alert('Error al cargar los datos: ' + error.message);
      } else {
        setResolutions(data || []);
      }
      setLoading(false);
    };
    loadResolutions();
  }, [dbType]);

  const filtered = resolutions.filter((r) => {
    if (!dateFrom && !dateTo) return true;
    const createdAt = new Date(r.created_at);
    const start = dateFrom ? new Date(dateFrom) : null;
    const end = dateTo ? new Date(dateTo) : null;
    return (!start || createdAt >= start) && (!end || createdAt <= end);
  });

  const openModal = (resolution?: Resolution) => {
    if (resolution) {
      setEditing(resolution);
      setForm({
        number: resolution.number || '',
        from_date: resolution.from_date?.split('T')[0] || '',
        to_date: resolution.to_date?.split('T')[0] || '',
        start_consecutive: resolution.start_consecutive != null ? String(resolution.start_consecutive) : '',
        end_consecutive: resolution.end_consecutive != null ? String(resolution.end_consecutive) : '',
        footer_note: resolution.footer_note || '',
      });
    } else {
      setEditing(null);
      setForm({
        number: '',
        from_date: '',
        to_date: '',
        start_consecutive: '',
        end_consecutive: '',
        footer_note: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Solo se envían columnas que realmente existen en la tabla
    // `resolutions`. Antes se enviaban nombres de campo del frontend
    // (resolution_number, consecutive_from, start_date...) que no
    // coincidían con las columnas reales y hacían fallar el guardado.
    const payload = {
      number: form.number,
      from_date: form.from_date || null,
      to_date: form.to_date || null,
      start_consecutive: form.start_consecutive ? Number(form.start_consecutive) : null,
      end_consecutive: form.end_consecutive ? Number(form.end_consecutive) : null,
      footer_note: form.footer_note || null,
      type: dbType,
    };

    if (editing) {
      const { error } = await supabase
        .from('resolutions')
        .update(payload)
        .eq('id', editing.id);

      if (error) {
        alert('Error al actualizar: ' + error.message);
        return;
      }
      setResolutions(resolutions.map((r) => (r.id === editing.id ? { ...r, ...payload } : r)));
    } else {
      const { data, error } = await supabase.from('resolutions').insert([payload]).select();

      if (error) {
        alert('Error al agregar: ' + error.message);
        return;
      }
      setResolutions([...resolutions, data[0]]);
    }
    closeModal();
  };

  const deleteResolution = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta resolución?')) return;
    const { error } = await supabase.from('resolutions').delete().eq('id', id);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setResolutions(resolutions.filter((r) => r.id !== id));
    }
  };

  if (loading) return <p className="p-6 text-black">Cargando resoluciones...</p>;

  return (
    <>
      <DataTable
        title={filterType === 'dian' ? 'Resoluciones DIAN' : 'Documentos Equivalentes'}
        data={filtered}
        columns={[
          { key: 'number', label: 'No. Resolución' },
          {
            key: 'from_date',
            label: 'Fecha Inicio',
            render: (item: Resolution) => formatDate(item.from_date),
          },
          {
            key: 'to_date',
            label: 'Fecha Fin',
            render: (item: Resolution) => formatDate(item.to_date),
          },
          { key: 'start_consecutive', label: 'Consecutivo Desde' },
          { key: 'end_consecutive', label: 'Consecutivo Hasta' },
        ]}
        formFields={[]}
        onAdd={() => openModal()}
        onEdit={(item: Resolution) => openModal(item)}
        onDelete={deleteResolution}
        extraFilters={[
          {
            label: 'Fecha inicial',
            control: (
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="p-2 border border-gray-300 rounded text-black text-sm h-9"
              />
            ),
          },
          {
            label: 'Fecha final',
            control: (
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="p-2 border border-gray-300 rounded text-black text-sm h-9"
              />
            ),
          },
        ]}
      >
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md text-gray-900 max-h-[90vh] overflow-y-auto">
              <h2 className="font-semibold mb-4">
                {editing ? 'Editar Resolución' : 'Nueva Resolución'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Número de Resolución
                  </label>
                  <input
                    type="text"
                    required
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Consecutivo Desde
                    </label>
                    <input
                      type="text"
                      value={form.start_consecutive}
                      onChange={(e) => setForm({ ...form, start_consecutive: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Consecutivo Hasta
                    </label>
                    <input
                      type="text"
                      value={form.end_consecutive}
                      onChange={(e) => setForm({ ...form, end_consecutive: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Fecha de Inicio
                    </label>
                    <input
                      type="date"
                      value={form.from_date}
                      onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Fecha de Fin
                    </label>
                    <input
                      type="date"
                      value={form.to_date}
                      onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded text-black"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Nota Final (opcional)
                  </label>
                  <textarea
                    value={form.footer_note}
                    onChange={(e) => setForm({ ...form, footer_note: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    rows={2}
                  />
                </div>
                <div className="flex space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 bg-gray-500 text-white py-2 rounded"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded">
                    {editing ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DataTable>
    </>
  );
}
