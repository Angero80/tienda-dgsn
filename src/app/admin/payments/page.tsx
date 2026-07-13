'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

// Tipos mejorados
type MercadoPagoConfig = {
  type: 'mercadopago';
  public_key: string;
  access_token: string;
};

type EPaycoConfig = {
  type: 'epayco';
  public_key: string;
  private_key: string;
};

type BoldConfig = {
  type: 'bold';
  publishable_key: string;
  secret_key: string;
};

type GatewayConfig = MercadoPagoConfig | EPaycoConfig | BoldConfig;

type PaymentSettings = {
  id?: string;
  active_gateway: 'mercadopago' | 'epayco' | 'bold' | null;
  mercadopago?: MercadoPagoConfig;
  epayco?: EPaycoConfig;
  bold?: BoldConfig;
  created_at?: string;
  updated_at?: string;
};

// Tipo explícito para cada pasarela
type Gateway = {
  id: 'mercadopago' | 'epayco' | 'bold';
  name: string;
  logo?: string;
  url: string;
  requirements: string[];
  fees: string;
  description: string;
};

// Datos de cada pasarela
const GATEWAYS: Gateway[] = [
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    logo: 'https://http2.mlstatic.com/storage/mobile-on-demand-resources/image/web-private-nav-mp-logo_1X?updatedAt=1746639317789',
    url: 'https://www.mercadopago.com.co',
    requirements: ['Cédula o NIT', 'Cuenta bancaria en Colombia', 'Correo y teléfono'],
    fees: '3.99% + $200 COP (tarjeta crédito)',
    description: 'Ideal para ventas online y efectivo (Baloto, Efecty). Soporta Nequi.',
  },
  {
    id: 'epayco',
    name: 'ePayco',
    logo: 'https://epayco.com/wp-content/uploads/2023/04/logo-blanco.svg',
    url: 'https://epayco.co',
    requirements: ['Cédula o NIT', 'Cuenta bancaria', 'Teléfono y correo'],
    fees: '3.99% + $200 COP (crédito)',
    description: 'Pasarela colombiana fácil de usar. Acepta Nequi, Daviplata, PSE y efectivo.',
  },
  {
    id: 'bold',
    name: 'Bold',
    url: 'https://bold.co',
    requirements: ['Cédula o NIT', 'Cuenta bancaria', 'Sitio web (opcional)'],
    fees: '3.5% + $200 COP',
    description: 'API moderna, ideal para desarrolladores. Soporta Nequi y QR.',
  },
];

