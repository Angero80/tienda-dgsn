'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { useAlertDialog } from '../../components/AlertDialogProvider';

export default function BusinessSettingsPage() {
  const dialog = useAlertDialog();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rutFile, setRutFile] = useState<File | null>(null);
  const [uploadingRut, setUploadingRut] = useState(false);
  const [ciiuDescription, setCiiuDescription] = useState<string>('');
  const [ciiuNotFound, setCiiuNotFound] = useState(false);
  const [ciiuSector, setCiiuSector] = useState<string>('');
  const [ciiuTipoOperativo, setCiiuTipoOperativo] = useState<string>('');
  const [unitsActivatedMsg, setUnitsActivatedMsg] = useState<string>('');

  useEffect(() => {
    const loadSettings = async () => {
      const { data, error } = await supabase.from('settings').select('key, value');
      if (error) {
        console.error('Error cargando configuración:', error);
      } else {
        const obj = (data || []).reduce((acc, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {} as Record<string, string>);
        setSettings(obj);
      }
      setLoading(false);
    };
    loadSettings();
  }, []);

  // ✅ Busca automáticamente la descripción del código CIIU escrito,
  // apenas tiene los 4 dígitos completos. Además resuelve el sector
  // económico y tipo operativo (bienes/servicios/mixta) que ya quedaron
  // clasificados en ciiu_activities, y dispara la activación automática
  // de las unidades de medida DIAN típicas de ese sector.
  useEffect(() => {
    const code = settings['ciiu_code'] || '';
    if (code.length !== 4) {
      setCiiuDescription('');
      setCiiuNotFound(false);
      setCiiuSector('');
      setCiiuTipoOperativo('');
      setUnitsActivatedMsg('');
      return;
    }

    const lookup = async () => {
      const { data } = await supabase
        .from('ciiu_activities')
        .select('description, sector, tipo_operativo')
        .eq('code', code)
        .maybeSingle();

      if (data?.description) {
        setCiiuDescription(data.description);
        setCiiuNotFound(false);
        setCiiuSector(data.sector || '');
        setCiiuTipoOperativo(data.tipo_operativo || '');

        if (data.sector && data.tipo_operativo) {
          await activateUnitsForSector(data.sector, data.tipo_operativo);
        }
      } else {
        setCiiuDescription('');
        setCiiuNotFound(true);
        setCiiuSector('');
        setCiiuTipoOperativo('');
        setUnitsActivatedMsg('');
      }
    };
    lookup();
  }, [settings['ciiu_code']]);

  // ✅ Unidades DIAN sugeridas por sector/tipo operativo. Estas listas no
  // provienen de ningún catálogo oficial DIAN (no existe uno que cruce
  // CIIU con unidades) — son una decisión de negocio acordada con el
  // dueño de la plataforma. Los códigos sí son oficiales (Anexo Técnico
  // Resolución 000042 de 2020, sección 6.3.5.1 / dian_units_catalog).
  const UNIT_CODES_BY_PROFILE: Record<string, string[]> = {
    // Sector primario (agro, ganadería, pesca, minería)
    primario: ['KGM', 'TNE', 'LTR', 'HAR', '94', 'DZN'],
    // Sector secundario (manufactura, construcción)
    secundario: ['94', 'KGM', 'MTR', 'MTK', 'MTQ', 'BX', 'DZN'],
    // Terciario + bienes → Comercio (sección G)
    'terciario:bienes': ['94', 'BX', 'DZN', 'EA'],
    // Terciario + servicios → Servicios (código 'Mes' corregido: era 'LUN',
    // que ya no existe en el catálogo tras la limpieza; el código real es 'M36')
    'terciario:servicios': ['94', 'HUR', 'DAY', 'M36'],
  };
  // Terciario + mixta (ej. Construcción F, Alojamiento/Comida I) → combina
  // ambos perfiles, no solo el de servicios.
  UNIT_CODES_BY_PROFILE['terciario:mixta'] = Array.from(
    new Set([...UNIT_CODES_BY_PROFILE['terciario:bienes'], ...UNIT_CODES_BY_PROFILE['terciario:servicios']])
  );

  const resolveUnitCodesFor = (sector: string, tipoOperativo: string): string[] => {
    if (sector === 'primario') return UNIT_CODES_BY_PROFILE.primario;
    if (sector === 'secundario') return UNIT_CODES_BY_PROFILE.secundario;
    // Terciario: Comercio (bienes) vs. Servicios vs. Mixta (combina ambos,
    // ej. restaurantes/hoteles que venden productos y facturan por horas/días)
    if (sector === 'terciario' && tipoOperativo === 'bienes') {
      return UNIT_CODES_BY_PROFILE['terciario:bienes'];
    }
    if (sector === 'terciario' && tipoOperativo === 'mixta') {
      return UNIT_CODES_BY_PROFILE['terciario:mixta'];
    }
    return UNIT_CODES_BY_PROFILE['terciario:servicios'];
  };

  const activateUnitsForSector = async (sector: string, tipoOperativo: string) => {
    const codes = resolveUnitCodesFor(sector, tipoOperativo);
    if (codes.length === 0) return;

    const { error, data } = await supabase
      .from('dian_units_catalog')
      .update({ active: true })
      .in('code', codes)
      .select('code, name');

    if (error) {
      setUnitsActivatedMsg('');
      console.error('Error activando unidades DIAN por sector:', error);
      return;
    }

    const names = (data || []).map((u) => u.name).join(', ');
    setUnitsActivatedMsg(
      `Se activaron automáticamente estas unidades en tu catálogo: ${names}. Puedes ajustar cuáles usar en Configuración → Unidades DIAN.`
    );
  };

  const updateLocal = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const contactSameAsLegalRep = settings['contact_same_as_legal_rep'] === 'true';

  const handleRutFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setRutFile(file);
  };

  const uploadRutIfNeeded = async (): Promise<string> => {
    if (!rutFile) return settings['rut_file_url'] || '';

    setUploadingRut(true);
    const fileExt = rutFile.name.split('.').pop();
    const fileName = `rut_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('company-documents')
      .upload(fileName, rutFile);

    setUploadingRut(false);

    if (uploadError) {
      await dialog.alert('Error subiendo el RUT: ' + uploadError.message, {
        variant: 'danger',
        title: 'Error',
      });
      return settings['rut_file_url'] || '';
    }

    const { data } = supabase.storage.from('company-documents').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSaveClick = async () => {
    if (!rutFile && !settings['rut_file_url']) {
      await dialog.alert('Debes subir el RUT antes de guardar.', {
        variant: 'warning',
        title: 'Falta un dato',
      });
      return;
    }

    const confirmed = await dialog.confirm(
      'Cambiar el sector del negocio afecta qué módulos y campos ven tus usuarios (por ejemplo, Compras se oculta si eliges "Servicios").\n\nAsegúrate de que toda la información sea correcta antes de continuar.',
      { variant: 'warning', confirmText: 'Acepto, guardar cambios' }
    );
    if (!confirmed) return;

    await performSave();
  };

  const performSave = async () => {
    setSaving(true);

    const rutUrl = await uploadRutIfNeeded();

    // ✅ Si el contacto es el mismo representante legal, copiamos sus
    // datos a los campos de contacto para que cualquier parte del
    // sistema que lea "contacto" tenga datos completos, sin obligar a
    // la persona a volver a escribirlos.
    const finalContact = contactSameAsLegalRep
      ? {
          contact_name: settings['legal_rep_name'] || '',
          contact_id: settings['legal_rep_id'] || '',
          contact_phone: settings['legal_rep_phone'] || '',
          contact_email: settings['legal_rep_email'] || '',
        }
      : {
          contact_name: settings['contact_name'] || '',
          contact_id: settings['contact_id'] || '',
          contact_phone: settings['contact_phone'] || '',
          contact_email: settings['contact_email'] || '',
        };

    const keysToSave: Record<string, string> = {
      company_name: settings['company_name'] || '',
      company_nit: settings['company_nit'] || '',
      company_address: settings['company_address'] || '',
      company_phone: settings['company_phone'] || '',
      company_email: settings['company_email'] || '',
      business_sector: settings['business_sector'] || '',
      ciiu_code: settings['ciiu_code'] || '',
      rut_file_url: rutUrl,
      legal_rep_name: settings['legal_rep_name'] || '',
      legal_rep_id: settings['legal_rep_id'] || '',
      legal_rep_phone: settings['legal_rep_phone'] || '',
      legal_rep_email: settings['legal_rep_email'] || '',
      contact_same_as_legal_rep: contactSameAsLegalRep ? 'true' : 'false',
      ...finalContact,
    };

    for (const [key, value] of Object.entries(keysToSave)) {
      await supabase.from('settings').update({ value }).eq('key', key);
    }

    setSettings((prev) => ({ ...prev, ...keysToSave, rut_file_url: rutUrl }));
    setRutFile(null);
    setSaving(false);
    await dialog.alert('Datos de la empresa guardados correctamente', {
      variant: 'success',
      title: 'Guardado',
    });
  };

  if (loading) return <p className="p-6 text-black">Cargando...</p>;

  const sector = settings['business_sector'] || 'mixto';

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-black mb-6">Configuración de la Empresa</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveClick();
          }}
          className="bg-white p-6 rounded-xl shadow space-y-6"
        >
          {/* Datos básicos */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-gray-800">Datos Básicos</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Razón Social *</label>
                <input
                  type="text"
                  required
                  value={settings['company_name'] || ''}
                  onChange={(e) => updateLocal('company_name', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-black"
                  placeholder="Ej: Tech Solutions S.A.S."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">NIT / Identificación *</label>
                  <input
                    type="text"
                    required
                    value={settings['company_nit'] || ''}
                    onChange={(e) => updateLocal('company_nit', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="Ej: 123.456.789-0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={settings['company_email'] || ''}
                    onChange={(e) => updateLocal('company_email', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="contacto@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Dirección *</label>
                  <input
                    type="text" required
                    value={settings['company_address'] || ''}
                    onChange={(e) => updateLocal('company_address', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="Calle 123 #45-67, Bogotá"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono *</label>
                  <input
                    type="text"
                    required
                    value={settings['company_phone'] || ''}
                    onChange={(e) => updateLocal('company_phone', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="300 123 4567"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr />

          {/* Sector y CIIU */}
          <div>
            <h2 className="text-lg font-semibold mb-2 text-gray-800">Sector del Negocio</h2>
            <p className="text-xs text-gray-500 mb-3">
              Define si tus productos manejan inventario (Bienes), no lo
              manejan (Servicios), o si tu negocio combina ambos (Mixta —
              en ese caso, cada producto se marca individualmente).
            </p>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">Sector</label>
              <select
                value={sector}
                onChange={(e) => updateLocal('business_sector', e.target.value)}
                className="w-full md:w-96 p-2 border border-gray-300 rounded text-gray-900 bg-white"
              >
                <option value="bienes">Bienes (Comercializadora de productos)</option>
                <option value="servicios">Servicios (Comercializadora de servicios)</option>
                <option value="mixto">Mixta (Comercializadora de Bienes y Servicios)</option>
              </select>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1 text-gray-800">
                Código de Actividad Económica Principal (CIIU) *
              </label>
              <input
                type="text"
                maxLength={4} required
                value={settings['ciiu_code'] || ''}
                onChange={(e) => updateLocal('ciiu_code', e.target.value.replace(/\D/g, ''))}
                className="w-full md:w-48 p-2 border border-gray-300 rounded text-gray-900 bg-white"
                placeholder="Ej: 4791"
              />
              <p className="text-xs text-gray-500 mt-1">4 dígitos, según tu RUT (casilla 46).</p>
              {ciiuDescription && (
                <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2 mt-2">
                  ✅ {ciiuDescription}
                </p>
              )}
              {ciiuSector && (
                <p className="text-sm text-blue-700 bg-blue-50 rounded px-3 py-2 mt-2">
                  💡 Sugerencia según tu actividad económica: sector{' '}
                  <strong>{ciiuSector}</strong>
                  {ciiuTipoOperativo && (
                    <>
                      {' '}— clasificación típica: <strong>{ciiuTipoOperativo}</strong>
                    </>
                  )}
                  . El selector de arriba (Sector del Negocio) no se cambia
                  solo; ajústalo tú si aplica.
                </p>
              )}
              {unitsActivatedMsg && (
                <p className="text-sm text-cyan-700 bg-cyan-50 rounded px-3 py-2 mt-2">
                  📏 {unitsActivatedMsg}
                </p>
              )}
              {ciiuNotFound && (
                <p className="text-sm text-red-700 bg-red-50 rounded px-3 py-2 mt-2">
                  ⚠️ Código no encontrado en el catálogo CIIU. Verifica que esté bien escrito.
                </p>
              )}
            </div>
          </div>

          <hr />

          {/* RUT */}
          <div>
            <h2 className="text-lg font-semibold mb-2 text-gray-800">RUT *</h2>
            <p className="text-xs text-gray-500 mb-2">
              Verifica en tu RUT la <strong>actividad económica principal</strong> (casilla 46) antes de escribir el código CIIU abajo.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleRutFileChange}
                className="hidden"
                id="rut-upload"
              />
              <button
                type="button"
                onClick={() => document.getElementById('rut-upload')?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
              >
                {uploadingRut ? 'Subiendo...' : settings['rut_file_url'] ? 'Actualizar RUT' : 'Cargar RUT'}
              </button>
              {settings['rut_file_url'] && (
                <a
                  href={settings['rut_file_url']}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                >
                  Ver
                </a>
              )}
              {rutFile && (
                <span className="text-sm text-gray-600">{rutFile.name}</span>
              )}
            </div>
          </div>

          <hr />

          {/* Representante Legal */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-gray-800">Representante Legal</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-800">Nombre *</label>
                <input
                  type="text" required
                  value={settings['legal_rep_name'] || ''}
                  onChange={(e) => updateLocal('legal_rep_name', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-800">Identificación *</label>
                <input
                  type="text" required
                  value={settings['legal_rep_id'] || ''}
                  onChange={(e) => updateLocal('legal_rep_id', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-800">Teléfono *</label>
                <input
                  type="text" required
                  value={settings['legal_rep_phone'] || ''}
                  onChange={(e) => updateLocal('legal_rep_phone', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-800">Correo *</label>
                <input
                  type="email" required
                  value={settings['legal_rep_email'] || ''}
                  onChange={(e) => updateLocal('legal_rep_email', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                />
              </div>
            </div>
          </div>

          <hr />

          {/* Datos de contacto */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-gray-800">Datos de Contacto</h2>
            <label className="flex items-center gap-2 mb-3 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={contactSameAsLegalRep}
                onChange={(e) =>
                  updateLocal('contact_same_as_legal_rep', e.target.checked ? 'true' : 'false')
                }
              />
              El contacto es el mismo Representante Legal
            </label>

            {!contactSameAsLegalRep && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800">Nombre *</label>
                  <input
                    type="text" required
                    value={settings['contact_name'] || ''}
                    onChange={(e) => updateLocal('contact_name', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800">Identificación *</label>
                  <input
                    type="text" required
                    value={settings['contact_id'] || ''}
                    onChange={(e) => updateLocal('contact_id', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800">Teléfono *</label>
                  <input
                    type="text" required
                    value={settings['contact_phone'] || ''}
                    onChange={(e) => updateLocal('contact_phone', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-800">Correo *</label>
                  <input
                    type="email" required
                    value={settings['contact_email'] || ''}
                    onChange={(e) => updateLocal('contact_email', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2 rounded text-white ${
                saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}