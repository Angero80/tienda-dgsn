// src/lib/colorUtils.ts
//
// Utilidades para limitar qué tan "fuerte" puede verse un color elegido
// libremente por el dueño del negocio (ej: color de fondo de un banner),
// evitando que un color muy oscuro o muy saturado dañe la legibilidad o
// el aspecto general del banner.
//
// Estrategia: convertir el color a HSL y, si su luminosidad (L) está por
// debajo de un mínimo aceptable, subirla mezclando el color con blanco en
// proporción a qué tan oscuro/saturado es. Colores que ya son claros casi
// no se tocan.

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

/** Luminosidad mínima (0-100) que debe tener el color final. Por debajo de
 * esto, se considera "demasiado fuerte" y se aclara. 80 produce un tono
 * pastel suave mantiene algo de color perceptible. */
const MIN_LIGHTNESS = 80;

/** Tope de saturación (0-100) para el color ya aclarado, para que no quede
 * un pastel "neón". */
const MAX_SATURATION_AFTER = 55;

function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = h / 360;
  const sn = s / 100;
  const ln = l / 100;

  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

/**
 * Suaviza un color hexadecimal a un tono "pastel" cuando es demasiado
 * oscuro o saturado, dejando prácticamente igual los colores que ya son
 * claros. Pensado para el color de fondo de banners, donde el dueño del
 * negocio elige libremente con un <input type="color">.
 *
 * @param hexColor  Color en formato hex, ej: "#1e40af"
 * @returns         Color hex ya suavizado si hacía falta, o el mismo si no.
 */
export function applyMaxOpacity(hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor; // valor inválido: no tocar, dejar que falle donde corresponda

  const hsl = rgbToHsl(rgb);

  // Si ya es suficientemente claro, se deja casi intacto.
  if (hsl.l >= MIN_LIGHTNESS) {
    return hexColor;
  }

  // Cuanto más oscuro (L más bajo), más se "empuja" hacia blanco.
  const adjusted: HSL = {
    h: hsl.h,
    s: Math.min(hsl.s, MAX_SATURATION_AFTER),
    l: MIN_LIGHTNESS,
  };

  return rgbToHex(hslToRgb(adjusted));
}

/**
 * Color de texto recomendado para usar sobre un fondo ya pasado por
 * applyMaxOpacity(). Como ese fondo siempre termina claro, el texto se
 * fuerza a un gris oscuro fijo en vez de depender de lo que el usuario
 * haya elegido (que podría no contrastar).
 */
export const PASTEL_BANNER_TEXT_COLOR = '#1f2937'; // gray-800