export default function PaymentsPage() {
  const [settings, setSettings] = useState<PaymentSettings>({
    active_gateway: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Cargar configuración guardada
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('payment_settings')
      .select('*')
      .single();

    if (!error && data) {
      setSettings(data);
    }
  };

  // Cargar el carrusel de Bold una vez, al montar el componente
  useEffect(() => {
    const loadBoldSlider = () => {
      const container = document.getElementById('bold-slider-container');
      if (!container || container.querySelector('script')) return;

      const script = document.createElement('script');
      script.src = 'https://bold.co/library/ui-kit.js?type=slider';
      script.async = true;

      script.onload = () => console.log('✅ Carrusel de Bold cargado');
      script.onerror = () => {
        container.innerHTML = '<p style="color:white; font-size:12px;">Error al cargar Bold</p>';
      };

      container.appendChild(script);
    };

    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadBoldSlider);
    } else {
      loadBoldSlider();
    }

    // Limpieza
    return () => {
      const container = document.getElementById('bold-slider-container');
      if (container) {
        container.querySelectorAll('script').forEach(s => s.remove());
      }
    };
  }, []);

  // Guardar configuración
  const saveSettings = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('payment_settings')
      .upsert(
        { ...settings, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      alert('✅ Configuración de pagos guardada');
      sendConfirmationEmail();
    }
    setIsSaving(false);
  };

  // Enviar correo de confirmación
  const sendConfirmationEmail = async () => {
    const gatewayNames: Record<'mercadopago' | 'epayco' | 'bold', string> = {
      mercadopago: 'Mercado Pago',
      epayco: 'ePayco',
      bold: 'Bold',
    };

    console.log(
      `📧 Correo enviado: Tu tienda ha sido vinculada con ${gatewayNames[settings.active_gateway!]}.`
    );
    setEmailSent(true);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuración de Pagos</h1>
      <p className="text-gray-600 mb-8">
        Elige una pasarela de pago para tu tienda. Puedes registrarte y luego vincular tu cuenta.
      </p>

      {/* Opciones de pasarelas */}
      <div className="space-y-6">
        {GATEWAYS.map((gateway) => (
          <div key={gateway.id} className="border rounded-lg p-6 hover:shadow-md transition">
            {/* Fondo azul extendido */}
            <div
              style={{
                backgroundColor: '#2563eb',
                padding: '12px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {/* Carrusel de Bold o logo normal */}
              <div
                style={{
                  backgroundColor: '#2563eb',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {gateway.id === 'bold' ? (
                  // ✅ Carrusel de Bold SIEMPRE visible
                  <div
                    id="bold-slider-container"
                    style={{ width: '200px', height: '30px' }}
                  ></div>
                ) : (
                  // Logo normal para otros
                  <img src={gateway.logo} alt={gateway.name} className="h-6" />
                )}
              </div>

              {/* Nombre a la derecha */}
              <h3 className="text-xl font-semibold text-white">{gateway.name}</h3>
            </div>

            <p className="text-gray-700 mb-3">{gateway.description}</p>

            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-gray-800 mb-2">Requisitos:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {gateway.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>

            <div className="mb-4">
              <strong className="text-gray-800">Comisión:</strong>{' '}
              <span className="font-medium text-green-700">{gateway.fees}</span>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                onClick={() => window.open(gateway.url, '_blank')}
                className="bg-white border border-gray-300 hover:border-gray-400 text-blue-600 hover:text-blue-700 px-4 py-2 rounded text-sm font-medium transition"
              >
                Registrarse en {gateway.name}
              </button>

              <label className="flex items-center space-x-2 cursor-pointer text-gray-800">
                <input
                  type="radio"
                  name="active_gateway"
                  checked={settings.active_gateway === gateway.id}
                  onChange={() => setSettings({ ...settings, active_gateway: gateway.id })}
                  className="text-blue-600"
                />
                <span>Usar esta pasarela</span>
              </label>
            </div>

            {/* Campos de credenciales */}
            {settings.active_gateway === gateway.id && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-800">
                    Public Key / Publishable Key
                  </label>
                  <input
                    type="text"
                    value={
                      (() => {
                        const config = settings[gateway.id];
                        if (!config) return '';
                        if ('public_key' in config) return config.public_key;
                        if ('publishable_key' in config) return config.publishable_key;
                        return '';
                      })()
                    }
                    onChange={(e) => {
                      setSettings((prev) => {
                        const current = prev[gateway.id];
                        let updatedConfig: GatewayConfig;

                        if (gateway.id === 'bold') {
                          updatedConfig = {
                            type: 'bold',
                            publishable_key: e.target.value,
                            secret_key: (current as BoldConfig)?.secret_key || '',
                          };
                        } else {
                          const keyName = gateway.id === 'mercadopago' ? 'access_token' : 'private_key';
                          const secretValue =
                            (current as any)?.[keyName] || '';

                          updatedConfig = {
                            type: gateway.id,
                            public_key: e.target.value,
                            [keyName]: secretValue,
                          } as any;
                        }

                        return {
                          ...prev,
                          [gateway.id]: updatedConfig,
                        };
                      });
                    }}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800">
                    Access Token / Secret Key
                  </label>
                  <input
                    type="password"
                    placeholder="No se muestra por seguridad"
                    onChange={(e) => {
                      setSettings((prev) => {
                        const current = prev[gateway.id];
                        let updatedConfig: GatewayConfig;

                        if (gateway.id === 'bold') {
                          updatedConfig = {
                            type: 'bold',
                            publishable_key: (current as BoldConfig)?.publishable_key || '',
                            secret_key: e.target.value,
                          };
                        } else {
                          const keyName = gateway.id === 'mercadopago' ? 'access_token' : 'private_key';
                          const publicKeyValue =
                            (current as any)?.public_key || '';

                          updatedConfig = {
                            type: gateway.id,
                            public_key: publicKeyValue,
                            [keyName]: e.target.value,
                          } as any;
                        }

                        return {
                          ...prev,
                          [gateway.id]: updatedConfig,
                        };
                      });
                    }}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botón guardar */}
      <div className="mt-8 flex space-x-4">
        <button
          onClick={saveSettings}
          disabled={isSaving || !settings.active_gateway}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : 'Guardar Configuración'}
        </button>

        {emailSent && (
          <p className="text-green-600 self-center">✅ Correo de confirmación enviado</p>
        )}
      </div>
    </div>
  );
}