export type TaxGroup = { rate: number; base: number; amount: number };

// Agrupa las líneas de una factura/recibo por tarifa de impuesto, sumando
// la base gravable y el impuesto de cada grupo. Así, si por ejemplo hay 3
// productos al 19% y 2 al 0%, se muestran solo 2 líneas de resumen en vez
// de una por producto — igual a como la DIAN exige el desglose de
// impuestos (TaxTotal/TaxSubtotal por tarifa) en el formato electrónico.
export function groupTaxesByRate(
  items: { subtotal: number; tax_rate: number; tax_amount: number }[]
): TaxGroup[] {
  const map = new Map<number, TaxGroup>();

  for (const item of items) {
    const rate = Number(item.tax_rate) || 0;
    const base = Number(item.subtotal) || 0;
    const amount = Number(item.tax_amount) || 0;

    const existing = map.get(rate);
    if (existing) {
      existing.base += base;
      existing.amount += amount;
    } else {
      map.set(rate, { rate, base, amount });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.rate - a.rate);
}