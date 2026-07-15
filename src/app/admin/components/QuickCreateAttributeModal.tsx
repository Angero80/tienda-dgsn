'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { findDuplicate } from '../../../lib/textNormalize';
import PresentationSearch, { Presentation } from './PresentationSearch';
import { useAlertDialog } from './AlertDialogProvider';

type AttributeItem = { id: number; name: string; dian_unit_id?: number | null };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tableName: 'brands' | 'categories' | 'presentations';
  title: string; // ej: "Nueva Marca"
  existingList: AttributeItem[];
  onCreated: (newItem: AttributeItem) => void;
};

export default function QuickCreateAttributeModal({
  isOpen,
  onClose,
  tableName,
  title,
  existingList,
  onCreated,
}: Props) {
  if (!isOpen) return null;

  if (tableName === 'presentations') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
        <div className="bg-white rounded-lg p-5 w-full max-w-sm text-gray-900">
          <h3 className="font-semibold mb-3">{title}</h3>
          <PresentationSearch
            existingPresentations={existingList as Presentation[]}
            onSelect={(item) => {
              onCreated(item);
              onClose();
            }}
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-3">
            Solo unidades ya definidas en Configuración → Unidades Medida. Si
            está inactiva, se activa automáticamente al seleccionarla.
          </p>
          <div className="flex justify-end pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GenericAttributeQuickCreate
      tableName={tableName}
      title={title}
      existingList={existingList}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

// Comportamiento original, intacto, para 'brands' y 'categories' (texto libre).
function GenericAttributeQuickCreate({
  tableName,
  title,
  existingList,
  onClose,
  onCreated,
}: {
  tableName: 'brands' | 'categories';
  title: string;
  existingList: AttributeItem[];
  onClose: () => void;
  onCreated: (newItem: AttributeItem) => void;
}) {
  const dialog = useAlertDialog();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('El nombre es obligatorio.');
      return;
    }

    const duplicate = findDuplicate(existingList, trimmed);
    if (duplicate) {
      const useExisting = await dialog.confirm(
        `Ya existe "${duplicate.name}". ¿Quieres usar ese en vez de crear uno nuevo?`,
        { variant: 'info', confirmText: 'Usar existente' }
      );
      if (useExisting) {
        onCreated(duplicate);
        setName('');
        onClose();
      }
      return;
    }

    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from(tableName)
      .insert([{ name: trimmed }])
      .select();

    setSaving(false);

    if (insertError) {
      setError('Error al guardar: ' + insertError.message);
      return;
    }

    if (data && data.length > 0) {
      onCreated(data[0]);
      setName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-lg p-5 w-full max-w-sm text-gray-900">
        <h3 className="font-semibold mb-3">{title}</h3>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-3">
            {error}
          </div>
        )}

        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="w-full border rounded px-3 py-2 text-gray-900 bg-white mb-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
          }}
        />

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              setName('');
              setError('');
              onClose();
            }}
            className="px-4 py-2 rounded border"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}