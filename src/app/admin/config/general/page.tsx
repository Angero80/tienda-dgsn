// src/app/admin/config/general/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

type Setting = {
  key: string;
  value: string;
};

export default function GeneralSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) {
      console.error('Error cargando configuraciones:', error);
    } else {
      const settingsObj = data.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>);
      setSettings(settingsObj);
    }
    setLoading(false);
  };

  const updateSetting = async (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    await supabase
      .from('settings')
      .update({ value })
      .eq('key', key);
  };

  if (loading) {
    return <div className="p-6 text-black">Cargando configuración...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Configuración General</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6 border border-gray-200">
        {/* Uso de códigos */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Métodos de identificación</h2>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings['use_barcode'] === 'true'}
                onChange={(e) => updateSetting('use_barcode', e.target.checked ? 'true' : 'false')}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-800 text-sm font-medium">
                Usar código de barras (opcional)
              </span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings['use_qr'] !== 'false'}
                onChange={(e) => updateSetting('use_qr', e.target.checked ? 'true' : 'false')}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-800 text-sm font-medium">
                Usar código QR (recomendado)
              </span>
            </label>
          </div>
        </div>

        {/* Datos de la empresa: se editan en Configuración → Empresa */}
        <div>
          <p className="text-sm text-gray-500">
            Los datos de la empresa (nombre, NIT, dirección, teléfono) y el
            sector del negocio se administran en{' '}
            <a href="/admin/config/business" className="text-blue-600 underline">
              Configuración → Empresa
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}