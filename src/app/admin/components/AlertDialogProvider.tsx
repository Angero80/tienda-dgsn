'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type Variant = 'warning' | 'danger' | 'info' | 'success';

type DialogOptions = {
  title?: string;
  variant?: Variant;
  confirmText?: string;
  cancelText?: string;
};

type DialogState =
  | null
  | {
      kind: 'alert' | 'confirm';
      message: string;
      title: string;
      variant: Variant;
      confirmText: string;
      cancelText?: string;
    };

type AlertDialogContextType = {
  alert: (message: string, opts?: DialogOptions) => Promise<void>;
  confirm: (message: string, opts?: DialogOptions) => Promise<boolean>;
};

const AlertDialogContext = createContext<AlertDialogContextType | null>(null);

const VARIANT_STYLES: Record<Variant, { icon: string; titleColor: string; confirmBtn: string }> = {
  // Mismo estilo que el modal "Advertencia Importante" ya usado en
  // Configuración -> Empresa al cambiar el sector del negocio.
  warning: { icon: '⚠️', titleColor: 'text-red-600', confirmBtn: 'bg-red-600 hover:bg-red-700' },
  danger: { icon: '⚠️', titleColor: 'text-red-600', confirmBtn: 'bg-red-600 hover:bg-red-700' },
  info: { icon: 'ℹ️', titleColor: 'text-blue-700', confirmBtn: 'bg-blue-600 hover:bg-blue-700' },
  success: { icon: '✅', titleColor: 'text-green-700', confirmBtn: 'bg-green-600 hover:bg-green-700' },
};

// Reemplazo de window.alert()/window.confirm() con el mismo estilo visual
// que ya usaba el aviso de "Advertencia Importante" (en vez del cuadro
// negro nativo del navegador). Uso:
//   const dialog = useAlertDialog();
//   await dialog.alert('Mensaje', { variant: 'danger' });
//   if (await dialog.confirm('¿Seguro?', { variant: 'warning' })) { ... }
export function AlertDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  const resolverRef = useRef<((value: any) => void) | null>(null);

  const close = (result: any) => {
    setState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  };

  const alertFn = useCallback((message: string, opts?: DialogOptions) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setState({
        kind: 'alert',
        message,
        title: opts?.title ?? 'Aviso',
        variant: opts?.variant ?? 'info',
        confirmText: opts?.confirmText ?? 'Aceptar',
      });
    });
  }, []);

  const confirmFn = useCallback((message: string, opts?: DialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (value: boolean) => resolve(value);
      setState({
        kind: 'confirm',
        message,
        title: opts?.title ?? 'Advertencia Importante',
        variant: opts?.variant ?? 'warning',
        confirmText: opts?.confirmText ?? 'Aceptar',
        cancelText: opts?.cancelText ?? 'Cancelar',
      });
    });
  }, []);

  const styles = state ? VARIANT_STYLES[state.variant] : null;

  return (
    <AlertDialogContext.Provider value={{ alert: alertFn, confirm: confirmFn }}>
      {children}

      {state && styles && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className={`font-semibold mb-2 flex items-center gap-2 ${styles.titleColor}`}>
              <span>{styles.icon}</span> {state.title}
            </h3>
            <p className="text-sm text-gray-600 mb-4 whitespace-pre-line">{state.message}</p>
            <div className="flex justify-end gap-3">
              {state.kind === 'confirm' && (
                <button
                  onClick={() => close(false)}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  {state.cancelText}
                </button>
              )}
              <button
                onClick={() => close(state.kind === 'confirm' ? true : undefined)}
                className={`px-4 py-2 rounded text-white ${styles.confirmBtn}`}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertDialogContext.Provider>
  );
}

export function useAlertDialog() {
  const ctx = useContext(AlertDialogContext);
  if (!ctx) {
    throw new Error('useAlertDialog debe usarse dentro de <AlertDialogProvider> (ya está en admin/layout.tsx)');
  }
  return ctx;
}