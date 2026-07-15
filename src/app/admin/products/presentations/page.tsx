'use client';

import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import Modal from '../../../../components/Modal';
import PresentationSearch, { Presentation } from '../../components/PresentationSearch';
import { supabase } from '../../../../lib/supabaseClient';
import { fetchAllDianUnits } from '../../../../lib/dianUnitsCatalog';
import { useAlertDialog } from '../../components/AlertDialogProvider';

export default function PresentationsPage() {
  const dialog = useAlertDialog();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    loadPresentations();
  }, []);

  // Presentaciones no es dueña de su propia lista: es un espejo de lo que
  // está activo en dian_units_catalog (más las "Personalizada" legacy, si
  // quedara alguna). Cada vez que se entra a esta pantalla, se reconcilia:
  //  - unidades activas sin fila en `presentations` todavía -> se crean
  //  - filas de `presentations` vinculadas a una unidad que ya NO está
  //    activa (ej. alguien la desactivó directo en Unidades Medida) -> se
  //    eliminan, para que esta lista nunca muestre algo inactivo.
  const loadPresentations = async () => {
    setLoading(true);
    try {
      const [allUnits, { data: existing, error: existingError }] = await Promise.all([
        fetchAllDianUnits(),
        supabase.from('presentations').select('id, name, dian_unit_id'),
      ]);

      if (existingError) throw existingError;

      const activeUnitIds = new Set(allUnits.filter((u) => u.active).map((u) => u.id));
      let current = (existing || []) as Presentation[];

      // 1) Limpiar filas huérfanas: vinculadas a una unidad que ya no está activa.
      const orphaned = current.filter((p) => p.dian_unit_id && !activeUnitIds.has(p.dian_unit_id));
      if (orphaned.length > 0) {
        await supabase
          .from('presentations')
          .delete()
          .in('id', orphaned.map((p) => p.id));
        current = current.filter((p) => !orphaned.includes(p));
      }

      // 2) Crear las que faltan: unidades activas sin presentación vinculada aún.
      const linkedUnitIds = new Set(current.filter((p) => p.dian_unit_id).map((p) => p.dian_unit_id));
      const missingUnits = allUnits.filter((u) => u.active && !linkedUnitIds.has(u.id));

      if (missingUnits.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('presentations')
          .insert(missingUnits.map((u) => ({ name: u.name, dian_unit_id: u.id })))
          .select('id, name, dian_unit_id');

        if (insertError) throw insertError;
        current = [...current, ...((inserted || []) as Presentation[])];
      }

      setPresentations(current);
    } catch (err: any) {
      console.error('Error sincronizando presentaciones:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => setIsModalOpen(true);

  const handleSelectFromSearch = () => {
    loadPresentations();
    setIsModalOpen(false);
  };

  // Única acción disponible en la lista: "Quitar de esta lista".
  // - Si está vinculada a una unidad DIAN: se elimina de Presentaciones Y se
  //   desactiva en dian_units_catalog. Para volver a usarla hay que
  //   reactivarla desde Configuración -> Unidades Medida (o buscarla de
  //   nuevo aquí, lo que la reactiva automáticamente).
  // - Si es "Personalizada" (legacy, sin vínculo): se elimina de forma
  //   permanente, ya no hay forma de recuperarla.
  const removeFromList = async (item: Presentation) => {
    const confirmMsg = item.dian_unit_id
      ? `¿Quitar "${item.name}" de esta lista?\n\nEsto la desactivará en Configuración -> Unidades Medida. Para volver a usarla, actívala de nuevo desde ahí, o búscala aquí (se reactiva automáticamente).`
      : `¿Eliminar "${item.name}"? Es una presentación personalizada (no vinculada al catálogo DIAN); se eliminará de forma permanente.`;

    const confirmed = await dialog.confirm(confirmMsg, {
      title: item.dian_unit_id ? 'Advertencia Importante' : 'Eliminar presentación',
      variant: 'warning',
      confirmText: 'Sí, quitar',
    });
    if (!confirmed) return;

    setRemovingId(item.id);
    try {
      const { error: deleteError } = await supabase
        .from('presentations')
        .delete()
        .eq('id', item.id);
      if (deleteError) throw deleteError;

      if (item.dian_unit_id) {
        const { error: deactivateError } = await supabase
          .from('dian_units_catalog')
          .update({ active: false })
          .eq('id', item.dian_unit_id);
        if (deactivateError) throw deactivateError;
      }

      setPresentations((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err: any) {
      await dialog.alert('Error: ' + err.message, { variant: 'danger', title: 'Error' });
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return <div className="p-6">Cargando presentaciones...</div>;
  }

  return (
    <DataTable
      title="Presentaciones"
      columns={[
        { key: 'name', label: 'Nombre' },
        {
          key: 'dian_unit_id',
          label: 'Origen',
          render: (item: Presentation) =>
            item.dian_unit_id ? (
              <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                Catálogo DIAN
              </span>
            ) : (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                Personalizada
              </span>
            ),
          exportValue: (item: Presentation) =>
            item.dian_unit_id ? 'Catálogo DIAN' : 'Personalizada',
        },
      ]}
      data={presentations}
      formFields={[]}
      onAdd={openAddModal}
      onEdit={() => {}}
      onDelete={() => {}}
      renderActions={(item: Presentation) => (
        <button
          onClick={() => removeFromList(item)}
          disabled={removingId === item.id}
          className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
        >
          {removingId === item.id ? 'Quitando...' : 'Quitar de esta lista'}
        </button>
      )}
    >
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nueva Presentación"
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-black mb-1">
            Buscar en Unidades Medida DIAN
          </label>
          <PresentationSearch
            existingPresentations={presentations}
            onSelect={handleSelectFromSearch}
            autoFocus
          />
          <p className="text-xs text-gray-500">
            Solo se pueden agregar unidades ya definidas en{' '}
            <strong>Configuración → Unidades Medida</strong>. Si una unidad
            aparece inactiva, se activará automáticamente al seleccionarla.
          </p>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded border"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </DataTable>
  );
}