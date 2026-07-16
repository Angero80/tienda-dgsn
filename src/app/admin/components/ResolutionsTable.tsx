'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DataTable from './DataTable';
import { useAlertDialog } from './AlertDialogProvider';

interface ResolutionsTableProps {
  filterType: 'dian' | 'equivalent' | 'credit_note';
}

type Resolution = {
  id: number;
  number: string;
  prefix: string | null;
  approval_date: string | null;
  from_date: string | null;
  to_date: string | null;
  start_consecutive: number | null;
  end_consecutive: number | null;
  current_consecutive: number | null;
  footer_note: string | null;
  type: 'invoice' | 'receipt' | 'credit_note';
  created_at: string;
};

const formatDate = (isoDate: string | null) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
};

export default function ResolutionsTable({ filterType }: ResolutionsTableProps) {
  const dialog = useAlertDialog();
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Resolution | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [form, setForm] = useState({
    number: '',
    prefix: '',
    approval_date: '',
    from_date: '',
    to_date: '',
    start_consecutive: '',
    end_consecutive: '',
    footer_note: '',
  });

  const dbType: 'invoice' | 'receipt' | 'credit_note' =
    filterType === 'dian' ? 'invoice' : filterType === 'equivalent' ? 'receipt' : 'credit_note';

  useEffect(() => {
    const loadResolutions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('resolutions')
        .select('*')
        .eq('type', dbType);

      if (error) {
        await dialog.alert('Error al cargar los datos: ' + error.message, { variant: 'danger', title: 'Error' });
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
        prefix: resolution.prefix || '',
        approval_date: resolution.approval_date?.split('T')[0] || '',
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
        prefix: '',
        approval_date: '',
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

  // Ya se emitió al menos un documento con esta resolución (el consecutivo
  // avanzó más allá del inicio) — a partir de ahí, los datos que definen la
  // numeración ya no se pueden tocar sin romper la trazabilidad legal.
  const isInUse =
    !!editing &&
    editing.current_consecutive != null &&
    editing.start_consecutive != null &&
    editing.current_consecutive > editing.start_consecutive;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isInUse) {
      // No hay nada editable que guardar — este caso no debería poder
      // llegar aquí porque el botón de guardar ni siquiera se muestra,
      // pero se deja como salvaguarda.
      closeModal();
      return;
    }

    // ✅ Solo se envían columnas que realmente existen en la tabla
    // `resolutions`. Antes se enviaban nombres de campo del frontend
    // (resolution_number, consecutive_from, start_date...) que no
    // coincidían con las columnas reales y hacían fallar el guardado.
    const payload = {
      number: form.number,
      prefix: form.prefix.trim().toUpperCase() || null,
      approval_date: form.approval_date || null,
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
        await dialog.alert('Error al actualizar: ' + error.message, { variant: 'danger', title: 'Error' });
        return;
      }
      setResolutions(resolutions.map((r) => (r.id === editing.id ? { ...r, ...payload } : r)));
    } else {
      const { data, error } = await supabase.from('resolutions').insert([payload]).select();

      if (error) {
        await dialog.alert('Error al agregar: ' + error.message, { variant: 'danger', title: 'Error' });
        return;
      }
      setResolutions([...resolutions, data[0]]);
    }
    closeModal();
  };

  const deleteResolution = async (id: number) => {
    const confirmed = await dialog.confirm('¿Estás seguro de eliminar esta resolución?', {
      variant: 'warning',
      confirmText: 'Sí, eliminar',
    });
    if (!confirmed) return;
    const { error } = await supabase.from('resolutions').delete().eq('id', id);
    if (error) {
      await dialog.alert('Error: ' + error.message, { variant: 'danger', title: 'Error' });
    } else {
      setResolutions(resolutions.filter((r) => r.id !== id));
    }
  };

  if (loading) return <p className="p-6 text-black">Cargando resoluciones...</p>;

  return (
    <>
      <DataTable
        title={
          filterType === 'dian'
            ? 'Resoluciones DIAN'
            : filterType === 'equivalent'
            ? 'Documentos Equivalentes'
            : 'Resoluciones de Notas Crédito'
        }
        data={filtered}
        columns={[
          { key: 'number', label: 'No. Resolución' },
          { key: 'prefix', label: 'Prefijo', render: (item: Resolution) => item.prefix || '—' },
          {
            key: 'approval_date',
            label: 'Fecha Aprobación',
            render: (item: Resolution) => formatDate(item.approval_date),
          },
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
          {
            key: 'status',
            label: 'Estado',
            render: (item: Resolution) => {
              const inUse =
                item.current_consecutive != null &&
                item.start_consecutive != null &&
                item.current_consecutive > item.start_consecutive;
              return inUse ? (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  En uso
                </span>
              ) : (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  Sin usar
                </span>
              );
            },
            exportValue: (item: Resolution) =>
              item.current_consecutive != null &&
              item.start_consecutive != null &&
              item.current_consecutive > item.start_consecutive
                ? 'En uso'
                : 'Sin usar',
          },
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
              {isInUse && (
                <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded p-3 mb-4">
                  ⚠️ Esta resolución ya tiene documentos emitidos (consecutivo actual:{' '}
                  {editing?.current_consecutive}). Ningún dato se puede modificar, incluida la nota
                  final, para no romper la numeración legal.
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Número de Resolución
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isInUse}
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-black disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Prefijo (hasta 4 caracteres)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    disabled={isInUse}
                    value={form.prefix}
                    onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                    placeholder="Ej: FE, SETP"
                    className="w-full p-2 border border-gray-300 rounded text-black uppercase disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Autorizado por la DIAN junto con el rango de numeración (hasta 4 caracteres
                    alfanuméricos). Se antepone al consecutivo: ej. {form.prefix || 'FE'}00000001.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Fecha de Aprobación (de la resolución)
                  </label>
                  <input
                    type="date"
                    disabled={isInUse}
                    value={form.approval_date}
                    onChange={(e) => setForm({ ...form, approval_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-black disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fecha en que la DIAN expidió la resolución — distinta de la vigencia (abajo).
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Consecutivo Desde
                    </label>
                    <input
                      type="text"
                      disabled={isInUse}
                      value={form.start_consecutive}
                      onChange={(e) => setForm({ ...form, start_consecutive: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded text-black disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Consecutivo Hasta
                    </label>
                    <input
                      type="text"
                      disabled={isInUse}
                      value={form.end_consecutive}
                      onChange={(e) => setForm({ ...form, end_consecutive: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded text-black disabled:bg-gray-100 disabled:text-gray-500"
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
                      disabled={isInUse}
                      value={form.from_date}
                      onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded text-black disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Fecha de Fin
                    </label>
                    <input
                      type="date"
                      disabled={isInUse}
                      value={form.to_date}
                      onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded text-black disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Nota Final (opcional)
                  </label>
                  <textarea
                    disabled={isInUse}
                    value={form.footer_note}
                    onChange={(e) => setForm({ ...form, footer_note: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-black disabled:bg-gray-100 disabled:text-gray-500"
                    rows={2}
                  />
                </div>
                <div className="flex space-x-2 pt-4">
                  {isInUse ? (
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 bg-gray-500 text-white py-2 rounded"
                    >
                      Cerrar
                    </button>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </DataTable>
    </>
  );
}