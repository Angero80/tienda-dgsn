'use client';

import { useState } from 'react';
import DataTable from '../../components/DataTable';
import { useAlertDialog } from '../../components/AlertDialogProvider';

// NOTA: Esta pantalla todavía no está conectada a Supabase.
// La gestión real de roles y permisos requiere autenticación
// (Supabase Auth) para poder asociar cada usuario a un rol y
// aplicar Row Level Security según ese rol. Esa es la siguiente
// fase grande del proyecto. Por ahora esta pantalla muestra la
// estructura de roles prevista para el negocio, para validar el
// diseño antes de conectar el backend real.

type Role = {
  id: number;
  name: string;
  description: string;
  permissions: string[];
};

const initialRoles: Role[] = [
  {
    id: 1,
    name: 'Administrador',
    description: 'Acceso total: productos, ventas, compras, facturación, configuración y usuarios.',
    permissions: ['Productos', 'Compras', 'Ventas', 'Facturación', 'Clientes', 'Proveedores', 'Configuración', 'Usuarios'],
  },
  {
    id: 2,
    name: 'Vendedor / Cajero',
    description: 'Puede operar el punto de venta (POS) y consultar productos, sin acceso a configuración.',
    permissions: ['Ventas (POS)', 'Consultar productos', 'Clientes'],
  },
  {
    id: 3,
    name: 'Bodega / Inventario',
    description: 'Gestiona productos, compras y proveedores, sin acceso a ventas ni facturación.',
    permissions: ['Productos', 'Compras', 'Proveedores'],
  },
  {
    id: 4,
    name: 'Contabilidad',
    description: 'Acceso a facturación, informes y configuración de resoluciones DIAN.',
    permissions: ['Facturación', 'Informes', 'Configuración (Resoluciones)'],
  },
];

const allPermissionAreas = [
  'Productos',
  'Compras',
  'Ventas (POS)',
  'Facturación',
  'Clientes',
  'Proveedores',
  'Informes',
  'Configuración',
  'Usuarios',
];

export default function RolesPage() {
  const dialog = useAlertDialog();
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [editing, setEditing] = useState<Role | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const openModal = (role?: Role) => {
    setEditing(role || null);
    setForm(
      role
        ? { name: role.name, description: role.description, permissions: role.permissions }
        : { name: '', description: '', permissions: [] }
    );
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      await dialog.alert('El nombre del rol es obligatorio.', { variant: 'warning', title: 'Falta un dato' });
      return;
    }

    if (editing) {
      setRoles((prev) =>
        prev.map((r) => (r.id === editing.id ? { ...r, ...form } : r))
      );
    } else {
      const nextId = roles.length > 0 ? Math.max(...roles.map((r) => r.id)) + 1 : 1;
      setRoles((prev) => [...prev, { id: nextId, ...form }]);
    }
    closeModal();
  };

  const handleDelete = async (id: number) => {
    const confirmed = await dialog.confirm('¿Eliminar este rol?', {
      variant: 'warning',
      confirmText: 'Sí, eliminar',
    });
    if (!confirmed) return;
    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <DataTable
      title="Roles y Permisos"
      data={roles}
      columns={[
        { key: 'name', label: 'Rol' },
        { key: 'description', label: 'Descripción' },
        {
          key: 'permissions',
          label: 'Permisos',
          render: (item: Role) => (
            <div className="flex flex-wrap gap-1">
              {item.permissions.map((perm) => (
                <span
                  key={perm}
                  className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                >
                  {perm}
                </span>
              ))}
            </div>
          ),
          exportValue: (item: Role) => item.permissions.join(', '),
        },
      ]}
      formFields={[
        { name: 'name', label: 'Rol' },
        { name: 'description', label: 'Descripción' },
      ]}
      onAdd={() => openModal()}
      onEdit={(item: Role) => openModal(item)}
      onDelete={handleDelete}
    >
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md text-gray-900">
            <h2 className="font-semibold mb-4">{editing ? 'Editar rol' : 'Nuevo rol'}</h2>

            <form onSubmit={handleSave}>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input
                className="w-full border rounded px-3 py-2 mb-3 text-gray-900 bg-white"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea
                className="w-full border rounded px-3 py-2 mb-3 text-gray-900 bg-white"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <label className="block text-sm font-medium mb-1">Permisos</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {allPermissionAreas.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(perm)}
                      onChange={() => togglePermission(perm)}
                    />
                    {perm}
                  </label>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded border">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DataTable>
  );
}