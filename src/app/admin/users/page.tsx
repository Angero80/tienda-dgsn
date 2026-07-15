'use client';

import { useEffect, useState } from 'react';
import Modal from '../../../components/Modal';
import { supabase } from '../../../lib/supabaseClient';
import DataTable from '../components/DataTable';
import { useAlertDialog } from '../components/AlertDialogProvider';

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

const roleLabel = (role: string) => {
  if (role === 'admin') return '👑 Administrador';
  if (role === 'manager') return '👔 Gerente';
  if (role === 'cashier') return '🧾 Cajero';
  return role;
};

// ✅ Versión sin emoji, solo para exportaciones (CSV/Excel/PDF/Print)
const roleLabelPlain = (role: string) => {
  if (role === 'admin') return 'Administrador';
  if (role === 'manager') return 'Gerente';
  if (role === 'cashier') return 'Cajero';
  return role;
};

export default function UsersPage() {
  const dialog = useAlertDialog();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'cashier' });

  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    const loadUsers = async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) {
        await dialog.alert('Error al cargar usuarios: ' + error.message, { variant: 'danger', title: 'Error' });
      } else {
        setUsers(data || []);
      }
      setLoading(false);
    };
    loadUsers();
  }, []);

  const usersByRole =
    filterRole === 'all' ? users : users.filter((u) => u.role === filterRole);

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setForm({ name: user.name, email: user.email, role: user.role });
    } else {
      setEditingUser(null);
      setForm({ name: '', email: '', role: 'cashier' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      const { error } = await supabase
        .from('users')
        .update(form)
        .eq('id', editingUser.id);

      if (error) {
        await dialog.alert('Error al actualizar: ' + error.message, { variant: 'danger', title: 'Error' });
        return;
      }
      setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, ...form } : u)));
    } else {
      const { data, error } = await supabase.from('users').insert([form]).select();

      if (error) {
        await dialog.alert('Error al agregar: ' + error.message, { variant: 'danger', title: 'Error' });
        return;
      }
      setUsers([...users, data[0]]);
    }
    closeModal();
  };

  const deleteUser = async (id: number) => {
    const confirmed = await dialog.confirm('¿Estás seguro de eliminar este usuario?', {
      variant: 'warning',
      confirmText: 'Sí, eliminar',
    });
    if (!confirmed) return;
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) {
      await dialog.alert('Error: ' + error.message, { variant: 'danger', title: 'Error' });
    } else {
      setUsers(users.filter((u) => u.id !== id));
    }
  };

  if (loading) return <p className="p-6 text-black">Cargando usuarios...</p>;

  return (
    <DataTable
      title="Usuarios"
      data={usersByRole}
      columns={[
        { key: 'name', label: 'Nombre' },
        { key: 'email', label: 'Email' },
        {
          key: 'role',
          label: 'Rol',
          render: (item: User) => roleLabel(item.role),
          exportValue: (item: User) => roleLabelPlain(item.role),
        },
      ]}
      formFields={[
        { name: 'name', label: 'Nombre' },
        { name: 'email', label: 'Email' },
        { name: 'role', label: 'Rol' },
      ]}
      onAdd={() => openModal()}
      onEdit={(item: User) => openModal(item)}
      onDelete={deleteUser}
      extraFilters={[
        {
          label: 'Filtrar por rol',
          control: (
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="p-2 border border-gray-300 rounded text-black text-sm h-9"
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
              <option value="cashier">Cajero</option>
            </select>
          ),
        },
      ]}
    >
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Nombre</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-black"
            >
              <option value="cashier">Cajero</option>
              <option value="manager">Gerente</option>
              <option value="admin">Administrador</option>
            </select>
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
              {editingUser ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </DataTable>
  );
}