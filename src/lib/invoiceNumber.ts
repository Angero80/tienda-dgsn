// Arma el número completo de factura/recibo: prefijo alfanumérico
// autorizado por la DIAN (hasta 4 caracteres) + consecutivo con ceros a la
// izquierda. El relleno con ceros es solo estético (la DIAN no lo exige),
// pero ayuda a que todos los números se vean con el mismo largo.
export function formatDocNumber(
  prefix: string | null | undefined,
  consecutive: number | null | undefined,
  padWidth = 8
): string {
  if (consecutive == null) return '—';
  const padded = String(consecutive).padStart(padWidth, '0');
  return `${prefix || ''}${padded}`;
}