'use client';

import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import Modal from '../../../../components/Modal';
import { supabase } from '../../../../lib/supabaseClient';
import { useAlertDialog } from '../../components/AlertDialogProvider';
import { formatCurrency } from '../../../../lib/formatCurrency';

type Tax = {
  id: number;
  name: string;
  rate: number;
  tax_type: 'IVA' | 'INC' | 'ICA' | 'Otro';
  dian_code: string | null;
  is_active: boolean;
};

const emptyForm = {
  id: null as number | null,
  name: '',
  rate: '',
  tax_type: 'IVA' as Tax['tax_type'],
  dian_code: '',
  is_active: true,
};

// Códigos de "Tipo de Impuesto" del Anexo Técnico de Factura Electrónica DIAN.
// Se sugieren automáticamente al elegir el tipo, pero quedan editables por si
// la DIAN cambia el catálogo o hace falta un código distinto.
const SUGGESTED_DIAN_CODE: Record<Tax['tax_type'], string> = {
  IVA: '01',
  INC: '02',
  ICA: '03',
  Otro: '',
};

export default function TaxesPage() {
  const dialog = useAlertDialog();
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTaxes();
  }, []);

  const loadTaxes = async () => {
    const { data, error } = await supabase.from('taxes').select('*').order('name');
    if (error) {
      console.error('Error cargando impuestos:', error.message);
    } else {
      setTaxes(data || []);
    }
  };

  const openAddModal = () => {
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (tax: Tax) => {
    setForm({
      id: tax.id,
      name: tax.name,
      rate: String(tax.rate),
      tax_type: tax.tax_type,
      dian_code: tax.dian_code || '',
      is_active: tax.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const rate = parseFloat(form.rate);

    if (!name) {
      await dialog.alert('El nombre es obligatorio.', { variant: 'warning', title: 'Falta un dato' });
      return;
    }
    if (isNaN(rate) || rate < 0) {
      await dialog.alert('La tarifa debe ser un número mayor o igual a 0.', {
        variant: 'warning',
        title: 'Falta un dato',
      });
      return;
    }

    setSaving(true);
    const payload = {
      name,
      rate,
      tax_type: form.tax_type,
      dian_code: form.dian_code.trim() || null,
      is_active: form.is_active,
    };

    const { error } = form.id
      ? await supabase.from('taxes').update(payload).eq('id', form.id)
      : await supabase.from('taxes').insert([payload]);

    setSaving(false);

    if (error) {
      await dialog.alert('Error: ' + error.message, { variant: 'danger', title: 'Error' });
      return;
    }

    setIsModalOpen(false);
    loadTaxes();
  };

  const handleDelete = async (id: number) => {
    const confirmed = await dialog.confirm(
      '¿Eliminar este impuesto? Si algún producto ya lo tiene asignado, revisa esas asignaciones después de borrarlo.',
      { variant: 'warning', confirmText: 'Sí, eliminar' }
    );
    if (!confirmed) return;

    const { error } = await supabase.from('taxes').delete().eq('id', id);
    if (error) {
      await dialog.alert('Error: ' + error.message, { variant: 'danger', title: 'Error' });
    } else {
      loadTaxes();
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-1">¿Para qué es esta pantalla?</p>
        <p>
          Aquí defines los impuestos que se aplican a tus productos (IVA, INC, ICA, u otros). Las
          tarifas las fija la ley y pueden cambiar con cada reforma tributaria — cuando eso pase,
          actualiza el porcentaje aquí en vez de en el código. El código DIAN queda listo para
          cuando conectemos la facturación electrónica real con un Proveedor Tecnológico.
        </p>
      </div>

      <DataTable
        title="Impuestos"
        data={taxes}
        formFields={[]}
        onAdd={openAddModal}
        onEdit={openEditModal}
        onDelete={handleDelete}
        columns={[
          { key: 'name', label: 'Nombre' },
          {
            key: 'tax_type',
            label: 'Tipo',
            render: (item: Tax) => (
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                {item.tax_type}
              </span>
            ),
          },
          {
            key: 'rate',
            label: 'Tarifa',
            render: (item: Tax) => `${formatCurrency(Number(item.rate))}%`,
            exportValue: (item: Tax) => `${formatCurrency(Number(item.rate))}%`,
          },
          {
            key: 'dian_code',
            label: 'Código DIAN',
            render: (item: Tax) => item.dian_code || '—',
          },
          {
            key: 'is_active',
            label: 'Activo',
            render: (item: Tax) =>
              item.is_active ? (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  Activo
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  Inactivo
                </span>
              ),
            exportValue: (item: Tax) => (item.is_active ? 'Activo' : 'Inactivo'),
          },
        ]}
      >
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={form.id ? 'Editar Impuesto' : 'Nuevo Impuesto'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: IVA 19%, IVA reducido, Exento"
                className="w-full p-2 border border-gray-300 rounded text-gray-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Tipo</label>
                <select
                  value={form.tax_type}
                  onChange={(e) => {
                    const newType = e.target.value as Tax['tax_type'];
                    setForm({
                      ...form,
                      tax_type: newType,
                      // Solo autocompleta el código si el campo está vacío o
                      // todavía tiene la sugerencia del tipo anterior.
                      dian_code:
                        !form.dian_code || form.dian_code === SUGGESTED_DIAN_CODE[form.tax_type]
                          ? SUGGESTED_DIAN_CODE[newType]
                          : form.dian_code,
                    });
                  }}
                  className="w-full p-2 border border-gray-300 rounded text-gray-900"
                >
                  <option value="IVA">IVA</option>
                  <option value="INC">INC (Consumo)</option>
                  <option value="ICA">ICA</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Tarifa (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  placeholder="Ej: 19"
                  className="w-full p-2 border border-gray-300 rounded text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Código DIAN (opcional por ahora)
              </label>
              <input
                type="text"
                value={form.dian_code}
                onChange={(e) => setForm({ ...form, dian_code: e.target.value })}
                placeholder="Ej: 01"
                className="w-full p-2 border border-gray-300 rounded text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se sugiere automático según el tipo. Solo se usará cuando conectemos el envío
                real a la DIAN — hoy no afecta nada más.
              </p>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span className="text-sm text-gray-800">Activo (disponible para asignar a productos)</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-50"
              >
                {saving ? 'Guardando...' : form.id ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      </DataTable>
    </div>
  );
}