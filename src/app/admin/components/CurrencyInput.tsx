'use client';

import { useRef } from 'react';

type Props = {
  value: string; // valor crudo sin formato (ej: "1170000" o "1170000.5")
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
};

// Un <input type="number"> del navegador no puede mostrar puntos de miles
// mientras se escribe (rompería el valor numérico). Este campo es de texto,
// pero solo deja escribir dígitos y una coma decimal, formatea en vivo con
// el estilo colombiano (punto de miles, coma decimal), y hacia afuera
// siempre entrega el valor crudo en notación estándar (punto decimal) para
// que el resto del formulario lo siga usando igual que antes.
function formatDisplay(raw: string): string {
  if (!raw) return '';
  const isNegative = raw.startsWith('-');
  const cleanRaw = isNegative ? raw.slice(1) : raw;
  const [intPart, decPart] = cleanRaw.split('.');
  const withThousands = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const result = decPart !== undefined ? `${withThousands},${decPart}` : withThousands;
  return isNegative ? `-${result}` : result;
}

function parseDisplay(display: string): string {
  const isNegative = display.trim().startsWith('-');
  let cleaned = display.replace(/[^0-9,]/g, '');
  const firstComma = cleaned.indexOf(',');
  if (firstComma !== -1) {
    cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '');
  }
  const raw = cleaned.replace(',', '.');
  return isNegative && raw ? `-${raw}` : raw;
}

export default function CurrencyInput({ value, onChange, placeholder, className, required, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = formatDisplay(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    // OJO: en este punto input.value YA incluye lo que el usuario acaba de
    // teclear, y selectionStart ya es la posición del cursor en ese texto
    // nuevo. El bug anterior comparaba esto contra el texto formateado
    // ANTERIOR (de antes de la tecla), lo que desalineaba el conteo y
    // hacía que los dígitos se insertaran en el lugar equivocado.
    const cursorPos = input.selectionStart ?? input.value.length;
    const charBeforeCursor = cursorPos > 0 ? input.value[cursorPos - 1] : '';
    const digitsBeforeCursor = input.value.slice(0, cursorPos).replace(/[^0-9]/g, '').length;

    const rawValue = parseDisplay(input.value);
    const newDisplay = formatDisplay(rawValue);

    onChange(rawValue);

    requestAnimationFrame(() => {
      if (!inputRef.current) return;

      if (digitsBeforeCursor === 0) {
        inputRef.current.setSelectionRange(0, 0);
        return;
      }

      let count = 0;
      let pos = newDisplay.length;
      for (let i = 0; i < newDisplay.length; i++) {
        if (/[0-9]/.test(newDisplay[i])) {
          count++;
          if (count === digitsBeforeCursor) {
            pos = i + 1;
            break;
          }
        }
      }
      // Si el usuario justo tecleó la coma decimal, deja el cursor después
      // de ella en vez de justo antes.
      if (charBeforeCursor === ',' && newDisplay[pos] === ',') {
        pos += 1;
      }
      inputRef.current.setSelectionRange(pos, pos);
    });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      required={required}
      disabled={disabled}
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}