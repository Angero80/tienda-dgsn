'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DataTable from './DataTable';

interface PartiesTableProps {
  type: 'customer' | 'supplier' | 'both';
  title: string;
}

type Party = {
  id: number;
  name: string;
  doc_type: string;
  doc_number: string;
  email: string;
  phone: string;
  address: string;
  type: string;
  created_at: string;
};

const translateType = (type: string): string => {
  switch (type) {
    case 'customer': return 'Cliente';
    case 'supplier': return 'Proveedor';
    case 'both': return 'Cliente/Proveedor';
    default: return type;
  }
};

const formatDate = (isoDate: string) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
};

export default function PartiesTable({ type, title }: PartiesTableProps) {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [form, setForm] = useState({
    name: '',
    doc_type: 'CC',
    doc_number: '',
    email: '',
    phone: '',
    address: '',
    type: type as string,
  });

  useEffect(() => {
    const loadParties = async () => {
      setLoading(true);
      let query = supabase.from('parties').select('*');

      if (type === 'customer') {
        query = query.in('type', ['customer', 'both']);
      } else if (type === 'supplier') {
        query = query.in('type', ['supplier', 'both']);
      }
      // Si es 'both', no aplicamos filtro, traemos todos

      const { data, error } = await query;
      if (error) {
        alert('Error: ' + error.message);
      } else {
        setParties(data || []);
      }
      setLoading(false);
    };
    loadParties();
  }, [type]);

  const filteredByDate = parties.filter((p) => {
    if (!dateFrom && !dateTo) return true;
    const createdAt = new Date(p.created_at);
    const start = dateFrom ? new Date(dateFrom) : null;
    const end = dateTo ? new Date(dateTo) : null;
    return (!start || createdAt >= start) && (!end || createdAt <= end);
  });

  const openModal = (party?: Party) => {
    if (party) {
      setEditingParty(party);
      setForm({
        name: party.name,
        doc_type: party.doc_type,
        doc_number: party.doc_number,
        email: party.email,
        phone: party.phone,
        address: party.address,
        type: party.type,
      });
    } else {
      setEditingParty(null);
      setForm({
        name: '',
        doc_type: 'CC',
        doc_number: '',
        email: '',
        phone: '',
        address: '',
        type: type,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingParty(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const partyData = { ...form };

    if (editingParty) {
      const { error } = await supabase
        .from('parties')
        .update(partyData)
        .eq('id', editingParty.id);

      if (error) {
        alert('Error al actualizar: ' + error.message);
        return;
      }
      setParties(parties.map((p) => (p.id === editingParty.id ? { ...p, ...partyData } : p)));
    } else {
      const { data, error } = await supabase.from('parties').insert([partyData]).select();

      if (error) {
        alert('Error al agregar: ' + error.message);
        return;
      }
      setParties([...parties, data[0]]);
    }
    closeModal();
  };

  const deleteParty = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    const { error } = await supabase.from('parties').delete().eq('id', id);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setParties(parties.filter((p) => p.id !== id));
    }
  };

  if (loading) return <p className="p-6 text-black">Cargando {title.toLowerCase()}...</p>;

  return (
    <DataTable
      title={title}
      data={filteredByDate}
      columns={[
        { key: 'name', label: 'Nombre' },
        { key: 'doc_type', label: 'Tipo Doc' },
        { key: 'doc_number', label: 'Número' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Teléfono' },
        {
          key: 'type',
          label: 'Tipo',
          render: (item: Party) => translateType(item.type),
        },
        {
          key: 'created_at',
          label: 'Registro',
          render: (item: Party) => formatDate(item.created_at),
        },
      ]}
      formFields={[]}
      onAdd={() => openModal()}
      onEdit={(item: Party) => openModal(item)}
      onDelete={deleteParty}
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
      printLandscape
    >
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md text-gray-900 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold mb-4">
              {editingParty ? 'Editar registro' : 'Nuevo registro'}
            </h2>
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
                <label className="block text-sm font-medium text-black mb-1">Tipo de Documento</label>
                <select
                  value={form.doc_type}
                  onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                >
                  <option value="TI">TI</option>
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="Pasaporte">Pasaporte</option>
                  <option value="NIT">NIT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Número de Documento</label>
                <input
                  type="text"
                  required
                  value={form.doc_number}
                  onChange={(e) => setForm({ ...form, doc_number: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Teléfono</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Dirección</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Tipo de Registro</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                >
                  <option value="customer">Cliente</option>
                  <option value="supplier">Proveedor</option>
                  <option value="both">Cliente/Proveedor</option>
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
                  {editingParty ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DataTable>
  );
}
