// Formatea números al estilo colombiano: punto para miles, coma para
// decimales (ej: 1.170.000,00). No incluye el símbolo "$" — se sigue
// escribiendo aparte en cada pantalla, como ya se hacía, para no duplicarlo.
export function formatCurrency(value: number | string | null | undefined, decimals = 2): string {
  const num = Number(value) || 0;
  return num.toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}